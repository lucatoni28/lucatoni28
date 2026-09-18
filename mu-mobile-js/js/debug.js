// Lớp gỡ lỗi. Giữ nhật ký TRONG BỘ NHỚ để hiện lên màn hình.
// Không gửi đi đâu, không ghi vào trình duyệt.
//
// Mặc định TẮT. Bật bằng ?debug=1 trên URL, hoặc window.MU_DEBUG = true.

/** Giữ tối đa bấy nhiêu dòng. Vượt thì bỏ dòng cũ nhất. */
const MAX = 800;

function batDau() {
  try {
    const q = new URLSearchParams(location.search).get('debug');
    if (q === '1' || q === 'on') return true;
    if (q === '0' || q === 'off') return false;
  } catch {
    /* file:// không có search hợp lệ */
  }
  if (typeof window !== 'undefined' && typeof window.MU_DEBUG === 'boolean') {
    return window.MU_DEBUG;
  }
  return false;
}

const t0 = Date.now();

export const DBG = {
  on: batDau(),

  /** Vòng đệm các dòng đã ghi. */
  buf: [],

  /** Đếm theo loại, để nhìn một cái là biết có lỗi hay không. */
  dem: { loi: 0, canh: 0, mang: 0 },

  /** Ai muốn nghe thêm (giao diện gắn vào để hiện ra khung nhật ký). */
  _nghe: new Set(),

  onLine(fn) {
    this._nghe.add(fn);
    return () => this._nghe.delete(fn);
  },

  /**
   * Ghi một dòng.
   * @param muc  'info' | 'warn' | 'error' | 'net'
   * @param tag  nhãn ngắn cho biết dòng này từ đâu ra
   */
  log(muc, tag, ...phan) {
    const gio = ((Date.now() - t0) / 1000).toFixed(2).padStart(7, ' ');
    const chu = phan
      .map(p => {
        if (typeof p === 'string') return p;
        if (p instanceof Error) return `${p.name}: ${p.message}\n${p.stack ?? ''}`;
        try {
          return JSON.stringify(p);
        } catch {
          return String(p);
        }
      })
      .join(' ');

    const dong = `${gio}s [${muc}] ${tag}: ${chu}`;

    if (muc === 'error') this.dem.loi++;
    else if (muc === 'warn') this.dem.canh++;
    else if (muc === 'net') this.dem.mang++;

    this.buf.push(dong);
    if (this.buf.length > MAX) this.buf.shift();

    for (const fn of this._nghe) {
      try {
        fn(dong, muc, tag);
      } catch {
        /* một người nghe hỏng không được kéo cả hệ thống theo */
      }
    }
    return dong;
  },

  info(tag, ...p) {
    return this.log('info', tag, ...p);
  },
  warn(tag, ...p) {
    return this.log('warn', tag, ...p);
  },
  error(tag, ...p) {
    return this.log('error', tag, ...p);
  },
  net(tag, ...p) {
    return this.log('net', tag, ...p);
  },

  setOn(v) {
    this.on = !!v;
    this.info('gỡ lỗi', v ? 'BẬT' : 'TẮT');
  },

  clear() {
    this.buf.length = 0;
    this.dem = { loi: 0, canh: 0, mang: 0 };
  },

  /** Toàn bộ nhật ký kèm thông tin máy, dạng chép gửi đi được. */
  dump() {
    const m = [];
    m.push('===== MU MOBILE · NHẬT KÝ GỠ LỖI =====');
    m.push(`lúc            ${new Date().toISOString()}`);
    m.push(`chạy được      ${((Date.now() - t0) / 1000).toFixed(1)} giây`);
    try {
      m.push(`trang          ${location.href}`);
    } catch {
      m.push('trang          (không đọc được)');
    }
    m.push(`màn            ${innerWidth}×${innerHeight} · DPR ${devicePixelRatio}`);

    const A = typeof window !== 'undefined' ? window.MU_ASSETS : null;
    if (A) {
      m.push(`nguồn dữ liệu  ${A.GOC}`);
      if (A.thieu?.size) {
        m.push(`THIẾU TRONG KHO ${A.thieu.size} mục:`);
        for (const p of [...A.thieu].slice(0, 40)) m.push(`   ${p}`);
        if (A.thieu.size > 40) m.push(`   … và ${A.thieu.size - 40} mục nữa`);
      }
    } else {
      m.push('nguồn dữ liệu  (chưa dựng)');
    }

    const S = typeof window !== 'undefined' ? window.__scene : null;
    if (S) {
      m.push(
        `cảnh           ${S.meshes?.length ?? 0} mesh · ${S.textures?.length ?? 0} texture · ` +
          `${S.particleSystems?.length ?? 0} hệ hạt · ${S.lights?.length ?? 0} đèn`
      );
    }
    if (typeof window !== 'undefined' && window.__gfx) {
      m.push(`hiệu ứng       ${JSON.stringify(window.__gfx.state())}`);
    }

    /* Hàng rào mạng: đọc qua window chứ không import, tránh hai file gọi vòng
       lẫn nhau (netguard cần DBG để ghi, DBG cần danh sách của netguard). */
    const chan = typeof window !== 'undefined' ? window.MU_NETCHAN : null;
    if (chan && chan.size) {
      m.push(`CHẶN RA NGOÀI  ${chan.size} địa chỉ:`);
      for (const [u, n] of [...chan].slice(0, 20)) m.push(`   ${n}× ${u.slice(0, 140)}`);
      if (chan.size > 20) m.push(`   … và ${chan.size - 20} địa chỉ nữa`);
    } else {
      m.push('CHẶN RA NGOÀI  không có lần nào');
    }

    m.push(`đếm            ${this.dem.loi} lỗi · ${this.dem.canh} cảnh báo · ${this.dem.mang} sự cố mạng`);
    m.push(`số dòng        ${this.buf.length}${this.buf.length >= MAX ? ' (đã đầy, dòng cũ bị bỏ)' : ''}`);
    m.push('--------------------------------------');
    m.push(...this.buf);
    m.push('===== HẾT =====');
    return m.join('\n');
  },
};

