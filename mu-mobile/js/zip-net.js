// Phục vụ asset trong zip cho ba đường nạp của trình duyệt.
//
// VÌ SAO CẦN: engine hỏi đường dẫn theo kiểu ĐỒNG BỘ — resolveUrlToDataFolder()
// phải trả về một chuỗi ngay lập tức — mà bung một mục trong zip lại là việc
// BẤT ĐỒNG BỘ. Bản trước giải quyết bằng cách bung sẵn cả bản đồ ra blob URL,
// nhưng cách ấy chỉ đủ cho World*/Object*: model nhân vật (60 MB), quái
// (144 MB), vật phẩm (28 MB), NPC (27 MB), âm thanh (27 MB) và decoder đều nạp
// theo nhu cầu lúc chạy, không biết trước file nào để mà bung sẵn. Bung hết là
// 532 MB — Safari giết tab.
//
// CÁCH LÀM: đường dẫn trong zip được trả về dưới dạng một URL "giả" cùng nguồn
//
//     http://<trang>/__muzip/game-assets/Player/ArmorMale01.glb
//
// rồi chặn đúng ba chỗ trình duyệt đi lấy dữ liệu — fetch(), XMLHttpRequest và
// thuộc tính .src của <img> — để đọc thẳng từ zip. URL giả không bao giờ ra tới
// mạng: nó bị chặn từ trước.
//
// Nhờ đó mọi asset đều chạy được qua zip mà không phải bung sẵn thứ gì, và
// cũng không phải sửa engine thêm lần nào nữa.
//
// GIỚI HẠN ĐÃ BIẾT: url() trong CSS thì KHÔNG chặn được — trình duyệt tự đi lấy,
// không qua fetch/XHR/Image. Chỗ nào cần đưa ảnh vào CSS (nền radar, bản đồ to)
// phải xin blob URL thật bằng MU_ASSETS.blobUrl(), xem js/asset-paths.js.

const MARK = '__muzip/';

/** Đường dẫn logic → URL giả cùng nguồn. */
export function zipUrl(base, logicalPath) {
  const enc = logicalPath
    .replace(/^\/+/, '')
    .split('/')
    .map(encodeURIComponent)
    .join('/');
  return base + MARK + enc;
}

