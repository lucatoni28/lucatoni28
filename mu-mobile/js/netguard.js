// Hàng rào mạng: KHÔNG cho bất cứ thứ gì đi ra ngoài máy. Không trừ gì cả.
//
// VÌ SAO KHÔNG CHỈ SỬA HẰNG SỐ: soi bản dựng thấy Babylon còn ba host nữa
// ngoài ra —
//   cdn.babylonjs.com      Tools._DefaultCdnUrl, KTX2 URLConfig, audio.png
//   snippet.babylonjs.com  SnippetUrl của vật liệu, hạt, hoạt ảnh
//   unpkg.com              FFLATEUrl (fflate cho phần xuất glTF)
// Mỗi lần nâng Babylon là danh sách ấy đổi. Sửa từng hằng số thì lần sau lại
// lọt. Chặn ở đúng ba cửa mà trình duyệt đi ra — fetch, XMLHttpRequest, và
// thuộc tính .src của <img>/<script> — thì thêm bao nhiêu hằng số cũng không
// thoát được.
//
// KHÔNG CHỪA PHÔNG NỮA: phông đã nhúng base64 trong index.html
// (tools/fetch-fonts.mjs sinh ra css/fonts.css), nên không còn lý do mở cửa
// cho fonts.googleapis.com hay fonts.gstatic.com. Danh sách cho phép để rỗng,
// mở lại chỉ cần thêm hostname vào đó.

import { DBG } from './debug.js';

/**
 * Host của file zip kho, nếu có khai ở <meta name="mu-zip-url"> hoặc ?zipurl=.
 *
 * Đọc lại tay ở đây thay vì gọi diaChiZipTuXa() bên zip-remote.js: hàng rào
 * phải cài NGAY khi trang nạp, trước mọi module khác, nên không được phụ thuộc
 * vào thứ tự nạp của ai cả.
 *
 * Chỉ lấy HOSTNAME, không phải cả đường dẫn — trình duyệt có thể đổi hướng
 * trong cùng miền, chặn theo đường dẫn là gãy.
 */
function hostZipTuXa() {
  try {
    let u = null;
    try {
      u = new URLSearchParams(location.search).get('zipurl');
    } catch {
      /* file:// không có search hợp lệ */
    }
    if (!u) {
      u = document
        .querySelector('meta[name="mu-zip-url"]')
        ?.getAttribute('content')
        ?.trim();
    }
    if (!u && typeof window !== 'undefined') u = window.MU_ZIP_URL;
    if (!u) return null;
    return new URL(u, document.baseURI).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Những host được phép ra ngoài.
 *
 * MẶC ĐỊNH RỖNG = khép kín hoàn toàn, không một byte nào rời khỏi máy.
 *
 * Chỉ có ĐÚNG MỘT cách mở cửa: khai địa chỉ file zip kho ở thẻ
 * <meta name="mu-zip-url"> đầu index.html (hoặc ?zipurl= trên URL). Khi ấy
 * host của chính địa chỉ đó — và chỉ host đó — được đi qua.
 *
 * Xoá nội dung thẻ meta là hàng rào đóng lại ngay, không phải dựng lại
 * img/mu.js. Không có danh sách cứng nào nhúng trong mã.
 */
const CHO_PHEP = [hostZipTuXa()].filter(Boolean);

/* URL bị chặn được đổi sang đường dẫn này — cùng nguồn nên chắc chắn 404, và
   404 thì mọi sự kiện lỗi của XHR/<img>/<script> bắn ra bình thường, bên gọi
   xử lý được. Ném lỗi thẳng thì nhiều chỗ trong Babylon không bắt, gãy cả
   khung hình. */
const NGO_CUT = '__netchan/';

/** Danh sách đã chặn, để bày ra trong nhật ký gỡ lỗi. */
export const DA_CHAN = new Map();

function cungNguon(url) {
  try {
    const u = new URL(url, document.baseURI);
    if (u.protocol === 'blob:' || u.protocol === 'data:' || u.protocol === 'about:') {
      return true;
    }
    if (u.protocol === 'file:') return true;
    return u.origin === location.origin;
  } catch {
    // Không phân giải được thì coi như đường dẫn tương đối — cùng nguồn.
    return true;
  }
}

function duocPhep(url) {
  try {
    const u = new URL(url, document.baseURI);
    return CHO_PHEP.includes(u.hostname);
  } catch {
    return false;
  }
}

/** true nếu phải chặn. Ghi nhật ký đúng một lần cho mỗi URL. */
function chan(url, tu) {
  if (typeof url !== 'string' || url === '') return false;
  if (cungNguon(url) || duocPhep(url)) return false;

  const n = (DA_CHAN.get(url) ?? 0) + 1;
  DA_CHAN.set(url, n);
  if (n === 1) DBG.net('chặn ra ngoài', `${tu} → ${url.slice(0, 150)}`);
  return true;
}

function ngoCut(url) {
  return NGO_CUT + encodeURIComponent(String(url).slice(0, 200));
}

export function installNetGuard() {
  if (typeof window === 'undefined') return;

  // ------------------------------------------------------------- fetch
  const fetchGoc = globalThis.fetch?.bind(globalThis);
  if (fetchGoc) {
    globalThis.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input?.url;
      if (chan(url, 'fetch')) {
        /* Bỏ hẳn statusText: HTTP chỉ nhận ISO-8859-1 nên tiếng Việt đặt ở đó
           làm new Response() ném TypeError. Lý do chặn đã ghi trong nhật ký gỡ
           lỗi (DBG.net), nơi tiếng Việt hiển thị được đầy đủ. */
        return Promise.resolve(new Response(null, { status: 523 }));
      }
      return fetchGoc(input, init);
    };
  }

  // --------------------------------------------------------------- XHR
  const XhrGoc = globalThis.XMLHttpRequest;
  if (XhrGoc) {
    class XhrChan extends XhrGoc {
      open(method, url, ...rest) {
        return super.open(method, chan(url, 'XHR') ? ngoCut(url) : url, ...rest);
      }
    }
    globalThis.XMLHttpRequest = XhrChan;
  }

  // ------------------------------------------------- <img> và <script>
  for (const [Lop, ten] of [
    [window.HTMLImageElement, 'img'],
    [window.HTMLScriptElement, 'script'],
  ]) {
    if (!Lop) continue;
    const d = Object.getOwnPropertyDescriptor(Lop.prototype, 'src');
    if (!d?.set) continue;

    Object.defineProperty(Lop.prototype, 'src', {
      configurable: true,
      enumerable: d.enumerable,
      get() {
        return d.get.call(this);
      },
      set(v) {
        d.set.call(this, chan(v, `<${ten}>`) ? ngoCut(v) : v);
      },
    });
  }

  DBG.info(
    'hàng rào mạng',
    CHO_PHEP.length
      ? `đã cài · MỞ CỬA cho ${CHO_PHEP.join(', ')} (do <meta name="mu-zip-url">)`
      : 'đã cài · KHÉP KÍN, không host nào ra ngoài được'
  );
}

installNetGuard();

if (typeof window !== 'undefined') window.MU_NETCHAN = DA_CHAN;
