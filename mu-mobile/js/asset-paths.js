// Bộ phân giải đường dẫn asset cho MU Mobile.
//
// CHỈ DÙNG ĐƯỜNG DẪN NỘI BỘ. Mọi lối ra CDN của nguồn ngoài đã cắt: không còn
// kho trên mạng ở bất cứ đâu, không còn chế độ 'cdn', không còn
// lùi ra mạng khi thiếu file. Thiếu thì GHI VÀO NHẬT KÝ GỠ LỖI để còn biết
// đường bổ sung, chứ không lặng lẽ đi mượn.
//
// Mọi asset có đúng MỘT đường dẫn logic, khớp cây public/ của bản gốc:
//   game-assets/World1/EncTerrain1.map
//   game-assets/Player/ArmorMale01.glb
//   items/item_0_0_0.png
//   js/draco_decoder_gltf.wasm
//   fonts/segoeuib.woff2
//
// BA nguồn nạp, đều nằm trong máy:
//   folder  <MU_FOLDER>/<logic>   ← public/game-assets/World1/EncTerrain1.map
//   zip     img/assets.zip — đọc thẳng trong file nén, xem js/zip-store.js
//   flat    img/<logic đã thay "/" bằng "_">  ← img/game-assets_World1_EncTerrain1.map
//
// 'folder' là MẶC ĐỊNH và đơn giản nhất: giữ nguyên cây thư mục gốc, không
// đổi tên, không nén. Dùng khi chạy từ máy tính hoặc từ một máy chủ tĩnh.
//
// 'zip' sinh ra vì JSAnywhere trên iOS chỉ cho nạp TỪNG file vào img/, không
// nạp cả thư mục — 12 nghìn file thì chịu, một file zip thì xong.
//
// 'flat' là lối thoát cuối: iOS không cho thư mục con thì đổ hết vào img/ với
// tên đã dẹp phẳng.

import { zipUrl } from './zip-net.js';
import { suaHoaThuong } from './asset-manifest.js';
import { DBG } from './debug.js';

const FLAT_BASE = 'img/';

/* Gốc cây thư mục asset ở chế độ 'folder'. Đổi được từ ngoài mà không phải
   dựng lại: đặt window.MU_FOLDER trước khi nạp script.js, hoặc thêm
   ?folder=... trên URL. Luôn kết thúc bằng dấu '/'. */
const FOLDER_MAC_DINH = 'public/';

function goc() {
  let v = null;
  let tu = 'mặc định';
  try {
    v = new URLSearchParams(location.search).get('folder');
    if (v) tu = '?folder=';
  } catch {
    /* file:// không có search hợp lệ */
  }
  if (!v && typeof window !== 'undefined' && typeof window.MU_FOLDER === 'string') {
    v = window.MU_FOLDER;
    tu = 'window.MU_FOLDER';
  }
  if (!v && typeof document !== 'undefined') {
    // Thẻ <meta name="mu-folder"> trong index.html — chỗ sửa tên thư mục mà
    // KHÔNG phải dựng lại script.js và cũng không cần mã nội tuyến nào.
    const m = document.querySelector('meta[name="mu-folder"]');
    if (m?.content) {
      v = m.content;
      tu = '<meta name="mu-folder">';
    }
  }
  v = (v || FOLDER_MAC_DINH).trim();
  if (!v.endsWith('/')) v += '/';
  GOC_TU = tu;
  return v;
}

let GOC_TU = 'mặc định';


/** Nơi tìm file nén. Đường dẫn cố định vì JSAnywhere buộc nạp vào img/. */
export const ZIP_PATH = 'img/assets.zip';

