// Đọc asset thẳng từ một file .zip nằm TRÊN MẠNG, bằng HTTP Range.
//
// Khác gì zip-store.js: bản kia nhận một Blob đã tải về đủ (đọc đĩa, không ra
// mạng). Bản này không tải cả file — nó chỉ xin đúng khúc byte đang cần.
//
// VÌ SAO LÀM ĐƯỢC: zip là định dạng đọc-ngược. Bảng mục lục nằm ở CUỐI file và
// ghi rõ từng mục bắt đầu ở byte thứ mấy, dài bao nhiêu. Có bảng ấy là nhảy
// thẳng tới khúc cần, khỏi đụng phần còn lại.
//
// SỐ LIỆU THẬT của bộ đang dùng:
//   – zip 275 MB, 12.340 mục, nén kiểu "store" (lưu thẳng, không nén)
//   – bảng mục lục khoảng 1,2 MB
//   ⇒ khởi động tốn ~1,3 MB thay vì 275 MB. Mỗi asset sau đó tốn đúng cỡ nó.
//
// ĐIỀU KIỆN MÁY CHỦ — thiếu một trong hai là không chạy:
//   1. accept-ranges: bytes          (cho xin từng khúc)
//   2. access-control-allow-origin   (cho trang khác miền đọc)
// Máy chủ hiện dùng có đủ cả hai; nếu đổi chỗ chứa thì phải kiểm lại.
//
// CẢNH BÁO THẲNG: file này ĐI RA MẠNG. Đó là ngoại lệ do chủ dự án yêu cầu,
// ngược với quy tắc 4 trong CLAUDE.md. Địa chỉ không nhúng trong mã — nó nằm ở
// thẻ <meta name="mu-zip-url"> đầu index.html, sửa và xoá được bằng mắt thường.

/* Cùng bốn hằng như zip-store.js nhưng đặt tên riêng: bộ dựng gộp mọi module
   vào MỘT phạm vi, tên trùng là hỏng build. Hậu tố XA = đọc từ xa. */
const SIG_EOCD_XA = 0x06054b50;
const SIG_CD_XA = 0x02014b50;
const SIG_LOCAL_XA = 0x04034b50;

const EOCD_SEARCH_XA = 66000;

/* Trường extra của đầu mỗi file hiếm khi quá vài chục byte. Xin dư 256 byte để
   gộp "đọc đầu file" và "đọc dữ liệu" vào MỘT yêu cầu thay vì hai — 12 nghìn
   file mà mỗi file hai lượt thì số lượt gọi tăng gấp đôi vô ích. */
const DU_DAU = 256;

/** Xin một khúc byte. Trả ArrayBuffer. */
async function khuc(url, start, end) {
  const r = await fetch(url, { headers: { Range: `bytes=${start}-${end - 1}` } });
  if (!r.ok) throw new Error(`Range ${start}-${end} trả HTTP ${r.status}`);
  /* 206 là "đã cắt đúng khúc". 200 nghĩa là máy chủ LỜ ĐI Range và gửi cả
     file — phải biết để báo, không thì đọc nhầm offset ra dữ liệu rác. */
  if (r.status !== 206) {
    throw new Error('Máy chủ không hỗ trợ HTTP Range (trả 200 thay vì 206)');
  }
  return r.arrayBuffer();
}

/**
 * Kích thước file zip, hỏi bằng HEAD.
 *
 * HAI CÁCH TÔI THỬ TRƯỚC ĐỀU HỎNG, ghi lại để đừng ai làm lại:
 *
 *   1. GET `bytes=0-0` rồi đọc header `content-range`.
 *      Bằng curl thì ra số. Trong trình duyệt thì LUÔN null: khác miền thì
 *      JavaScript chỉ đọc được mấy header trong danh sách an toàn của CORS,
 *      `content-range` không có trong đó. Muốn đọc phải sửa máy chủ để gửi
 *      thêm `Access-Control-Expose-Headers`.
 *
 *   2. GET dải hậu tố `bytes=-66000` ("66 KB cuối").
 *      Ngã ở TypeError: Failed to fetch. Header `Range` chỉ được miễn tiền
 *      kiểm khi có dạng `bytes=<số>-<số>`; dạng hậu tố không được miễn, nên
 *      trình duyệt bắn OPTIONS trước, mà máy chủ chỉ khai
 *      `access-control-allow-headers: content-type` — không có `range`.
 *
 * Cách đang dùng: HEAD không kèm header lạ nào nên không bị tiền kiểm, còn
 * `content-length` thì NẰM TRONG danh sách an toàn của CORS nên đọc được.
 */
async function coLon(url) {
  const r = await fetch(url, { method: 'HEAD' });
  if (!r.ok) throw new Error(`Không đọc được ${url}: HTTP ${r.status}`);
  const n = Number(r.headers.get('content-length'));
  if (Number.isFinite(n) && n > 22) return n;
  throw new Error(
    'Máy chủ không cho biết kích thước file zip ' +
      '(HEAD không trả content-length đọc được)'
  );
}

