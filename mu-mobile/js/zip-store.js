// Đọc asset thẳng từ một file .zip nằm trong img/.
//
// VÌ SAO CẦN: JSAnywhere trên iOS chỉ cho nạp TỪNG FILE vào img/, không nạp cả
// thư mục. Bộ asset có 11.996 file — nạp tay là bất khả thi. Một file zip thì
// nạp đúng một lần.
//
// VÌ SAO KHÔNG BUNG HẾT RA BỘ NHỚ: zip 288 MB, giải nén 630 MB. Giữ chừng ấy
// trong RAM là Safari giết tab. Cách làm ở đây:
//
//   1. fetch() rồi lấy .blob() — KHÔNG lấy .arrayBuffer(). Safari đẩy Blob lớn
//      xuống đĩa, RAM gần như không tốn gì.
//   2. Đọc bảng mục lục ở CUỐI file zip → biết mỗi file nằm ở byte thứ mấy.
//   3. Cần file nào thì blob.slice() đúng khúc đó rồi bung.
//
// Nhờ vậy không cần server hỗ trợ HTTP Range: chỉ một lần tải, sau đó đọc đĩa.
//
// BUNG NÉN KHÔNG CẦN THƯ VIỆN: DecompressionStream('deflate-raw') là API sẵn
// của trình duyệt (Safari 16.4+, iOS 16.4+). Mục trong zip nén bằng raw deflate
// nên dùng thẳng được, khỏi nhét fflate hay pako vào bundle.

const SIG_EOCD = 0x06054b50;   // End Of Central Directory
const SIG_CD = 0x02014b50;     // một mục trong bảng mục lục
const SIG_LOCAL = 0x04034b50;  // đầu mỗi file trong zip

// EOCD dài 22 byte, phần chú thích tối đa 65535 → chỉ cần dò 64 KB cuối.
const EOCD_SEARCH = 66000;

/** Đọc một khúc Blob ra DataView. */
async function view(blob, start, end) {
  const buf = await blob.slice(start, end).arrayBuffer();
  return new DataView(buf);
}

/**
 * Mở một file zip và đọc bảng mục lục.
 * Trả về đối tượng có .has(), .bytes(), .url(), .list().
 */
export async function openZip(blob) {
  const size = blob.size;

  // ---- tìm EOCD bằng cách dò ngược 64 KB cuối
  const tailStart = Math.max(0, size - EOCD_SEARCH);
  const tail = await view(blob, tailStart, size);

  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Không phải file zip hợp lệ: thiếu EOCD');

  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);

  // Zip64 dùng khi quá 65535 mục hoặc quá 4 GB. Bộ asset 12.340 mục / 630 MB
  // chưa chạm ngưỡng, nhưng cứ báo rõ thay vì đọc bậy ra số rác.
  if (cdOffset === 0xffffffff || count === 0xffff) {
    throw new Error('Zip64 chưa hỗ trợ — nén lại bằng zip thường');
  }

  // ---- đọc cả bảng mục lục một lần (khoảng 1 MB cho 12 nghìn mục)
  const cd = await view(blob, cdOffset, cdOffset + cdSize);
  const utf8 = new TextDecoder('utf-8');

  const entries = new Map();
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (cd.getUint32(p, true) !== SIG_CD) break;

    const method = cd.getUint16(p + 10, true);
    const compSize = cd.getUint32(p + 20, true);
    const rawSize = cd.getUint32(p + 24, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const cmtLen = cd.getUint16(p + 32, true);
    const localAt = cd.getUint32(p + 42, true);

    const name = utf8.decode(
      new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen)
    );

    p += 46 + nameLen + extraLen + cmtLen;

    // Bỏ thư mục và rác macOS tự nhét vào khi nén.
    if (name.endsWith('/')) continue;
    if (name.startsWith('__MACOSX/') || name.endsWith('.DS_Store')) continue;

    entries.set(name, { method, compSize, rawSize, localAt });
  }

  if (entries.size === 0) throw new Error('Zip rỗng hoặc không đọc được mục nào');

  /**
   * Tiền tố thư mục bên trong zip — tự dò, không bắt người dùng nén đúng kiểu.
   * Nén từ thư mục public/ thì mục là "game-assets/World1/…", nén cả thư mục
   * cha thì thành "public/game-assets/…" hoặc "engine/public/game-assets/…".
   * Lấy một file chắc chắn có rồi cắt ngược ra tiền tố.
   */
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
    /** Số mục đọc được. */
    get count() {
      return entries.size;
    },

    /** Tiền tố đã dò được ('' nếu zip nén từ đúng thư mục public/). */
    get prefix() {
      return prefix;
    },

    /** Đường dẫn logic có trong zip không. */
    has(logicalPath) {
      return entries.has(prefix + logicalPath);
    },

    /** Danh sách mọi mục (đã bỏ tiền tố). */
    list() {
      const out = [];
      for (const k of entries.keys()) {
        out.push(prefix && k.startsWith(prefix) ? k.slice(prefix.length) : k);
      }
      return out;
    },

    /** Lấy nội dung một file ra Blob. */
    async blob(logicalPath) {
      const e = entries.get(prefix + logicalPath);
      if (!e) return null;

      // Trường extra của đầu file CÓ THỂ khác trường extra trong bảng mục lục,
      // nên phải đọc lại đầu file mới biết dữ liệu bắt đầu ở đâu.
      const lh = await view(blob, e.localAt, e.localAt + 30);
      if (lh.getUint32(0, true) !== SIG_LOCAL) {
        throw new Error(`Hỏng cấu trúc zip ở ${logicalPath}`);
      }
      const dataAt =
        e.localAt + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);

      const raw = blob.slice(dataAt, dataAt + e.compSize);

      if (e.method === 0) return raw;              // lưu thẳng, khỏi bung
      if (e.method !== 8) {
        throw new Error(`Kiểu nén ${e.method} chưa hỗ trợ (${logicalPath})`);
      }

      const out = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return await new Response(out).blob();
    },
  };
}

/** Trình duyệt có bung được deflate không. Thiếu là hỏng ngay từ đầu. */
export function zipSupported() {
  return typeof DecompressionStream === 'function';
}