/** Đường dẫn logic → tên phẳng dưới img/. */
export function flatName(logicalPath) {
  return logicalPath.replace(/^\/+/, '').replace(/\//g, '_');
}

function urlFor(logicalPath) {
  return FLAT_BASE + flatName(logicalPath.replace(/^\/+/, ''));
}

/** Chế độ người dùng ép buộc, nếu có. */
const CHE_DO = ['folder', 'zip', 'flat'];

/* Chế độ đến từ đâu — CHỈ hai nguồn, cả hai đều NHÌN THẤY ĐƯỢC:
     1. ?assets=... trên URL           (tạm, cho một lần mở)
     2. <meta name="mu-source">        (cố định, sửa thẳng trong index.html)

   KHÔNG dùng localStorage nữa, và đây là chủ ý. Trạng thái nhớ ngầm trong
   trình duyệt là thứ đè lên mặc định mà không ai nhìn thấy, không sửa được
   bằng cách mở file ra đọc — đúng kiểu "khoá ngầm" cần tránh. Muốn đổi chế
   độ thì sửa một dòng trong index.html, đọc là biết. */
function forcedMode() {
  return forcedModeTuUrl() ?? forcedModeTuMeta();
}

/** Chế độ ép bằng ?assets= trên URL — ý muốn tức thời, mạnh nhất. */
function forcedModeTuUrl() {
  try {
    const q = new URLSearchParams(location.search).get('assets');
    if (CHE_DO.includes(q)) return q;
  } catch {
    /* file:// không có search hợp lệ — bỏ qua */
  }
  return null;
}

/** Chế độ ép bằng <meta name="mu-source"> — mặc định ghi sẵn trong trang. */
function forcedModeTuMeta() {
  if (typeof document !== 'undefined') {
    const m = document.querySelector('meta[name="mu-source"]');
    if (m && CHE_DO.includes(m.content)) return m.content;
  }
  return null;
}

export const MU_ASSETS = {
  FLAT_BASE,

  /** 'folder' | 'zip' | 'flat' — chốt một lần khi boot, xem probe(). */
  mode: 'folder',

  /** Gốc cây thư mục ở chế độ 'folder'. Tính một lần lúc nạp. */
  FOLDER_BASE: goc(),

  /**
   * Những đường dẫn logic mà kho KHÔNG CÓ.
   * Trước đây chỗ thiếu được lặng lẽ lấy từ CDN ngoài nên chẳng ai biết kho
   * của mình hụt gì. Nay ghi lại hết, hiện ra trong nhật ký gỡ lỗi.
   */
  thieu: new Set(),

  /** Kho zip đã mở, nếu chạy ở chế độ 'zip'. */
  zip: null,

  /**
   * Đệm nội dung đã bung: đường-dẫn-logic → Blob.
   *
   * Đệm BLOB chứ không đệm blob URL. Đã thử đệm URL và hỏng: blob URL không có
   * phần mở rộng, mà SceneLoader của Babylon chọn trình đọc THEO ĐUÔI FILE —
   * mọi .glb đều báo "Unable to find a plugin to load ... files". URL giả
   * __muzip/ giữ nguyên đuôi nên không dính lỗi đó, còn đệm blob thì giúp
   * nạp trước cả bản đồ vẫn có tác dụng: mỗi mục chỉ bung một lần.
   */
  cache: new Map(),

  /** Blob URL thật đã cấp cho CSS (nền radar, bản đồ to, phông chữ). */
  urls: new Map(),

  /** true khi mode do người dùng ép, không phải do thăm dò. */
  forced: false,

  /** Gốc URL giả của zip — thư mục chứa trang, tính một lần. */
  get zipBase() {
    if (!this._zipBase) {
      let b = '';
      try {
        b = new URL('.', document.baseURI).href;
      } catch {
        b = '';
      }
      this._zipBase = b;
    }
    return this._zipBase;
  },

  /** Phân giải một đường dẫn logic đầy đủ. ĐỒNG BỘ — engine đòi vậy. */
  resolve(logicalPath) {
    // Sửa lệch hoa-thường TRƯỚC mọi thứ: cả ba chế độ (folder, zip, flat) đều
    // phân biệt hoa thường, mà bảng vật phẩm của MU thì không. Xem
    // suaHoaThuong() trong js/asset-manifest.js.
    const clean = suaHoaThuong(logicalPath.replace(/^\/+/, ''));
    // Chế độ thư mục: đường dẫn logic CHÍNH LÀ đường dẫn trên đĩa, chỉ thêm
    // gốc vào trước. Không đổi tên, không chặn, không bung — nhẹ nhất.
    if (this.mode === 'folder') return this.FOLDER_BASE + clean;
    if (this.mode === 'zip' && this.zip) {
      // URL giả, giữ nguyên đuôi file; js/zip-net.js chặn lại và đọc từ zip.
      if (this.zip.has(clean)) return zipUrl(this.zipBase, clean);
      // Zip không có mục này thì lùi về img/ phẳng — vẫn trong máy. Ghi lại để
      // còn biết kho hụt gì.
      this.ghiThieu(clean);
    }
    return urlFor(clean);
  },

  /**
   * Blob URL THẬT của một mục trong zip, có nhớ lại.
   *
   * Chỉ dùng cho chỗ nào bắt buộc phải có URL thật: url() trong CSS không đi
   * qua fetch/XHR/Image nên lớp chặn không với tới (nền radar, bản đồ to,
   * @font-face). Mọi chỗ khác cứ dùng resolve() cho nhẹ bộ nhớ.
   */
  async blobUrl(logicalPath) {
    const clean = logicalPath.replace(/^\/+/, '');
    const co = this.urls.get(clean);
    if (co) return co;
    if (this.mode !== 'zip' || !this.zip) return this.resolve(clean);

    const b = await this.readZip(clean).catch(() => null);
    if (!b) {
      this.ghiThieu(clean);
      return urlFor(clean);
    }

    const u = URL.createObjectURL(b);
    this.urls.set(clean, u);
    return u;
  },

  /**
   * Đọc một mục trong zip ra Blob — lớp chặn ở js/zip-net.js gọi hàm này.
   * Có trong đệm thì lấy đệm, không thì bung (KHÔNG tự nhét vào đệm: chỉ
   * preloadMap mới được nhét, để còn biết lúc nào thả ra).
   */
  async readZip(logicalPath) {
    if (!this.zip) return null;
    const c = this.cache.get(logicalPath);
    if (c) return c;
    return this.zip.blob(logicalPath);
  },

  /** Ghi nhận một đường dẫn kho không có. Mỗi đường dẫn chỉ kêu một lần. */
  ghiThieu(logicalPath) {
    if (this.thieu.has(logicalPath)) return;
    this.thieu.add(logicalPath);
    DBG.warn('kho thiếu', logicalPath);
  },

  /**
   * Engine gọi hàm này với đường dẫn tương đối gốc game-assets
   * ('World1/EncTerrain1.map', 'Player/ArmorMale01.glb', 'Sound/death1.ogg').
   * Chèn vào chỗ resolveUrlToDataFolder() của bundle.
   */
  game(relPath) {
    if (
      relPath.startsWith('http://') ||
      relPath.startsWith('https://') ||
      relPath.startsWith('base64:') ||
      relPath.startsWith('data:') ||
      relPath.startsWith('blob:')
    ) {
      return relPath;
    }
    return this.resolve('game-assets/' + relPath.replace(/^[./]+/, ''));
  },

  /* Ba tiền tố dưới đây được nối thẳng với tên file ở nơi khác, nên phải là
     CHUỖI, không thể là blob URL của từng mục. Chế độ zip dùng được vì URL giả
     cũng chỉ là một tiền tố — lớp chặn tự bung khi có ai đi lấy. */

  /** Icon vật phẩm — nơi gọi nối tiếp 'item_<nhóm>_<số>_<cấp>.png'. */
  get itemsBase() {
    if (this.mode === 'folder') return this.FOLDER_BASE + 'items/';
    if (this.mode === 'zip' && this.zip) return zipUrl(this.zipBase, 'items/');
    return FLAT_BASE + 'items_';
  },

  /** Thư mục decoder của Babylon (draco / ktx2 / basis).
      Bộ asset này KHÔNG dùng tới: đã dò cả 2.443 file .glb, không file nào khai
      KHR_draco_mesh_compression, KHR_texture_basisu hay EXT_meshopt. Vẫn trỏ
      đúng chỗ để bản khác thay asset vào là chạy, khỏi phải sửa. */
  get decoderBase() {
    if (this.mode === 'folder') return this.FOLDER_BASE + 'js/';
    if (this.mode === 'zip' && this.zip) return zipUrl(this.zipBase, 'js/');
    return FLAT_BASE + 'js_';
  },

  /** Nguồn @font-face cho Segoe UI của MU. */
  get fontBase() {
    if (this.mode === 'folder') return this.FOLDER_BASE + 'fonts/';
    if (this.mode === 'zip' && this.zip) return zipUrl(this.zipBase, 'fonts/');
    return FLAT_BASE + 'fonts_';
  },

  /**
   * Chốt nguồn nạp — ĐỒNG BỘ, không dò mạng.
   *
   * Trang chạy bằng script cổ điển (để mở được trên iOS qua file://), giữa các
   * thẻ <script> không chờ await được, mà engine cần biết nguồn ngay lúc khởi
   * động. Thứ tự: ?assets= trên URL → <meta name="mu-source"> →
   * window.MU_SOURCE → mặc định 'folder'. Không nguồn nào đi ra mạng, và
   * không nguồn nào nằm ngầm trong trình duyệt.
   */
  probe() {
    // Zip đã mở thì giữ nguyên. bootEngine() gọi probe() SAU openZipSource(),
    // không chặn ở đây là chế độ zip bị ghi đè mất ngay khi vừa mở xong.
    const ep = forcedMode();

    /* Zip ĐÃ MỞ được thì giữ nguyên, trừ khi ?assets= trên URL bảo khác.
       Thẻ <meta name="mu-source"> KHÔNG lật được: nó ghi "folder" sẵn trong
       mọi bản dựng, mà zip chỉ mở khi người dùng tự khai địa chỉ ở
       <meta name="mu-zip-url"> — lời khai sau cụ thể hơn, phải thắng.

       Lỗi đã gặp: mở zip từ xa xong, đọc được 12.209 mục, rồi probe() chạy
       sau và lật về "folder", thế là cả kho vừa mở thành vô dụng. */
    if (this.mode === 'zip' && this.zip) {
      const tuUrl = forcedModeTuUrl();
      if (!tuUrl || tuUrl === 'zip') return this.mode;
    }
    if (this.mode === 'zip' && this.zip && !ep) return this.mode;

    if (ep === 'flat' || ep === 'folder' || (ep === 'zip' && this.zip)) {
      this.mode = ep;
      this.forced = true;
      // Nói rõ AI ép: lẫn giữa "?assets= trên URL" và "trình duyệt nhớ từ lần
      // trước" là chỗ dễ mất cả buổi để tìm.
      let tu = '<meta name="mu-source">';
      try {
        if (new URLSearchParams(location.search).get('assets') === ep) tu = '?assets= trên URL';
      } catch {
        /* file:// */
      }
      DBG.info('nguồn', `ép bằng ${tu} → ${this.mode}`);
      return this.mode;
    }

    const g = typeof window !== 'undefined' ? window.MU_SOURCE : null;
    if (g === 'flat' || g === 'folder') {
      this.mode = g;
      this.forced = true;
      DBG.info('nguồn', `ép bằng MU_SOURCE → ${g}`);
      return this.mode;
    }

    // Không có zip thì đọc thẳng cây thư mục — đây là cách dùng thường ngày.
    this.mode = 'folder';
    DBG.info('nguồn', `mặc định → đọc thư mục "${this.FOLDER_BASE}" (đặt bởi ${GOC_TU})`);
    return this.mode;
  },

  /**
   * Thử mở img/assets.zip. Có thì chuyển sang chế độ 'zip' và trả về số mục
   * đọc được; không có thì trả 0 và giữ nguyên chế độ cũ.
   *
   * Gọi lúc khởi động, TRƯỚC khi vào thế giới — mở zip là việc bất đồng bộ nên
   * không nhét vào probe() được.
   */
  async openZipSource(fetchZip, open, path = ZIP_PATH) {
    try {
      const res = await fetchZip(path);
      if (!res.ok) {
        DBG.warn('zip', `${path} trả về HTTP ${res.status}`);
        return 0;
      }

      // .blob() chứ KHÔNG .arrayBuffer(): Safari đẩy Blob lớn xuống đĩa, còn
      // arrayBuffer là nhét thẳng 288 MB vào RAM.
      const b = await res.blob();
      DBG.info('zip', `${path} · ${(b.size / 1048576).toFixed(1)} MB, đang đọc mục lục`);
      const z = await open(b);
      this.zip = z;
      this.mode = 'zip';
      this.forced = true;
      DBG.info('zip', `đọc được ${z.count} mục · tiền tố "${z.prefix}"`);
      return z.count;
    } catch (e) {
      DBG.error('zip', `mở ${path} hỏng`, e);
      return 0;
    }
  },

};

/**
 * Trước đây chỗ này có installFetchFallback(): request hụt ở CDN thì thử lại ở
 * img/. Đã bỏ cùng với CDN — nay chỉ còn một nguồn trong máy, không còn gì để
 * lùi về. Thiếu file thì ghiThieu() ghi lại, xem nhật ký gỡ lỗi.
 */

if (typeof window !== 'undefined') window.MU_ASSETS = MU_ASSETS;