/**
 * Bắt mọi đường lỗi của trình duyệt.
 *
 * Gọi NGAY khi nạp file này, không chờ ai. Bọc console.error và console.warn để
 * cả lỗi của Babylon lẫn lỗi của engine đều vào chung một chỗ.
 */
function cai() {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', ev => {
    if (ev.error) DBG.error('window', ev.error);
    else DBG.error('window', `${ev.message} (${ev.filename}:${ev.lineno}:${ev.colno})`);
  });

  window.addEventListener('unhandledrejection', ev => {
    DBG.error('promise', ev.reason instanceof Error ? ev.reason : String(ev.reason));
  });

  // Lỗi nạp tài nguyên (ảnh, script, phông) không nổi lên window.onerror mà chỉ
  // bắn sự kiện 'error' ở chính phần tử — phải nghe ở pha bắt.
  window.addEventListener(
    'error',
    ev => {
      const t = ev.target;
      if (!t || t === window) return;
      const src = t.src || t.href;
      if (src) DBG.net('tải hụt', `${t.tagName} ${String(src).slice(0, 160)}`);
    },
    true
  );

  for (const muc of ['error', 'warn']) {
    const goc = console[muc]?.bind(console);
    if (!goc) continue;
    console[muc] = (...a) => {
      DBG.log(muc === 'error' ? 'error' : 'warn', 'console', ...a);
      goc(...a);
    };
  }

  DBG.info('gỡ lỗi', `đã cài · ${DBG.on ? 'BẬT' : 'TẮT'}`);
}

cai();

if (typeof window !== 'undefined') window.MU_DBG = DBG;