/** URL giả → đường dẫn logic, hoặc null nếu không phải URL của zip. */
export function zipPathOf(url) {
  const i = url.indexOf(MARK);
  if (i < 0) return null;
  let p = url.slice(i + MARK.length);
  // Cắt tham số và neo. Dấu # trong TÊN FILE đã được mã hoá thành %23 từ
  // trước (Babylon tự làm trong CleanUrl), nên dấu # còn sót lại là neo thật.
  const q = p.search(/[?#]/);
  if (q >= 0) p = p.slice(0, q);
  try {
    return decodeURIComponent(p);
  } catch {
    return p;
  }
}

const MIME = {
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tga: 'image/x-tga',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  wasm: 'application/wasm',
  js: 'text/javascript',
  json: 'application/json',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
};

function mimeOf(path) {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

/**
 * Cài cả ba lớp chặn.
 *
 * @param read     (path) => Promise<Blob|null> — đọc một mục trong zip.
 * @param fallback (path) => string — URL dự phòng khi zip không có mục đó.
 */
export function installZipNet(read, fallback) {
  installFetch(read, fallback);
  installXhr(read, fallback);
  installImage(read, fallback);
}

// ------------------------------------------------------------------- fetch
function installFetch(read, fallback) {
  const original = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    const path = typeof url === 'string' ? zipPathOf(url) : null;
    if (path === null) return original(input, init);

    const blob = await read(path);
    if (!blob) return original(fallback(path), init);

    return new Response(blob, {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': blob.type || mimeOf(path),
        'Content-Length': String(blob.size),
      },
    });
  };
}

// --------------------------------------------------------------------- XHR
//
// Không dựng lại XHR giả: chỉ HOÃN lời gọi open() thật cho tới lúc send(), rồi
// mở lại trên một blob URL. Nhờ vậy readyState, status, response, các sự kiện
// progress/loadend/readystatechange đều là hàng thật của trình duyệt — đúng
// những thứ Babylon dựa vào trong RequestFile().
//
// Được phép hoãn vì giữa open() và send() Babylon chỉ đặt responseType và gắn
// sự kiện; cả hai đều hợp lệ khi XHR còn ở trạng thái UNSENT.
function installXhr(read, fallback) {
  const Native = globalThis.XMLHttpRequest;

  class MuZipXhr extends Native {
    open(method, url, ...rest) {
      const path = typeof url === 'string' ? zipPathOf(url) : null;
      if (path === null) {
        this.__muPath = null;
        return super.open(method, url, ...rest);
      }
      this.__muPath = path;
      this.__muMethod = method || 'GET';
      this.__muHeaders = [];
      this.__muAborted = false;
    }

    setRequestHeader(name, value) {
      // Chưa open() thật thì chưa đặt được, giữ lại đặt sau.
      if (this.__muPath) {
        this.__muHeaders.push([name, value]);
        return;
      }
      return super.setRequestHeader(name, value);
    }

    abort() {
      this.__muAborted = true;
      return super.abort();
    }

    send(body) {
      const path = this.__muPath;
      if (!path) return super.send(body);

      read(path)
        .then(blob => {
          if (this.__muAborted) return;

          const url = blob ? URL.createObjectURL(blob) : fallback(path);
          if (blob) {
            this.addEventListener('loadend', () => URL.revokeObjectURL(url), {
              once: true,
            });
          }

          super.open(this.__muMethod, url, true);
          for (const [n, v] of this.__muHeaders) {
            try {
              super.setRequestHeader(n, v);
            } catch {
              /* blob URL không nhận header — bỏ qua */
            }
          }
          super.send();
        })
        .catch(() => {
          if (this.__muAborted) return;
          super.open(this.__muMethod, fallback(path), true);
          super.send();
        });
    }
  }

  globalThis.XMLHttpRequest = MuZipXhr;
}

// ------------------------------------------------------------------- <img>
//
// Babylon nạp texture bằng `new Image(); img.src = url` (Tools.LoadImage), còn
// giao diện thì gắn icon vật phẩm y hệt. Bọc chính thuộc tính .src: thấy URL
// của zip thì chưa gán vội, bung xong mới gán blob URL thật vào.
/* Đệm blob URL cho <img>, khoá theo đường dẫn logic.
   -------------------------------------------------------------------------
   LỖI ĐÃ SỬA: bản trước cấp một blob URL mới cho MỖI thẻ <img> rồi thu hồi
   ngay trong sự kiện 'load'. Ảnh đã hiện thì không sao, nhưng .src của thẻ vẫn
   trỏ vào URL đã chết — nên khi trình duyệt cần lấy LẠI (đóng rồi mở lại một
   panel là thẻ bị gỡ ra gắn vào, trình duyệt đi lấy lại từ đầu) thì hỏng với
   net::ERR_FILE_NOT_FOUND. Đo được đúng một lần trong lượt soát toàn bộ.

   Cách sửa: một đường dẫn dùng chung MỘT url, giữ sống để lần lấy lại còn
   thấy. Có trần LRU nên không hoá rò bộ nhớ — texture Babylon nạp một lần rồi
   đẩy lên GPU, nguội dần và bị đẩy ra; icon giao diện dùng đi dùng lại nên
   luôn nằm trong đệm. Trần 400 đủ rộng: túi 64 ô + 12 ô trang bị + 5 ô thanh
   bar mới là 81 icon. */
const TRAN_ANH = 400;
const khoAnh = new Map();

function urlAnh(path, blob) {
  const co = khoAnh.get(path);
  if (co) {
    // Đụng lại thì đẩy xuống cuối hàng — Map giữ đúng thứ tự chèn nên xoá rồi
    // đặt lại là cách gọn nhất để có LRU.
    khoAnh.delete(path);
    khoAnh.set(path, co);
    return co;
  }
  const url = URL.createObjectURL(blob);
  khoAnh.set(path, url);
  while (khoAnh.size > TRAN_ANH) {
    const cu = khoAnh.keys().next().value;
    URL.revokeObjectURL(khoAnh.get(cu));
    khoAnh.delete(cu);
  }
  return url;
}

function installImage(read, fallback) {
  const proto = HTMLImageElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'src');
  if (!desc || !desc.set) return;

  /* React (giao diện gốc của engine) gắn ảnh bằng setAttribute('src', …) chứ
     không gán thuộc tính, nên lớp bọc dưới đây bị lọt. Đây đúng là chỗ bốn
     icon bình thuốc item_14_*.png vẫn chui ra mạng ở lần chạy thử trước.
     Đẩy setAttribute về đúng đường thuộc tính là xong. */
  const nativeSetAttr = proto.setAttribute;
  proto.setAttribute = function (name, value) {
    if (String(name).toLowerCase() === 'src') {
      this.src = value;
      return;
    }
    return nativeSetAttr.call(this, name, value);
  };

  Object.defineProperty(proto, 'src', {
    configurable: true,
    enumerable: desc.enumerable,

    // Trả lại đúng URL người gọi đã đặt, không phải blob URL nội bộ — Babylon
    // đọc lại .src để in thông báo lỗi.
    get() {
      return this.__muSrc ?? desc.get.call(this);
    },

    set(value) {
      const path = typeof value === 'string' ? zipPathOf(value) : null;
      if (path === null) {
        this.__muSrc = undefined;
        desc.set.call(this, value);
        return;
      }

      this.__muSrc = value;
      // Gán src nhiều lần liên tiếp (onerror lùi về icon gốc) thì chỉ lần cuối
      // được tính.
      const tem = (this.__muTem = (this.__muTem | 0) + 1);

      read(path)
        .then(blob => {
          if (this.__muTem !== tem) return;
          if (!blob) {
            desc.set.call(this, fallback(path));
            return;
          }
          desc.set.call(this, urlAnh(path, blob));
        })
        .catch(() => {
          if (this.__muTem === tem) desc.set.call(this, fallback(path));
        });
    },
  });
}