/**
 * Mở zip từ xa. Trả về ĐÚNG bộ hàm như openZip() bên zip-store.js
 * (count, prefix, has, list, blob) nên chỗ gọi không phải phân biệt.
 */
export async function openZipRemote(url) {
  const size = await coLon(url);

  // ---- dò EOCD trong 64 KB cuối
  const tailStart = Math.max(0, size - EOCD_SEARCH_XA);
  const tail = new DataView(await khuc(url, tailStart, size));

  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD_XA) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Không phải file zip hợp lệ: thiếu EOCD');

  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);

  if (cdOffset === 0xffffffff || count === 0xffff) {
    throw new Error('Zip64 chưa hỗ trợ — nén lại bằng zip thường');
  }

  // ---- kéo cả bảng mục lục một lượt
  const cdBuf = await khuc(url, cdOffset, cdOffset + cdSize);
  const cd = new DataView(cdBuf);
  const utf8 = new TextDecoder('utf-8');

  const entries = new Map();
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (cd.getUint32(p, true) !== SIG_CD_XA) break;

    const method = cd.getUint16(p + 10, true);
    const compSize = cd.getUint32(p + 20, true);
    const rawSize = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const cmtLen = cd.getUint16(p + 32, true);
    const localAt = cd.getUint32(p + 42, true);

    const name = utf8.decode(new Uint8Array(cdBuf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + cmtLen;

    if (name.endsWith('/')) continue;
    if (name.startsWith('__MACOSX/') || name.endsWith('.DS_Store')) continue;

    entries.set(name, { method, compSize, rawSize, localAt });
  }

  if (entries.size === 0) throw new Error('Zip rỗng hoặc không đọc được mục nào');

  /* Tiền tố thư mục trong zip — tự dò như bản đọc đĩa. Zip hiện dùng nén cả
     thư mục gốc nên mục có dạng "muonlinejs-master/public/game-assets/…". */
  const MOC = 'game-assets/World1/EncTerrain1.map';
  let prefix = '';
  for (const name of entries.keys()) {
    if (name === MOC) { prefix = ''; break; }
    if (name.endsWith('/' + MOC)) {
      prefix = name.slice(0, name.length - MOC.length);
      break;
    }
  }

  return {
    get count() {
      return entries.size;
    },
    get prefix() {
      return prefix;
    },
    /** Cho biết đây là zip đọc từ xa — lớp trên dùng để ghi nhật ký cho đúng. */
    get tuXa() {
      return true;
    },
    get diaChi() {
      return url;
    },

    has(logicalPath) {
      return entries.has(prefix + logicalPath);
    },

    list() {
      const out = [];
      for (const k of entries.keys()) {
        out.push(prefix && k.startsWith(prefix) ? k.slice(prefix.length) : k);
      }
      return out;
    },

    async blob(logicalPath) {
      const e = entries.get(prefix + logicalPath);
      if (!e) return null;

      /* Một yêu cầu lấy cả đầu file lẫn dữ liệu. Trường extra ở đầu file có
         thể khác trường extra trong bảng mục lục, nên phải đọc đầu file mới
         biết dữ liệu bắt đầu ở đâu — nhưng xin dư sẵn thì khỏi đi hai lượt. */
      const tu = e.localAt;
      const den = Math.min(size, tu + 30 + DU_DAU + e.compSize);
      const buf = await khuc(url, tu, den);
      const dv = new DataView(buf);

      if (dv.getUint32(0, true) !== SIG_LOCAL_XA) {
        throw new Error(`Hỏng cấu trúc zip ở ${logicalPath}`);
      }
      const bo = 30 + dv.getUint16(26, true) + dv.getUint16(28, true);

      /* Trường extra dài hơn mức xin dư thì khúc vừa lấy bị thiếu đuôi — hiếm,
         nhưng cứ xin lại đúng khúc còn hơn trả ra file cụt. */
      let du = buf.slice(bo, bo + e.compSize);
      if (du.byteLength < e.compSize) {
        du = await khuc(url, tu + bo, tu + bo + e.compSize);
      }

      const raw = new Blob([du]);
      if (e.method === 0) return raw;
      if (e.method !== 8) {
        throw new Error(`Kiểu nén ${e.method} chưa hỗ trợ (${logicalPath})`);
      }
      const out = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(out).blob();
    },
  };
}

/**
 * Địa chỉ zip từ xa, đọc từ nơi NGƯỜI DÙNG NHÌN THẤY ĐƯỢC.
 *
 * Thứ tự: ?zipurl= trên URL → <meta name="mu-zip-url"> → window.MU_ZIP_URL.
 * Không có nguồn nào khác, không nhớ ngầm trong trình duyệt. Không khai thì
 * hàm trả null và game chạy hoàn toàn cục bộ như cũ.
 */
export function diaChiZipTuXa() {
  try {
    const q = new URLSearchParams(location.search).get('zipurl');
    if (q) return q;
  } catch {
    /* file:// không có search hợp lệ */
  }
  const meta = document.querySelector('meta[name="mu-zip-url"]');
  const m = meta?.getAttribute('content')?.trim();
  if (m) return m;
  const g = typeof window !== 'undefined' ? window.MU_ZIP_URL : null;
  return g || null;
}
