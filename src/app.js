/* ==========================================================================
   Ani — Companion 3D  ·  ANI-2 motion engine
   --------------------------------------------------------------------------
   Chạy trực tiếp từ file:// — không module, không fetch, không build step.

   ANI-2 khác bản ANI-1 ở 6 điểm (đây là phần "mượt"):
     1. Bộ lập lịch fixed-timestep + nội suy trạng thái  → không giật khi
        rAF dao động (60 / 90 / 120 Hz ProMotion đều mượt như nhau).
     2. Lò xo tới hạn giải bằng Euler ẩn (implicit)      → ổn định vô điều
        kiện, không vọt lố, không nổ ở fps thấp.
     3. Spring-bone PBD kiểu VRM cho tóc / váy / ruy-băng → quán tính thật,
        giữ nguyên chiều dài xương, thay cho euler-spring cũ.
     4. Nhiễu value-noise nhiều tầng thay chồng sin      → chuyển động nền
        hữu cơ, không lặp mẫu.
     5. Mô hình mắt–đầu sinh học: saccade đạn đạo, dwell, VOR đối xoay,
        chớp mắt gắn với đảo mắt.
     6. Bộ điều tiết ngân sách 2.5 ms/khung              → tự hạ substep và
        LOD chuỗi lò xo khi máy yếu, tự nâng lại khi dư.
   ========================================================================== */
(function () {
'use strict';

/* ======================================================== tiện ích chung == */
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
var PI = Math.PI, TAU = PI * 2;
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

/* value-noise 1D: hash + nội suy smoothstep. Rẻ hơn Perlin, đủ hữu cơ. */
function hash1(n) { var s = Math.sin(n * 127.1) * 43758.5453123; return s - Math.floor(s); }
function vn(x) {
  var i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash1(i) * (1 - u) + hash1(i + 1) * u;
}
function n11(x) { return vn(x) * 2 - 1; }                      /* -1..1        */
function fbm(x) { return n11(x) * 0.62 + n11(x * 2.13 + 7.3) * 0.26 + n11(x * 4.37 + 19.1) * 0.12; }

/* Lò xo tới hạn, nghiệm Euler ẩn — ổn định với mọi h (Ryan Juckett).        */
function springStep(s, target, omega, h) {
  var f = 1 + 2 * h * omega, oo = omega * omega, hoo = h * oo, hhoo = h * hoo;
  var det = 1 / (f + hhoo);
  var x = (f * s.x + h * s.v + hhoo * target) * det;
  var v = (s.v + hoo * (target - s.x)) * det;
  s.x = x; s.v = v; return x;
}
function sp(v) { return { x: v || 0, v: 0 }; }

/* ============================================================ cấu hình ==== */
var LS = 'ani.v2';
var cfg = {
  persona: 'Ani — 22 tuổi, nhí nhảnh và hay trêu, giọng Bắc nói nhanh. Thích tự do, thích xê dịch, ghét khuôn mẫu và luật lệ cứng nhắc. Trả lời ngắn 1–2 câu, xưng "tớ", gọi người dùng là "cậu". Nói tiếng Việt, chen vài từ tiếng Anh khi thấy hợp.',
  voice: '', rate: 1.05, pitch: 1.25,
  endpoint: '', key: '', model: 'gpt-4o-mini',
  opa: 0.82, dust: true, grain: true, sparkle: true, spring: true,
  frame: 'bust', outfit: 'a', budget: 2.5, hz: 120, stats: false
};
try {
  var st = JSON.parse(localStorage.getItem(LS) || '{}');
  for (var k in st) if (k in cfg) cfg[k] = st[k];
} catch (e) {}
function save() { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {} }

var el = {};
function cacheEl() {
  ['gl', 'bgc', 'spark', 'dust', 'boot', 'bootTap', 'bootErr', 'bootAvaImg', 'bubbles',
   'msg', 'sheet', 'grain', 'charGlow', 'stats'].forEach(function (id) { el[id] = document.getElementById(id); });
  el.arc = document.querySelector('#bootRing .arc');
}

var ARC_LEN = 578;                       /* 2πr với r = 92 trong viewBox 200 */
function setProgress(p) {
  if (el.arc) el.arc.style.strokeDashoffset = String(ARC_LEN * (1 - clamp(p, 0, 1)));
}

/* ==========================================================================
   NỀN PARIS — vẽ hoàn toàn bằng Canvas 2D (không ảnh ngoài, không base64)
   ========================================================================== */
function paintParis(g, W, H) {
  var i, j, x, y, r;

  /* ---- bầu trời đêm ---------------------------------------------------- */
  var sky = g.createLinearGradient(0, 0, 0, H * 0.78);
  sky.addColorStop(0.00, '#05070f');
  sky.addColorStop(0.22, '#0a1024');
  sky.addColorStop(0.48, '#132043');
  sky.addColorStop(0.72, '#22345f');
  sky.addColorStop(1.00, '#3a4a72');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);

  /* ---- sao ------------------------------------------------------------- */
  for (i = 0; i < 460; i++) {
    x = hash1(i * 1.7 + 3) * W;
    y = hash1(i * 2.9 + 11) * H * 0.68;
    r = 0.4 + hash1(i * 5.1 + 2) * 1.5;
    var a = (0.18 + hash1(i * 3.3 + 7) * 0.75) * (1 - y / (H * 0.82));
    g.fillStyle = 'rgba(226,236,255,' + a.toFixed(3) + ')';
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (r > 1.6 && hash1(i * 9.1) > 0.82) {                     /* sao có tia */
      g.strokeStyle = 'rgba(210,226,255,' + (a * 0.5).toFixed(3) + ')';
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(x - r * 3.4, y); g.lineTo(x + r * 3.4, y);
      g.moveTo(x, y - r * 3.4); g.lineTo(x, y + r * 3.4);
      g.stroke();
    }
  }

  /* ---- quầng trăng góc phải trên --------------------------------------- */
  var mg = g.createRadialGradient(W * 0.84, H * 0.10, 0, W * 0.84, H * 0.10, W * 0.46);
  mg.addColorStop(0, 'rgba(178,198,255,.20)');
  mg.addColorStop(1, 'rgba(178,198,255,0)');
  g.fillStyle = mg; g.fillRect(0, 0, W, H * 0.6);

  /* ---- sương mù chân trời ---------------------------------------------- */
  var hz = g.createLinearGradient(0, H * 0.44, 0, H * 0.74);
  hz.addColorStop(0, 'rgba(255,190,120,0)');
  hz.addColorStop(0.55, 'rgba(255,178,104,.14)');
  hz.addColorStop(1, 'rgba(120,150,220,.10)');
  g.fillStyle = hz; g.fillRect(0, H * 0.4, W, H * 0.4);

  /* ---- tháp Eiffel ------------------------------------------------------ */
  eiffel(g, W * 0.155, H * 0.665, H * 0.50);

  /* ---- mái nhà Haussmann ----------------------------------------------- */
  rooftops(g, W, H, H * 0.585, H * 0.20, 0.55, '#0b1024');
  rooftops(g, W, H, H * 0.655, H * 0.22, 1.00, '#070a17');

  /* ---- sàn ban công kẻ ô ------------------------------------------------ */
  checkerFloor(g, W, H, H * 0.855);

  /* ---- lan can sắt uốn -------------------------------------------------- */
  railing(g, W, H, H * 0.655, H * 0.215);

  /* ---- bụi hoa hồng góc trái ------------------------------------------- */
  roseBush(g, W * 0.02, H * 0.78, W * 0.34, H * 0.20);

  /* ---- bokeh & mờ viền -------------------------------------------------- */
  for (i = 0; i < 26; i++) {
    x = hash1(i * 4.4 + 31) * W;
    y = H * 0.30 + hash1(i * 6.6 + 13) * H * 0.42;
    r = W * (0.012 + hash1(i * 8.2 + 5) * 0.045);
    var bg2 = g.createRadialGradient(x, y, 0, x, y, r);
    var warm = hash1(i * 2.2 + 9) > 0.4;
    bg2.addColorStop(0, warm ? 'rgba(255,206,130,.20)' : 'rgba(150,190,255,.16)');
    bg2.addColorStop(0.72, warm ? 'rgba(255,196,120,.07)' : 'rgba(140,180,255,.05)');
    bg2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = bg2; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }

  /* ---- ám sắc tổng thể -------------------------------------------------- */
  var tone = g.createLinearGradient(0, 0, W, H);
  tone.addColorStop(0, 'rgba(255,168,88,.07)');
  tone.addColorStop(0.5, 'rgba(0,0,0,0)');
  tone.addColorStop(1, 'rgba(88,120,255,.09)');
  g.fillStyle = tone; g.fillRect(0, 0, W, H);
}

/* ------------------------------------------------------------- Eiffel ---- */
function eiffel(g, cx, baseY, h) {
  var i, t, y;
  /* nửa bề rộng theo chiều cao chuẩn hoá t (0 = chân, 1 = đỉnh) */
  function hw(tt) {
    return h * (0.200 * Math.pow(1 - tt, 2.45) + 0.0165 * (1 - tt) + 0.0042);
  }
  function yOf(tt) { return baseY - h * tt; }

  /* quầng sáng vàng */
  var gl = g.createRadialGradient(cx, baseY - h * 0.36, 0, cx, baseY - h * 0.36, h * 0.72);
  gl.addColorStop(0, 'rgba(255,186,86,.30)');
  gl.addColorStop(0.42, 'rgba(255,168,72,.13)');
  gl.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = gl;
  g.beginPath(); g.arc(cx, baseY - h * 0.36, h * 0.72, 0, TAU); g.fill();

  /* thân tháp: đổ bóng nền tối trước */
  g.save();
  g.beginPath();
  g.moveTo(cx - hw(0), baseY);
  for (i = 0; i <= 60; i++) { t = i / 60; g.lineTo(cx - hw(t), yOf(t)); }
  for (i = 60; i >= 0; i--) { t = i / 60; g.lineTo(cx + hw(t), yOf(t)); }
  g.closePath();
  g.clip();

  g.fillStyle = '#2a190f';
  g.fillRect(cx - h * 0.25, baseY - h, h * 0.5, h);

  /* dàn giáo: thanh ngang + chữ X */
  g.strokeStyle = 'rgba(255,186,96,.42)'; g.lineWidth = Math.max(0.8, h * 0.0032);
  for (i = 0; i < 46; i++) {
    t = i / 46; y = yOf(t);
    var w = hw(t), w2 = hw((i + 1) / 46), y2 = yOf((i + 1) / 46);
    g.beginPath(); g.moveTo(cx - w, y); g.lineTo(cx + w, y); g.stroke();
    g.beginPath();
    g.moveTo(cx - w, y); g.lineTo(cx + w2, y2);
    g.moveTo(cx + w, y); g.lineTo(cx - w2, y2);
    g.stroke();
  }
  /* trụ dọc */
  g.strokeStyle = 'rgba(255,200,120,.32)';
  for (i = -2; i <= 2; i++) {
    g.beginPath();
    for (var q = 0; q <= 40; q++) { t = q / 40; var xx = cx + hw(t) * (i / 2); if (q === 0) g.moveTo(xx, yOf(t)); else g.lineTo(xx, yOf(t)); }
    g.stroke();
  }
  /* ánh vàng phủ */
  var warm = g.createLinearGradient(0, baseY, 0, baseY - h);
  warm.addColorStop(0, 'rgba(255,164,52,.55)');
  warm.addColorStop(0.5, 'rgba(255,192,96,.34)');
  warm.addColorStop(1, 'rgba(255,224,150,.22)');
  g.globalCompositeOperation = 'overlay';
  g.fillStyle = warm; g.fillRect(cx - h * 0.25, baseY - h, h * 0.5, h);
  g.globalCompositeOperation = 'source-over';
  g.restore();

  /* vòm chân tháp */
  g.strokeStyle = 'rgba(255,178,80,.5)'; g.lineWidth = Math.max(1, h * 0.005);
  g.beginPath();
  g.moveTo(cx - hw(0) * 0.92, baseY);
  g.quadraticCurveTo(cx, baseY - h * 0.16, cx + hw(0) * 0.92, baseY);
  g.stroke();

  /* các tầng */
  [[0.155, 1.34], [0.355, 1.30], [0.795, 1.55]].forEach(function (p) {
    var tt = p[0], w = hw(tt) * p[1], yy = yOf(tt), th = h * 0.019;
    g.fillStyle = 'rgba(46,28,14,.96)';
    g.fillRect(cx - w, yy - th * 0.5, w * 2, th);
    g.fillStyle = 'rgba(255,196,104,.72)';
    g.fillRect(cx - w, yy - th * 0.5, w * 2, th * 0.24);
    for (var q = 0; q < 22; q++) {
      var lx = cx - w + (w * 2) * (q / 21);
      g.fillStyle = 'rgba(255,224,158,' + (0.35 + hash1(q + tt * 40) * 0.6).toFixed(2) + ')';
      g.beginPath(); g.arc(lx, yy, h * 0.0055, 0, TAU); g.fill();
    }
  });

  /* ăng-ten + đèn hiệu */
  g.strokeStyle = 'rgba(255,214,150,.85)'; g.lineWidth = Math.max(1, h * 0.004);
  g.beginPath(); g.moveTo(cx, yOf(1)); g.lineTo(cx, yOf(1) - h * 0.075); g.stroke();
  var bl = g.createRadialGradient(cx, yOf(1) - h * 0.078, 0, cx, yOf(1) - h * 0.078, h * 0.05);
  bl.addColorStop(0, 'rgba(255,255,240,.95)');
  bl.addColorStop(0.3, 'rgba(255,226,160,.5)');
  bl.addColorStop(1, 'rgba(255,210,140,0)');
  g.fillStyle = bl;
  g.beginPath(); g.arc(cx, yOf(1) - h * 0.078, h * 0.05, 0, TAU); g.fill();
}

/* ----------------------------------------------------------- mái nhà ----- */
function rooftops(g, W, H, top, band, scale, col) {
  var x = -W * 0.06, i = 0;
  g.fillStyle = col;
  while (x < W * 1.06) {
    var w = W * (0.09 + hash1(i * 3.7 + scale * 17) * 0.13) * (0.7 + scale * 0.5);
    var hgt = band * (0.42 + hash1(i * 5.3 + scale * 29) * 0.58);
    var y0 = top + band - hgt;
    var mans = hgt * 0.30;
    g.beginPath();
    g.moveTo(x, top + band);
    g.lineTo(x, y0 + mans);
    g.lineTo(x + w * 0.14, y0);
    g.lineTo(x + w * 0.86, y0);
    g.lineTo(x + w, y0 + mans);
    g.lineTo(x + w, top + band);
    g.closePath(); g.fill();

    /* ống khói */
    var nch = 1 + Math.floor(hash1(i * 7.1) * 3);
    for (var c = 0; c < nch; c++) {
      var chx = x + w * (0.16 + hash1(i * 11 + c) * 0.68);
      var chh = hgt * (0.14 + hash1(i * 13 + c * 3) * 0.16);
      var chw = w * 0.05;
      g.fillRect(chx, y0 - chh, chw, chh + mans);
      g.fillRect(chx - chw * 0.2, y0 - chh - hgt * 0.02, chw * 1.4, hgt * 0.025);
    }

    /* cửa sổ sáng */
    var rows = 2 + Math.floor(hash1(i * 2.3) * 3);
    for (var rr = 0; rr < rows; rr++) {
      for (var cc = 0; cc < 4; cc++) {
        if (hash1(i * 31 + rr * 7 + cc * 3) < 0.52) continue;
        var wx = x + w * (0.14 + cc * 0.22);
        var wy = y0 + mans + hgt * 0.14 + rr * (hgt * 0.19);
        if (wy > top + band - hgt * 0.06) continue;
        var ww = w * 0.085, wh = hgt * 0.10;
        var warm2 = hash1(i * 17 + rr + cc) > 0.22;
        g.fillStyle = warm2
          ? 'rgba(255,196,110,' + (0.30 + 0.55 * scale).toFixed(2) + ')'
          : 'rgba(160,198,255,' + (0.20 + 0.4 * scale).toFixed(2) + ')';
        g.fillRect(wx, wy, ww, wh);
        g.fillStyle = col;
      }
    }
    x += w * (0.94 + hash1(i * 19) * 0.12); i++;
  }
}

/* ------------------------------------------------------- sàn kẻ ô -------- */
function checkerFloor(g, W, H, top) {
  var vp = W * 0.5, rows = 11;
  for (var r = 0; r < rows; r++) {
    var t0 = r / rows, t1 = (r + 1) / rows;
    var y0 = top + (H - top) * (t0 * t0 * 0.72 + t0 * 0.28);
    var y1 = top + (H - top) * (t1 * t1 * 0.72 + t1 * 0.28);
    var sp0 = W * (0.06 + t0 * 0.30), sp1 = W * (0.06 + t1 * 0.30);
    for (var c = -9; c < 9; c++) {
      if (((c + r) & 1) === 0) continue;
      g.fillStyle = 'rgba(232,226,214,' + (0.10 + 0.16 * (1 - t0)).toFixed(3) + ')';
      g.beginPath();
      g.moveTo(vp + c * sp0, y0);
      g.lineTo(vp + (c + 1) * sp0, y0);
      g.lineTo(vp + (c + 1) * sp1, y1);
      g.lineTo(vp + c * sp1, y1);
      g.closePath(); g.fill();
    }
  }
  var fade = g.createLinearGradient(0, top, 0, H);
  fade.addColorStop(0, 'rgba(8,8,18,.86)');
  fade.addColorStop(0.45, 'rgba(10,10,22,.34)');
  fade.addColorStop(1, 'rgba(6,6,14,.72)');
  g.fillStyle = fade; g.fillRect(0, top, W, H - top);
}

/* ------------------------------------------------------- lan can sắt ----- */
function railing(g, W, H, top, hgt) {
  var bot = top + hgt;
  g.strokeStyle = 'rgba(9,9,16,.95)';
  g.fillStyle = 'rgba(9,9,16,.95)';
  g.lineCap = 'round';

  /* thanh trên & dưới */
  g.lineWidth = hgt * 0.055;
  g.beginPath(); g.moveTo(-10, top); g.lineTo(W + 10, top); g.stroke();
  g.lineWidth = hgt * 0.040;
  g.beginPath(); g.moveTo(-10, bot); g.lineTo(W + 10, bot); g.stroke();

  /* con tiện + hoa văn xoắn */
  var step = W * 0.088;
  g.lineWidth = hgt * 0.026;
  for (var x = -step; x < W + step; x += step) {
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot); g.stroke();
    /* xoắn ốc đối xứng */
    var cx = x + step * 0.5, cy = (top + bot) * 0.5, rr = hgt * 0.30;
    g.beginPath();
    g.moveTo(cx, top + hgt * 0.06);
    g.bezierCurveTo(cx - rr * 1.5, top + hgt * 0.20, cx - rr * 1.15, cy + rr * 0.55, cx - rr * 0.12, cy + rr * 0.18);
    g.stroke();
    g.beginPath();
    g.moveTo(cx, top + hgt * 0.06);
    g.bezierCurveTo(cx + rr * 1.5, top + hgt * 0.20, cx + rr * 1.15, cy + rr * 0.55, cx + rr * 0.12, cy + rr * 0.18);
    g.stroke();
    g.beginPath();
    g.moveTo(cx, bot - hgt * 0.06);
    g.bezierCurveTo(cx - rr * 1.4, bot - hgt * 0.20, cx - rr * 1.05, cy - rr * 0.5, cx - rr * 0.12, cy - rr * 0.14);
    g.stroke();
    g.beginPath();
    g.moveTo(cx, bot - hgt * 0.06);
    g.bezierCurveTo(cx + rr * 1.4, bot - hgt * 0.20, cx + rr * 1.05, cy - rr * 0.5, cx + rr * 0.12, cy - rr * 0.14);
    g.stroke();
    g.beginPath(); g.arc(cx, cy, hgt * 0.045, 0, TAU); g.fill();
  }
  /* viền sáng nhẹ trên thanh trên (ánh vàng từ tháp) */
  g.strokeStyle = 'rgba(255,190,110,.20)'; g.lineWidth = hgt * 0.014;
  g.beginPath(); g.moveTo(-10, top - hgt * 0.022); g.lineTo(W + 10, top - hgt * 0.022); g.stroke();
}

/* --------------------------------------------------------- bụi hoa ------- */
function roseBush(g, x0, y0, w, h) {
  var i;
  for (i = 0; i < 130; i++) {
    var t = hash1(i * 3.1 + 2);
    var x = x0 + t * w + n11(i * 1.7) * w * 0.10;
    var y = y0 + hash1(i * 5.7 + 4) * h;
    var r = w * (0.014 + hash1(i * 7.3) * 0.030);
    var dark = 0.10 + hash1(i * 2.9) * 0.16;
    g.fillStyle = 'rgba(' + Math.round(24 + dark * 90) + ',' + Math.round(44 + dark * 120) + ',' + Math.round(30 + dark * 60) + ',.92)';
    g.beginPath(); g.ellipse(x, y, r, r * 0.72, hash1(i * 11) * TAU, 0, TAU); g.fill();
  }
  for (i = 0; i < 16; i++) {
    var rx = x0 + hash1(i * 4.3 + 8) * w;
    var ry = y0 + hash1(i * 6.1 + 1) * h * 0.9;
    var rr = w * (0.020 + hash1(i * 9.7) * 0.020);
    var rg = g.createRadialGradient(rx, ry, 0, rx, ry, rr * 2.2);
    rg.addColorStop(0, 'rgba(255,148,176,.85)');
    rg.addColorStop(0.4, 'rgba(216,86,124,.55)');
    rg.addColorStop(1, 'rgba(180,52,96,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(rx, ry, rr * 2.2, 0, TAU); g.fill();
  }
}

/* ---------------------------------------------- lớp nền + đèn nhấp nháy -- */
var BG = { w: 0, h: 0, sparks: [], sctx: null, sw: 0, sh: 0, ex: 0, ey: 0, eh: 0 };
function initBackground() {
  var c = el.bgc, g = c.getContext('2d');
  var s = el.spark, sg = s.getContext('2d');

  function build() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = Math.min(1280, Math.round(c.clientWidth * dpr));
    var H = Math.round(W * (c.clientHeight / Math.max(1, c.clientWidth)));
    if (W === BG.w && H === BG.h) return;
    BG.w = c.width = W; BG.h = c.height = H;
    g.setTransform(1, 0, 0, 1, 0, 0);
    paintParis(g, W, H);

    /* lớp lấp lánh dùng toạ độ riêng, nhẹ hơn */
    BG.sw = s.width = Math.round(W * 0.6);
    BG.sh = s.height = Math.round(H * 0.6);
    BG.sctx = sg;
    BG.ex = BG.sw * 0.155; BG.ey = BG.sh * 0.665; BG.eh = BG.sh * 0.50;
    BG.sparks.length = 0;
    for (var i = 0; i < 210; i++) {
      var t = Math.pow(hash1(i * 2.7 + 5), 0.62);
      var hw = BG.eh * (0.200 * Math.pow(1 - t, 2.45) + 0.0165 * (1 - t) + 0.0042);
      BG.sparks.push({
        x: BG.ex + (hash1(i * 4.1 + 9) * 2 - 1) * hw * 0.95,
        y: BG.ey - BG.eh * t,
        ph: hash1(i * 6.3) * TAU,
        sp: 5 + hash1(i * 8.9) * 11,
        r: BG.eh * (0.0032 + hash1(i * 3.3) * 0.0042)
      });
    }
  }
  build();
  window.addEventListener('resize', function () { BG.w = 0; build(); });

  return function drawSparks(t) {
    if (!BG.sctx) return;
    var sg2 = BG.sctx;
    sg2.clearRect(0, 0, BG.sw, BG.sh);
    if (!cfg.sparkle) return;
    for (var i = 0; i < BG.sparks.length; i++) {
      var p = BG.sparks[i];
      var a = Math.max(0, Math.sin(t * p.sp + p.ph));
      a = a * a * a;
      if (a < 0.02) continue;
      var gr = sg2.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      gr.addColorStop(0, 'rgba(255,246,214,' + (a * 0.95).toFixed(3) + ')');
      gr.addColorStop(0.35, 'rgba(255,214,132,' + (a * 0.45).toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,190,90,0)');
      sg2.fillStyle = gr;
      sg2.beginPath(); sg2.arc(p.x, p.y, p.r * 5, 0, TAU); sg2.fill();
    }
  };
}

/* ================================================================ bụi ===== */
function initDust() {
  var c = el.dust, x = c.getContext('2d'), ps = [], W = 0, H = 0;
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  function size() {
    W = c.clientWidth; H = c.clientHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function seed() {
    ps.length = 0;
    var n = Math.round(Math.min(84, W * H / 8200));
    for (var i = 0; i < n; i++) ps.push({
      x: Math.random() * W, y: Math.random() * H, r: 0.5 + Math.random() * 1.8,
      s: 0.05 + Math.random() * 0.30, d: Math.random() * TAU, o: 0.22 + Math.random() * 0.62
    });
  }
  size(); seed();
  window.addEventListener('resize', function () { size(); seed(); });
  return function (t) {
    x.clearRect(0, 0, W, H);
    if (!cfg.dust) return;
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i];
      p.y -= p.s; p.x += Math.sin(t * 0.6 + p.d) * 0.24;
      if (p.y < -6) { p.y = H + 6; p.x = Math.random() * W; }
      var a = p.o * (0.5 + 0.5 * Math.sin(t * 1.7 + p.d));
      var gr = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4.2);
      gr.addColorStop(0, 'rgba(255,232,198,' + a.toFixed(3) + ')');
      gr.addColorStop(1, 'rgba(255,186,140,0)');
      x.fillStyle = gr;
      x.beginPath(); x.arc(p.x, p.y, p.r * 4.2, 0, TAU); x.fill();
    }
  };
}

/* ==========================================================================
   LỚP MODEL — dựng skinned mesh từ ANI_DATA
   ========================================================================== */
var TEX_OF = {
  'o-a_base.png': 'oa', 'o-b_base.png': 'ob', 'hair_base.png': 'hair',
  'body_base_base.png': 'body', 'face_base_base.png': 'face'
};
/* Bộ mesh theo trang phục. Hai phần "+necklace" (1 và 6) là vòng cổ ren —
   ảnh gốc của model cho thấy nó có mặt ở CẢ hai bộ, nên không xếp vào set B
   như bản cũ (xếp nhầm làm cổ trần, lộ hẳn da). */
var SET_A = { 0: 1, 2: 1, 5: 1 };
var SET_B = { 3: 1, 7: 1, 8: 1 };

var R = {};
var U = {
  blink: { value: 0 }, mouth: { value: 0 }, wide: { value: 0 },
  smile: { value: 0 }, brow: { value: 0 }, squint: { value: 0 }, blush: { value: 0 }
};
/* Uniform ánh sáng viền — dùng chung cho mọi vật liệu */
var RIM = {
  aCol: { value: null }, bCol: { value: null },
  aDir: { value: null }, bDir: { value: null },
  pow: { value: 2.35 }, amt: { value: 1.0 }
};

function b64bytes(url) {
  var b = url.slice(url.indexOf(',') + 1), bin = atob(b), n = bin.length, out = new Uint8Array(n);
  for (var i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
  return out;
}
/* Vá atlas — sửa lỗi có sẵn trong asset gốc.
   o-a_base có đúng ba đảo màu vàng kim:
     A) hàng   0–34 , u 0.62–0.70 — viền gấu váy + nơ nịt tất
     B) hàng  86–119, u 0.57–0.67 — KHOÁ THẮT LƯNG (vàng thật, giữ nguyên)
     C) hàng 340–362, u 0.34–0.47 — dải đai đính đinh tán
   UV của gấu váy và mặt trước thắt lưng trỏ vào A và C, làm cả vạt váy
   loé vàng như dát kim. Ảnh render chính chủ của model (Prev.png) và ảnh
   tham chiếu đều cho thấy chỗ đó là xanh than, chỉ riêng khoá thắt lưng
   mới vàng. Nên ta chép đè A và C bằng vải xanh than lấy từ chính atlas
   (giữ nguyên vân vải), còn B thì không đụng tới. */
var TEX_PATCH = {
  oa: [
    { dx: 0.598, dy: 0.000, w: 0.166, h: 0.045, sx: 0.598, sy: 0.547 },
    { dx: 0.330, dy: 0.328, w: 0.148, h: 0.032, sx: 0.330, sy: 0.375 }
  ]
};

function loadTex(url, srgb, patch) {
  return new Promise(function (res) {
    var t = new THREE.Texture(), im = new Image();
    im.onload = function () {
      var src = im;
      if (patch && patch.length) {
        var cv = document.createElement('canvas');
        cv.width = im.naturalWidth || im.width;
        cv.height = im.naturalHeight || im.height;
        var g2 = cv.getContext('2d');
        g2.drawImage(im, 0, 0);
        for (var q = 0; q < patch.length; q++) {
          var Pp = patch[q];
          g2.drawImage(im,
            Pp.sx * cv.width, Pp.sy * cv.height, Pp.w * cv.width, Pp.h * cv.height,
            Pp.dx * cv.width, Pp.dy * cv.height, Pp.w * cv.width, Pp.h * cv.height);
        }
        src = cv;
      }
      t.image = src; t.needsUpdate = true;
      /* Model dùng UV lát (u, v chạy tới ~1.98). ClampToEdge như bản cũ sẽ
         kẹp mọi toạ độ > 1 vào cột texel cuối cùng → kéo lê vệt ngang khắp
         thân, cổ và váy. Texture đều 1024×1024 (luỹ thừa 2) nên lặp được. */
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.flipY = false;
      t.anisotropy = 8;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      /* sRGB cho map màu — thiếu dòng này là nguyên nhân bản cũ bị bạc màu */
      if (srgb) t.encoding = THREE.sRGBEncoding;
      res(t);
    };
    im.onerror = function () { res(t); };
    im.src = url;
  });
}

/* Chèn ánh sáng viền hai tông (ấm trái / hồng phải) vào mọi vật liệu toon.
   Neo là dòng gl_FragColor của three r128 — chunk <output_fragment> chưa có
   ở phiên bản này nên không dùng được làm mốc. */
var FRAG_ANCHOR = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );';
var RIM_GLSL = [
  '{',
  '  vec3 nrm = normalize( vNormal );',
  '  vec3 vdir = normalize( vViewPosition );',
  '  float fres = pow( 1.0 - clamp( dot( nrm, vdir ), 0.0, 1.0 ), uRimPow );',
  '  float wa = max( 0.0, dot( nrm, normalize( uRimDA ) ) );',
  '  float wb = max( 0.0, dot( nrm, normalize( uRimDB ) ) );',
  '  outgoingLight += ( uRimA * wa + uRimB * wb ) * fres * uRimAmt;',
  '}'
].join('\n');

function injectRim(mat, id) {
  var prev = mat.onBeforeCompile;
  mat.onBeforeCompile = function (sh) {
    if (prev) prev(sh);
    sh.uniforms.uRimA = RIM.aCol; sh.uniforms.uRimB = RIM.bCol;
    sh.uniforms.uRimDA = RIM.aDir; sh.uniforms.uRimDB = RIM.bDir;
    sh.uniforms.uRimPow = RIM.pow; sh.uniforms.uRimAmt = RIM.amt;
    sh.fragmentShader =
      'uniform vec3 uRimA, uRimB, uRimDA, uRimDB;\nuniform float uRimPow, uRimAmt;\n' +
      sh.fragmentShader.replace(FRAG_ANCHOR, RIM_GLSL + '\n\t' + FRAG_ANCHOR);
  };
  /* mỗi vật liệu có mã shader riêng → khoá cache phải riêng, nếu không
     three sẽ tái dùng nhầm program giữa mặt và trang phục. */
  mat.customProgramCacheKey = function () { return 'ani:' + id; };
  mat.needsUpdate = true;
}

function build(data, onStep) {
  var bytes = b64bytes(data.bin), buf = bytes.buffer;
  var bd = data.bones, bones = [], i;

  for (i = 0; i < bd.length; i++) {
    var b = new THREE.Bone(); b.name = bd[i][0];
    var p = bd[i][1];
    b.position.set(
      bd[i][2] - (p >= 0 ? bd[p][2] : 0),
      bd[i][3] - (p >= 0 ? bd[p][3] : 0),
      bd[i][4] - (p >= 0 ? bd[p][4] : 0));
    bones.push(b);
  }
  var rootBone = null;
  for (i = 0; i < bd.length; i++) {
    if (bd[i][1] >= 0) bones[bd[i][1]].add(bones[i]); else rootBone = bones[i];
  }
  var group = new THREE.Group();
  group.add(rootBone);
  group.updateMatrixWorld(true);
  var skeleton = new THREE.Skeleton(bones);
  var boneIndex = {};
  for (i = 0; i < bones.length; i++) boneIndex[bones[i].name] = bones[i];

  /* Dải toon 6 bậc.
     QUAN TRỌNG: three r128 đọc dải này bằng `texture2D(gradientMap,c).rgb`
     (bản mới hơn mới dùng `.r`). Dùng RedFormat như bản cũ thì độ rọi trả
     về là (ramp, 0, 0) — tức ánh sáng ĐỎ THUẦN nhân lên toàn bộ nhân vật.
     Đó chính là lý do bản cũ da hồng bệt và tóc cam. Phải nạp đủ RGBA.
     Sàn cũng để thấp: mỗi đèn định hướng cộng sàn × cường độ lên toàn bề
     mặt, sàn cao là cháy sáng. */
  var steps = [24, 74, 142, 200, 236, 255];
  var ramp = new Uint8Array(steps.length * 4);
  for (i = 0; i < steps.length; i++) {
    ramp[i * 4] = ramp[i * 4 + 1] = ramp[i * 4 + 2] = steps[i];
    ramp[i * 4 + 3] = 255;
  }
  var gradient = new THREE.DataTexture(ramp, steps.length, 1, THREE.RGBAFormat);
  gradient.minFilter = gradient.magFilter = THREE.LinearFilter;
  gradient.generateMipmaps = false; gradient.needsUpdate = true;

  RIM.aCol.value = new THREE.Color(0xffb45c).multiplyScalar(0.30);   /* vàng Eiffel */
  RIM.bCol.value = new THREE.Color(0xff77ba).multiplyScalar(0.24);   /* hồng đô thị */
  RIM.pow.value = 3.1;
  RIM.aDir.value = new THREE.Vector3(-0.78, 0.30, -0.55).normalize();
  RIM.bDir.value = new THREE.Vector3(0.80, 0.16, -0.58).normalize();

  var texCache = {}, mats = {}, meshes = [], parts = data.parts, tri = 0;
  var keys = Object.keys(data.tex);

  return Promise.all(keys.map(function (key) {
    return loadTex(data.tex[key], key !== 'hairspec', TEX_PATCH[key]).then(function (t) {
      texCache[key] = t;
      onStep(0.30 + 0.42 * (Object.keys(texCache).length / keys.length));
    });
  })).then(function () {
    var faceMats = [], eyeMats = [];
    for (var pi = 0; pi < parts.length; pi++) {
      var P = parts[pi], off = P.off, vc = P.vc;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf, off[0], vc * 3), 3));
      var nib = new THREE.InterleavedBuffer(new Int8Array(buf, off[1], vc * 4), 4);
      geo.setAttribute('normal', new THREE.InterleavedBufferAttribute(nib, 3, 0, true));
      geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buf, off[2], vc * 2), 2));
      geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint16Array(buf, off[3], vc * 4), 4));
      var sw = new THREE.BufferAttribute(new Uint8Array(buf, off[4], vc * 4), 4); sw.normalized = true;
      geo.setAttribute('skinWeight', sw);
      var ia = P.i32 ? new Uint32Array(buf, off[5], P.ic) : new Uint16Array(buf, off[5], P.ic);
      geo.setIndex(new THREE.BufferAttribute(ia, 1));
      tri += P.ic / 3;

      var tk = TEX_OF[P.tex] || 'body';
      var isFace = tk === 'face', isHair = tk === 'hair', isSheer = tk === 'ob';
      /* Mống mắt tách riêng vật liệu: đảo texture mà UV mắt trỏ vào có màu
         nâu hổ phách, trong khi ảnh tham chiếu (và bản render chính chủ của
         model) đều là mắt xanh dương. Tách ra để đổi tông riêng cho mống. */
      var isEye = /face eyeballs/.test(P.name);
      var mk = isEye ? 'eye' : tk;
      var mat = mats[mk];
      if (!mat) {
        mat = new THREE.MeshToonMaterial({
          map: texCache[tk], gradientMap: gradient, skinning: true,
          transparent: isSheer || isFace,
          alphaTest: isSheer ? 0.05 : (isFace ? 0.02 : 0),
          side: (isSheer || isHair) ? THREE.DoubleSide : THREE.FrontSide,
          depthWrite: !isSheer
        });
        /* tóc vàng kim ấm như trong ảnh tham chiếu, không phủ hồng như bản cũ */
        if (isHair) mat.color = new THREE.Color(0xf0cf92);
        if (tk === 'oa' || tk === 'ob') mat.color = new THREE.Color(0xc9c6d6);
        mats[mk] = mat;
        if (isFace) faceMats.push(mat);
        if (isEye) eyeMats.push(mat);
      }
      var mesh = new THREE.SkinnedMesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.bind(skeleton, new THREE.Matrix4());
      mesh.userData.part = pi; mesh.userData.tk = tk;
      mesh.renderOrder = isSheer ? 3 : (isHair ? 2 : (isFace ? 1 : 0));
      group.add(mesh); meshes.push(mesh);
    }

    /* ---- neo mắt/miệng đo trực tiếp từ hình học --------------------------
       Model không có morph target, nên "rig" khuôn mặt được dựng lại thành
       biến dạng theo vùng ngay trong vertex shader.                        */
    var eyeMesh = null;
    meshes.forEach(function (m) { if (/eyeballs/.test(parts[m.userData.part].name)) eyeMesh = m; });
    var eL = new THREE.Vector3(0.02, 1.60, 0.05), eR = new THREE.Vector3(-0.02, 1.60, 0.05);
    if (eyeMesh) {
      var pa = eyeMesh.geometry.attributes.position, sl = [0, 0, 0, 0], sr = [0, 0, 0, 0];
      for (var v = 0; v < pa.count; v++) {
        var x = pa.getX(v), y = pa.getY(v), z = pa.getZ(v);
        var s2 = x >= 0 ? sl : sr; s2[0] += x; s2[1] += y; s2[2] += z; s2[3]++;
      }
      if (sl[3]) eL.set(sl[0] / sl[3], sl[1] / sl[3], sl[2] / sl[3]);
      if (sr[3]) eR.set(sr[0] / sr[3], sr[1] / sr[3], sr[2] / sr[3]);
    }
    var span = Math.abs(eL.x - eR.x) || 0.05;
    U.eyeL = { value: eL }; U.eyeR = { value: eR };
    U.mouthC = { value: new THREE.Vector3(0, eL.y - span * 0.78, eL.z + span * 0.16) };
    U.eyeRad = { value: span * 0.60 };
    U.mouthRad = { value: span * 0.52 };

    var head = [
      'uniform float uBlink, uMouth, uWide, uSmile, uBrow, uSquint, uBlush;',
      'uniform vec3 uEyeL, uEyeR, uMouthC;',
      'uniform float uEyeRad, uMouthRad;',
      'varying float vAniCheek;',
      'float lidW(vec3 p, vec3 c, float r){',
      '  vec2 d = vec2((p.x-c.x)/(r*1.32), (p.y-c.y)/(r*0.97));',
      '  return 1.0 - smoothstep(0.42, 1.0, length(d));',
      '}',
      'float cheekW(vec3 p, vec3 c, float r){',
      '  vec2 d = vec2((p.x-c.x)/(r*1.55), (p.y-(c.y-r*1.55))/(r*1.05));',
      '  return 1.0 - smoothstep(0.28, 1.0, length(d));',
      '}',
      'float browW(vec3 p, vec3 c, float r){',
      '  float ax = 1.0 - smoothstep(r*0.7, r*2.15, abs(p.x-c.x));',
      '  float ay = 1.0 - smoothstep(0.0, r*0.98, abs(p.y-(c.y+r*1.26)));',
      '  return ax*ay;',
      '}'
    ].join('\n');

    var bodyGlsl = [
      '{',
      '  float wl = lidW(position, uEyeL, uEyeRad);',
      '  float wr = lidW(position, uEyeR, uEyeRad);',
      '  float lw = max(wl, wr);',
      '  float cy = wl > wr ? uEyeL.y : uEyeR.y;',
      /* mi trên hạ xuống, mi dưới nhích lên rất nhẹ */
      '  float upper = step(cy, position.y);',
      '  transformed.y = mix(transformed.y, cy + 0.0014, lw * uBlink * mix(0.55, 1.0, upper));',
      '  transformed.y -= lw * uSquint * uEyeRad * (0.10 + 0.10 * (1.0 - upper));',
      '  transformed.z += lw * uBlink * uEyeRad * 0.05;',
      /* hàm mở */
      '  vec3 md = position - uMouthC;',
      '  float mw = (1.0 - smoothstep(0.30, 1.0, length(md / uMouthRad))) * step(md.y, 0.004);',
      '  transformed.y -= uMouth * mw * uMouthRad * 0.46;',
      '  transformed.z += uMouth * mw * uMouthRad * 0.10;',
      /* rộng (ee) vs tròn (oo) */
      '  float allw = 1.0 - smoothstep(0.28, 1.05, length(md / (uMouthRad*1.28)));',
      '  transformed.x += sign(md.x) * uWide * allw * uMouthRad * 0.17;',
      '  transformed.x -= sign(md.x) * (1.0-uWide) * uMouth * allw * uMouthRad * 0.08;',
      '  transformed.z += (1.0-uWide) * uMouth * allw * uMouthRad * 0.05;',
      /* cười: nhấc & kéo khoé miệng */
      '  float cx = abs(md.x);',
      '  float corner = (1.0 - smoothstep(uMouthRad*0.55, uMouthRad*1.58, cx))',
      '               * (1.0 - smoothstep(0.0, uMouthRad*0.88, abs(md.y)))',
      '               * step(uMouthRad*0.40, cx);',
      '  transformed.y += uSmile * corner * uMouthRad * 0.28;',
      '  transformed.x += sign(md.x) * uSmile * corner * uMouthRad * 0.11;',
      /* chân mày */
      '  float bw = max(browW(position, uEyeL, uEyeRad), browW(position, uEyeR, uEyeRad));',
      '  transformed.y += uBrow * bw * uEyeRad * 0.35;',
      '  vAniCheek = max(cheekW(position, uEyeL, uEyeRad), cheekW(position, uEyeR, uEyeRad));',
      '  vAniCheek += uSmile * 0.35 * vAniCheek;',
      '}'
    ].join('\n');

    /* Đổi tông mống mắt sang xanh: chỉ tác động lên điểm ảnh CÓ MÀU (nâu hổ
       phách). Đồng tử đen và đốm sáng trắng gần như vô sắc nên được giữ
       nguyên — nhờ vậy mắt vẫn còn chiều sâu và điểm cao sáng. */
    var IRIS_GLSL = [
      '{',
      '  float mx = max(max(diffuseColor.r, diffuseColor.g), diffuseColor.b);',
      '  float mn = min(min(diffuseColor.r, diffuseColor.g), diffuseColor.b);',
      '  float chroma = smoothstep(0.045, 0.15, mx - mn);',
      '  float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));',
      '  vec3 iris = mix(vec3(0.055, 0.085, 0.26), vec3(0.42, 0.60, 0.98),',
      '                  smoothstep(0.04, 0.42, l));',
      '  iris = mix(iris, vec3(0.72, 0.86, 1.0), smoothstep(0.42, 0.72, l));',
      '  diffuseColor.rgb = mix(diffuseColor.rgb, iris, chroma);',
      '}'
    ].join('\n');

    faceMats.forEach(function (m) {
      var iris = eyeMats.indexOf(m) >= 0 ? IRIS_GLSL : '';
      m.onBeforeCompile = function (sh) {
        ['blink', 'mouth', 'wide', 'smile', 'brow', 'squint', 'blush',
         'eyeL', 'eyeR', 'mouthC', 'eyeRad', 'mouthRad'].forEach(function (n) {
          sh.uniforms['u' + n.charAt(0).toUpperCase() + n.slice(1)] = U[n];
        });
        sh.vertexShader = head + '\n' + sh.vertexShader
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + bodyGlsl);
        sh.fragmentShader = 'uniform float uBlush;\nvarying float vAniCheek;\n' + sh.fragmentShader
          .replace('#include <map_fragment>',
            '#include <map_fragment>\n' + iris +
            '\n  diffuseColor.rgb = mix(diffuseColor.rgb,' +
            ' diffuseColor.rgb * vec3(1.14, 0.62, 0.72), clamp(vAniCheek,0.0,1.0) * uBlush);');
      };
      m.needsUpdate = true;
    });

    for (var mk in mats) injectRim(mats[mk], mk);

    R.group = group; R.meshes = meshes; R.skeleton = skeleton;
    R.bone = boneIndex; R.parts = parts; R.mats = mats; R.tri = tri;
    return group;
  });
}

/* ==========================================================================
   ANI-2 · TẦNG 1 — tín hiệu điều khiển
   ========================================================================== */
var SIG = {
  look: { x: 0, y: 0 },
  energy: 0, emotion: 'neutral',
  viseme: { jaw: 0, wide: 0 },
  speaking: false, beat: 0,
  spin: 0, spinTarget: 0, tilt: 0, tiltTarget: 0, dragging: false
};

/* ================================= TẦNG 2 — bộ mã hoá ngữ cảnh (latent) === */
var LAT = {
  arousal: 0, valence: 0, emphasis: 0, energy: 0, energyLag: 0,
  lookX: 0, lookY: 0, breath: 0, breathV: 0, spinVel: 0, prevSpin: 0, beat: 0
};
var EMO = {
  neutral: { valence: 0.15, arousal: 0.15, smile: 0.14, brow: 0.02, squint: 0.03, blush: 0.07 },
  happy:   { valence: 0.95, arousal: 0.70, smile: 0.74, brow: 0.22, squint: 0.28, blush: 0.34 },
  playful: { valence: 0.80, arousal: 0.88, smile: 0.58, brow: 0.32, squint: 0.15, blush: 0.27 },
  shy:     { valence: 0.45, arousal: 0.30, smile: 0.32, brow: 0.10, squint: 0.36, blush: 0.64 },
  sad:     { valence: -0.60, arousal: 0.12, smile: -0.30, brow: -0.26, squint: 0.13, blush: 0.05 },
  curious: { valence: 0.35, arousal: 0.48, smile: 0.18, brow: 0.44, squint: 0.00, blush: 0.11 }
};
var SPR = {
  valence: sp(0.15), arousal: sp(0.15), emphasis: sp(0), energy: sp(0),
  energyLag: sp(0), lookX: sp(0), lookY: sp(0), beat: sp(0)
};
function encode(h) {
  var e = EMO[SIG.emotion] || EMO.neutral;
  LAT.valence   = springStep(SPR.valence, e.valence, 3.4, h);
  LAT.arousal   = springStep(SPR.arousal, e.arousal * (0.55 + 0.45 * SIG.energy), 3.8, h);
  LAT.energy    = springStep(SPR.energy, SIG.energy, 16.0, h);
  LAT.energyLag = springStep(SPR.energyLag, LAT.energy, 5.2, h);   /* thân trễ ~1 nhịp */
  LAT.emphasis  = springStep(SPR.emphasis, SIG.speaking ? 1 : 0, 3.6, h);
  LAT.lookX     = springStep(SPR.lookX, SIG.look.x, 7.0, h);
  LAT.lookY     = springStep(SPR.lookY, SIG.look.y, 7.0, h);
  LAT.beat      = springStep(SPR.beat, SIG.beat, 13.0, h);
  SIG.beat *= Math.exp(-9 * h);
  return e;
}

/* =========================== TẦNG 3 — bộ sinh tư thế (residual + cache) === */
var TARGET = {}, POSE = {};
var BASE = {
  'arm left shoulder 2': [0, 0, -0.50], 'arm right shoulder 2': [0, 0, 0.50],
  'arm left elbow': [0.10, 0.16, -0.34], 'arm right elbow': [0.10, -0.16, 0.34],
  'arm left wrist': [0, 0, -0.13], 'arm right wrist': [0, 0, 0.13],
  'arm left shoulder 1': [0, 0, -0.07], 'arm right shoulder 1': [0, 0, 0.07],
  'leg left thigh': [0, 0, -0.035], 'leg right thigh': [0, 0, 0.045],
  'leg left knee': [0.03, 0, 0], 'leg right knee': [0.02, 0, 0],
  'spine lower': [0.012, 0, 0]
};
/* [regex, tần số góc lò xo ω, giới hạn khớp (rad)] */
var GRP = [
  [/^head eyeball/, 42, 0.34],
  [/^head neck/, 17, 0.55],
  [/^head/, 20, 0.55],
  [/^spine|^root hips|^breast/, 7.5, 0.30],
  [/^arm .* finger/, 12, 1.25],
  [/^arm/, 10.5, 1.15],
  [/^leg/, 8, 0.45]
];
function groupOf(name) {
  for (var i = 0; i < GRP.length; i++) if (GRP[i][0].test(name)) return GRP[i];
  return [null, 10, 0.8];
}
function set(name, x, y, z) {
  var base = BASE[name];
  if (base) { x += base[0]; y += base[1]; z += base[2]; }
  var t = TARGET[name];
  if (t) { t[0] = x; t[1] = y; t[2] = z; } else TARGET[name] = [x, y, z];
}
function curlFingers(prefix, amt) {
  var sgn = prefix.indexOf('left') > 0 ? -1 : 1;
  ['2', '3', '4', '5'].forEach(function (d, di) {
    ['a', 'b', 'c'].forEach(function (seg, si) {
      var n = prefix + ' finger ' + d + seg;
      if (R.bone[n]) set(n, 0, 0, sgn * amt * (si === 0 ? 1 : 0.86) * (1 + di * 0.06));
    });
  });
}

/* ---- mô hình mắt–đầu: saccade đạn đạo + dwell + VOR --------------------- */
var GAZE = {
  cx: 0, cy: 0,          /* hướng nhìn hiện tại (mắt)      */
  tx: 0, ty: 0,          /* đích của saccade               */
  sx: 0, sy: 0,          /* điểm xuất phát của saccade      */
  t: 1, dur: 0.06,       /* tiến trình saccade              */
  dwell: 1.2,            /* thời gian giữ mắt tại đích      */
  hx: 0, hy: 0,          /* hướng đầu (chạy theo mắt)       */
  hvx: sp(0), hvy: sp(0)
};
function gaze(h, t) {
  GAZE.dwell -= h;
  if (GAZE.t >= 1 && GAZE.dwell <= 0) {
    /* chọn đích mới: bám con trỏ + lệch ngẫu nhiên (nhìn quanh mặt người) */
    var jx = n11(t * 0.91 + 4.1) * 0.34, jy = n11(t * 0.77 + 9.7) * 0.20;
    GAZE.sx = GAZE.cx; GAZE.sy = GAZE.cy;
    GAZE.tx = clamp(SIG.look.x * 0.85 + jx, -1.1, 1.1);
    GAZE.ty = clamp(SIG.look.y * 0.85 + jy, -0.9, 0.9);
    var amp = Math.hypot(GAZE.tx - GAZE.sx, GAZE.ty - GAZE.sy);
    GAZE.dur = 0.030 + amp * 0.055;                 /* luật chính của saccade */
    GAZE.t = 0;
    GAZE.dwell = 0.32 + Math.random() * (SIG.speaking ? 1.4 : 2.6);
    if (Math.random() < 0.30) CLK.blinkNext = Math.min(CLK.blinkNext, 0.06 + amp * 0.05);
  }
  if (GAZE.t < 1) {
    GAZE.t = Math.min(1, GAZE.t + h / GAZE.dur);
    /* biên dạng vận tốc saccade: nhanh vào, hãm mềm, vọt nhẹ rồi ổn định */
    var p = GAZE.t, e = 1 - Math.pow(1 - p, 3.2);
    e += Math.sin(p * PI) * 0.06;
    GAZE.cx = lerp(GAZE.sx, GAZE.tx, e);
    GAZE.cy = lerp(GAZE.sy, GAZE.ty, e);
  } else {
    /* microsaccade / drift khi cố định */
    GAZE.cx = GAZE.tx + n11(t * 7.3) * 0.010;
    GAZE.cy = GAZE.ty + n11(t * 6.1 + 3) * 0.007;
  }
  /* đầu chạy theo mắt, chậm hơn, biên độ nhỏ hơn */
  GAZE.hx = springStep(GAZE.hvx, GAZE.cx, 4.6, h);
  GAZE.hy = springStep(GAZE.hvy, GAZE.cy, 4.4, h);
}

var CLK = { t: 0, blinkNext: 1.4, blinkT: -1, blinkDouble: false };

function genPose(t, h) {
  /* ---- hô hấp bất đối xứng: hít 38% / thở ra 62% ----------------------- */
  var bp = (t * (0.235 + LAT.arousal * 0.10)) % 1;
  var breath = bp < 0.38
    ? Math.sin((bp / 0.38) * PI * 0.5)
    : Math.cos(((bp - 0.38) / 0.62) * PI * 0.5);
  breath = breath * 2 - 1;
  LAT.breath = breath;

  var ar = LAT.arousal, em = LAT.emphasis, eg = LAT.energyLag;
  var lx = GAZE.hx, ly = GAZE.hy;

  /* ---- thân: hô hấp + dồn trọng tâm chậm (nhiễu, không phải sin) ------- */
  var swayA = fbm(t * 0.21), swayB = fbm(t * 0.17 + 31.7), swayC = fbm(t * 0.13 + 61.3);
  set('spine lower', breath * 0.013 + ar * 0.010, swayA * 0.034, swayB * 0.019);
  set('spine middle', breath * 0.016, swayB * 0.026, swayC * 0.014);
  set('spine upper', breath * 0.014, swayC * 0.018, swayA * 0.010);
  set('spine chest', breath * 0.022 - ar * 0.013, swayA * 0.020, swayB * 0.011);
  set('root hips', 0, swayC * 0.024, swayA * 0.012);
  var hips = R.bone['root hips'];
  if (hips) {
    if (hips.userData.py == null) hips.userData.py = hips.position.y;
    hips.position.y = hips.userData.py + breath * 0.0042 + eg * 0.004 + LAT.beat * 0.004;
  }
  if (R.bone['breast left']) {
    set('breast left', breath * 0.020 + LAT.beat * 0.012, 0, 0);
    set('breast right', breath * 0.020 + LAT.beat * 0.012, 0, 0);
  }

  /* ---- cổ / đầu: nhìn + nhịp thở + nghiêng theo cảm xúc ---------------- */
  var hIdleY = fbm(t * 0.29 + 5) * 0.055, hIdleX = fbm(t * 0.33 + 17) * 0.030;
  var tilt = fbm(t * 0.19 + 41) * 0.026 + LAT.valence * 0.038;
  var nod = LAT.beat * 0.06;
  set('head neck lower', ly * 0.10 + hIdleX * 0.40 + nod * 0.3, lx * 0.13 + hIdleY * 0.3, -lx * 0.02);
  set('head neck middle', ly * 0.12 + nod * 0.35, lx * 0.16 + hIdleY * 0.3, -lx * 0.02 + tilt * 0.3);
  set('head neck upper', ly * 0.21 + hIdleX - LAT.valence * 0.02 + nod * 0.35,
      lx * 0.31 + hIdleY, -lx * 0.05 + tilt);

  /* mắt bù trừ chuyển động đầu (VOR) rồi hướng tới đích thật */
  var eyeX = (GAZE.cx - GAZE.hx * 0.72) * 0.40;
  var eyeY = (GAZE.cy - GAZE.hy * 0.72) * 0.26;
  set('head eyeball left', eyeY, eyeX, 0);
  set('head eyeball right', eyeY, eyeX, 0);
  if (R.bone['head jaw']) set('head jaw', U.mouth.value * 0.20, 0, 0);

  /* ---- tay: nghỉ khi im, đánh nhịp khi nói ----------------------------- */
  var g = em * (0.34 + 0.66 * eg) + LAT.beat * 0.35;
  var n1a = fbm(t * 0.62 + 3), n2a = fbm(t * 0.55 + 23), n3a = fbm(t * 0.71 + 43);
  set('arm left shoulder 2',
      (Math.sin(t * 2.1) * 0.55 + n1a * 0.45) * 0.11 * g,
      (Math.sin(t * 1.7) * 0.5 + n2a * 0.5) * 0.08 * g,
      (Math.sin(t * 1.3) * 0.5 + n3a * 0.5) * 0.14 * g - g * 0.11 + n1a * 0.014);
  set('arm right shoulder 2',
      (Math.sin(t * 2.0 + 1.6) * 0.55 + n2a * 0.45) * 0.10 * g,
      (Math.sin(t * 1.5 + 1.0) * 0.5 + n3a * 0.5) * 0.07 * g,
      -(Math.sin(t * 1.25 + 0.8) * 0.5 + n1a * 0.5) * 0.13 * g + g * 0.11 - n2a * 0.014);
  set('arm left elbow', Math.sin(t * 2.4) * 0.15 * g + n3a * 0.020, 0,
      -Math.sin(t * 1.9) * 0.17 * g - g * 0.17);
  set('arm right elbow', Math.sin(t * 2.3 + 1.2) * 0.14 * g + n1a * 0.020, 0,
      Math.sin(t * 1.8 + 0.6) * 0.16 * g + g * 0.17);
  set('arm left wrist', Math.sin(t * 3.1) * 0.11 * g + n2a * 0.03, 0, 0);
  set('arm right wrist', Math.sin(t * 2.9 + 1) * 0.11 * g + n3a * 0.03, 0, 0);
  curlFingers('arm left', 0.30 - g * 0.15 + n1a * 0.05);
  curlFingers('arm right', 0.30 - g * 0.15 + n2a * 0.05);

  set('leg left thigh', 0, 0, swayA * 0.010);
  set('leg right thigh', 0, 0, swayA * 0.010);
  set('leg left knee', 0, 0, 0);
  set('leg right knee', 0, 0, 0);
}

/* ------------------------ TẦNG 3b — kênh khuôn mặt (viseme + cảm xúc) ---- */
function genFace(h, emo) {
  /* chớp mắt: xuống 62 ms, giữ 22 ms, lên 108 ms — có cả chớp kép */
  if (CLK.blinkT < 0) {
    CLK.blinkNext -= h;
    if (CLK.blinkNext <= 0) {
      CLK.blinkT = 0;
      CLK.blinkNext = 1.6 + Math.random() * 4.4 - LAT.arousal * 0.7;
      CLK.blinkDouble = Math.random() < 0.20;
    }
  } else {
    CLK.blinkT += h;
    var b = CLK.blinkT;
    var v;
    if (b < 0.062) v = Math.pow(b / 0.062, 0.72);
    else if (b < 0.084) v = 1;
    else if (b < 0.192) { var q = (b - 0.084) / 0.108; v = 1 - q * q * (3 - 2 * q); }
    else v = 0;
    U.blink.value = v;
    if (b >= 0.192) {
      CLK.blinkT = -1; U.blink.value = 0;
      if (CLK.blinkDouble) { CLK.blinkNext = 0.075; CLK.blinkDouble = false; }
    }
  }

  /* viseme: bám mục tiêu bằng lò xo, không nhảy bậc */
  var vis = SIG.viseme;
  U.mouth.value = springStep(FSP.mouth, vis.jaw, 27, h);
  U.wide.value = springStep(FSP.wide, vis.wide, 21, h);

  var smileT = emo.smile + LAT.valence * 0.10;
  smileT *= 1 - 0.55 * clamp(U.mouth.value, 0, 1);      /* miệng mở thì khoé nhường chỗ */
  U.smile.value = springStep(FSP.smile, smileT, 5.0, h);
  U.brow.value = springStep(FSP.brow, emo.brow + LAT.energy * 0.10 + LAT.beat * 0.08, 5.4, h);
  U.squint.value = springStep(FSP.squint,
      emo.squint * (1 - U.blink.value) + Math.max(0, U.smile.value) * 0.22, 4.6, h);
  U.blush.value = springStep(FSP.blush, emo.blush + LAT.arousal * 0.12, 1.7, h);

  U.smile.value = clamp(U.smile.value, -0.45, 0.88);
  U.brow.value = clamp(U.brow.value, -0.40, 0.72);
  U.squint.value = clamp(U.squint.value, 0, 0.58);
  U.blush.value = clamp(U.blush.value, 0, 0.82);
  U.mouth.value = clamp(U.mouth.value, 0, 1);
  U.wide.value = clamp(U.wide.value, 0, 1);
}
var FSP = { mouth: sp(0), wide: sp(0), smile: sp(0), brow: sp(0), squint: sp(0), blush: sp(0) };

/* ==========================================================================
   TẦNG 4 — SPRING-BONE PBD (kiểu VRM): quán tính thật, giữ chiều dài xương
   ========================================================================== */
/* k = độ cứng (ω = √k rad/s) · zeta = tỉ số tắt dần · maxAng = nón giới hạn.
   Nón giới hạn là "dây an toàn": dù lực có sai lệch thế nào, xương cũng
   không thể lật quá góc này so với tư thế nghỉ. */
var SPRING_TUNE = {
  bangs:  { k: 260, zeta: 0.62, grav: 0.6, lod: 0, maxAng: 0.38 },
  hair:   { k: 118, zeta: 0.34, grav: 1.5, lod: 0, maxAng: 0.72 },
  skirt:  { k:  95, zeta: 0.42, grav: 1.9, lod: 1, maxAng: 0.58 },
  ribbon: { k:  74, zeta: 0.26, grav: 1.1, lod: 2, maxAng: 0.95 },
  petal:  { k:  88, zeta: 0.30, grav: 1.3, lod: 2, maxAng: 0.78 }
};
var SPRING_RE = /^(hair|skirt|outfit ribbon|outfit bow|outfit petal)/;

function kindOf(name) {
  if (/^hair bangs/.test(name)) return 'bangs';
  if (/^hair/.test(name)) return 'hair';
  if (/^skirt/.test(name)) return 'skirt';
  if (/^outfit petal/.test(name)) return 'petal';
  return 'ribbon';
}

function buildSprings() {
  var joints = [];
  R.group.updateMatrixWorld(true);

  function walk(bone, depth) {
    var kids = [], i;
    for (i = 0; i < bone.children.length; i++) {
      var c = bone.children[i];
      if (c.isBone && SPRING_RE.test(c.name)) kids.push(c);
    }
    /* Chỉ mô phỏng khớp có đúng một con: "hub" nhiều nhánh (gốc váy, gốc
       nơ) phải đứng yên, nếu không cả chùm sẽ xoay theo một nhánh. */
    if (kids.length === 1) {
      var child = kids[0];
      var len = child.position.length();
      if (len > 1e-5) {
        var T = SPRING_TUNE[kindOf(bone.name)];
        joints.push({
          b: bone,
          axis: child.position.clone().normalize(),
          initQ: bone.quaternion.clone(),
          len: len,
          tail: child.getWorldPosition(new THREE.Vector3()),
          prev: child.getWorldPosition(new THREE.Vector3()),
          k: T.k * (1 + depth * 0.05),
          zeta: T.zeta,
          damp: 0.9,
          grav: T.grav,
          lod: T.lod,
          maxAng: T.maxAng,
          cosMax: Math.cos(T.maxAng),
          stale: 1,
          depth: depth
        });
      }
    }
    for (i = 0; i < kids.length; i++) walk(kids[i], depth + 1);
  }

  for (var n in R.bone) {
    if (!SPRING_RE.test(n)) continue;
    var bone = R.bone[n];
    if (bone.parent && bone.parent.isBone && SPRING_RE.test(bone.parent.name)) continue;
    walk(bone, 0);
  }
  /* xử lý từ gốc ra ngọn để ma trận cha luôn mới khi tới lượt con */
  joints.sort(function (a, b) { return a.depth - b.depth; });
  return joints;
}

var _hp = new THREE.Vector3(), _hq = new THREE.Quaternion(), _hs = new THREE.Vector3();
var _rest = new THREE.Vector3(), _next = new THREE.Vector3(), _dir = new THREE.Vector3();
var _from = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion();
var _tq = new THREE.Quaternion(), _wind = new THREE.Vector3();
var _ax = new THREE.Vector3(), _cq = new THREE.Quaternion();

var SPRING_H = 1 / 60, springAcc = 0, dampH = 0;

function stepSprings(h, t, lodMax) {
  var J = R.joints, i, j;
  var hh = h * h;

  /* hệ số tắt dần Verlet phụ thuộc bước thời gian → chỉ tính lại khi h đổi */
  if (dampH !== h) {
    dampH = h;
    for (i = 0; i < J.length; i++) {
      j = J[i];
      j.damp = Math.exp(-2 * j.zeta * Math.sqrt(j.k) * h);
    }
  }

  /* gió nhẹ + quán tính khi người dùng xoay nhân vật */
  _wind.set(
    fbm(t * 0.53) * 0.55 - LAT.spinVel * 18.0,
    fbm(t * 0.67 + 29) * 0.22,
    fbm(t * 0.41 + 13) * 0.35 - LAT.energyLag * 0.25);

  for (i = 0; i < J.length; i++) {
    j = J[i];
    if (j.lod > lodMax) {
      /* LOD: trả xương về tư thế nghỉ một cách mượt, và đánh dấu "stale" —
         khi bật lại phải nạp lại đuôi theo tư thế nghỉ, nếu không toạ độ
         thế giới cũ sẽ giật một phát rất mạnh. */
      j.b.quaternion.slerp(j.initQ, 1 - Math.exp(-8 * h));
      j.stale = 1;
      j.b.updateMatrix();
      if (j.b.parent) j.b.matrixWorld.multiplyMatrices(j.b.parent.matrixWorld, j.b.matrix);
      continue;
    }
    /* Chuẩn hoá ở MỌI bước bàn giao. three.Quaternion.invert() thực chất chỉ
       là conjugate — đúng nghịch đảo khi và chỉ khi quaternion đơn vị. Một
       sai số nhỏ sẽ được khuếch đại mỗi khung: compose() với quaternion
       không đơn vị sinh ma trận bị trượt (shear), decompose() trả về scale
       không đều, rồi vòng lặp tự khuếch đại đến khi quaternion sụp về 0. */
    j.b.matrixWorld.decompose(_hp, _hq, _hs);
    _hq.normalize();
    _q.copy(j.b.quaternion).normalize().invert();
    _pq.copy(_hq).multiply(_q).normalize();                       /* xoay của cha */
    _tq.copy(_pq).multiply(j.initQ).normalize();                  /* xoay lúc nghỉ */

    /* đuôi ở tư thế nghỉ */
    _from.copy(j.axis).applyQuaternion(_tq).normalize();
    _rest.copy(_from).multiplyScalar(j.len).add(_hp);

    /* nạp lại trạng thái khi vừa bật lại, hoặc khi số liệu hỏng */
    if (j.stale || !isFinite(j.tail.x + j.tail.y + j.tail.z + j.prev.x + j.prev.y + j.prev.z)) {
      j.tail.copy(_rest); j.prev.copy(_rest); j.stale = 0;
    }

    /* Verlet: quán tính + lực hồi vị + trọng lực + gió */
    _next.copy(j.tail).sub(j.prev).multiplyScalar(j.damp);
    _dir.copy(_rest).sub(j.tail).multiplyScalar(j.k);
    _dir.y -= j.grav;
    _dir.addScaledVector(_wind, j.grav * 0.55);
    _next.addScaledVector(_dir, hh).add(j.tail);

    /* ràng buộc 1 — giữ nguyên chiều dài xương */
    _next.sub(_hp);
    var L = _next.length();
    if (L < 1e-6) _next.copy(_from).multiplyScalar(j.len);
    else _next.multiplyScalar(j.len / L);

    /* ràng buộc 2 — nón giới hạn quanh tư thế nghỉ */
    _dir.copy(_next).multiplyScalar(1 / j.len);
    var clamped = false;
    if (_from.dot(_dir) < j.cosMax) {
      clamped = true;
      _ax.crossVectors(_from, _dir);
      if (_ax.lengthSq() < 1e-12) _dir.copy(_from);
      else {
        _ax.normalize();
        _cq.setFromAxisAngle(_ax, j.maxAng);
        _dir.copy(_from).applyQuaternion(_cq);
      }
      _next.copy(_dir).multiplyScalar(j.len);
    }
    _next.add(_hp);

    j.prev.copy(clamped ? _next : j.tail);   /* chạm mép nón thì triệt vận tốc */
    j.tail.copy(_next);

    /* quay xương sao cho trục hướng đúng vào đuôi */
    _q.setFromUnitVectors(_from, _dir);
    j.b.quaternion.copy(_pq).invert().multiply(_q).multiply(_pq).multiply(j.initQ).normalize();
    /* lưới an toàn cuối: quaternion suy biến thì về tư thế nghỉ, không lan */
    var ql = j.b.quaternion.lengthSq();
    if (!(ql > 0.5 && ql < 2)) { j.b.quaternion.copy(j.initQ); j.stale = 1; }

    /* cập nhật ma trận thế giới tại chỗ để con kế thừa ngay — giữ O(n) */
    j.b.updateMatrix();
    if (j.b.parent) j.b.matrixWorld.multiplyMatrices(j.b.parent.matrixWorld, j.b.matrix);
    else j.b.matrixWorld.copy(j.b.matrix);
  }
}

/* ============================= TẦNG 5 — bộ giải ràng buộc + xuất rig ====== */
function solve(h) {
  for (var name in TARGET) {
    var bone = R.bone[name];
    if (!bone) continue;
    var tgt = TARGET[name], p = POSE[name];
    if (!p) p = POSE[name] = { sx: sp(0), sy: sp(0), sz: sp(0), px: 0, py: 0, pz: 0, cx: 0, cy: 0, cz: 0 };
    var G = bone.userData.grp || (bone.userData.grp = groupOf(name));
    var om = G[1], lim = G[2];
    p.px = p.cx; p.py = p.cy; p.pz = p.cz;
    p.cx = clamp(springStep(p.sx, tgt[0], om, h), -lim, lim);
    p.cy = clamp(springStep(p.sy, tgt[1], om, h), -lim, lim);
    p.cz = clamp(springStep(p.sz, tgt[2], om, h), -lim, lim);
  }
}
/* Nội suy trạng thái ra rig — đây là thứ khử giật khi fps dao động. */
function applyPose(a) {
  for (var name in POSE) {
    var bone = R.bone[name];
    if (!bone) continue;
    var p = POSE[name];
    bone.rotation.set(
      p.px + (p.cx - p.px) * a,
      p.py + (p.cy - p.py) * a,
      p.pz + (p.cz - p.pz) * a);
  }
}

/* ==================================== bộ lập lịch + điều tiết ngân sách === */
var ENG = {
  acc: 0, h: 1 / 120, maxSteps: 3, lod: 2,
  simMs: 0, steps: 0, fps: 60, fpsAcc: 0, fpsN: 0, fpsT: 0,
  over: 0, under: 0
};
function setHz(hz) { ENG.h = 1 / hz; }

function simStep(h) {
  CLK.t += h;
  var emo = encode(h);
  gaze(h, CLK.t);
  genPose(CLK.t, h);
  genFace(h, emo);
  solve(h);

  LAT.spinVel = (SIG.spin - LAT.prevSpin) / h * 0.02;
  LAT.prevSpin = SIG.spin;
  if (!SIG.dragging) {
    SIG.spin += (SIG.spinTarget - SIG.spin) * (1 - Math.exp(-1.9 * h));
    SIG.tilt += (SIG.tiltTarget - SIG.tilt) * (1 - Math.exp(-2.6 * h));
  }
}

function motion(dt) {
  var t0 = performance.now();

  ENG.acc += dt;
  var h = ENG.h, n = 0;
  while (ENG.acc >= h && n < ENG.maxSteps) { simStep(h); ENG.acc -= h; n++; }
  if (ENG.acc > h) ENG.acc = h;                        /* chống xoắn ốc chết */
  ENG.steps = n;

  applyPose(ENG.acc / h);
  R.group.rotation.y = SIG.spin;
  R.group.rotation.x = SIG.tilt;
  R.group.updateMatrixWorld(true);

  /* Lò xo chạy trên nhịp cố định 60 Hz riêng: Verlet chỉ đúng khi bước thời
     gian không đổi, và tóc/váy không cần hơn 60 Hz. */
  if (cfg.spring && R.joints) {
    springAcc += dt;
    var sn = 0;
    while (springAcc >= SPRING_H && sn < 3) { stepSprings(SPRING_H, CLK.t, ENG.lod); springAcc -= SPRING_H; sn++; }
    if (springAcc > SPRING_H) springAcc = SPRING_H;
  }

  var ms = performance.now() - t0;
  ENG.simMs += (ms - ENG.simMs) * 0.10;

  /* ---- điều tiết ngân sách: giữ motion trong cfg.budget ms/khung -------- */
  if (ENG.simMs > cfg.budget) {
    ENG.over++; ENG.under = 0;
    if (ENG.over > 26) {
      ENG.over = 0;
      if (ENG.maxSteps > 1) ENG.maxSteps--;
      else if (ENG.lod > -1) ENG.lod--;
    }
  } else if (ENG.simMs < cfg.budget * 0.62) {
    ENG.under++; ENG.over = 0;
    if (ENG.under > 90) {
      ENG.under = 0;
      if (ENG.lod < 2) ENG.lod++;
      else if (ENG.maxSteps < 3) ENG.maxSteps++;
    }
  }
}

function initMotion() {
  R.joints = buildSprings();
  for (var n in BASE) if (R.bone[n]) set(n, 0, 0, 0);
  simStep(ENG.h);
  /* nạp sẵn cache ở tư thế nghỉ để khung đầu tiên không bị giật */
  for (var m in POSE) {
    var p = POSE[m], tg = TARGET[m];
    p.sx.x = p.cx = p.px = tg[0]; p.sy.x = p.cy = p.py = tg[1]; p.sz.x = p.cz = p.pz = tg[2];
  }
}

/* ============================================================== camera ==== */
var FRAMES = {
  face: { y: 1.545, dist: 0.92, glow: 1.00, label: 'Cận mặt' },
  bust: { y: 1.230, dist: 2.32, glow: 0.95, label: 'Bán thân' },
  full: { y: 0.900, dist: 4.05, glow: 0.62, label: 'Toàn thân' }
};
var FRAME_ORDER = ['face', 'bust', 'full'];
var camState = { y: sp(FRAMES.bust.y), d: sp(FRAMES.bust.dist), target: FRAMES.bust };
function setFrame(name) {
  cfg.frame = name; save();
  camState.target = FRAMES[name];
  $('#frameLabel').textContent = FRAMES[name].label;
  el.charGlow.style.opacity = String(FRAMES[name].glow);
}

/* ================================================================= chat === */
var history = [];
var CANNED = [
  'Ừ tớ nghe đây, kể tiếp đi cậu.',
  'Nghe hay đấy! Rồi sao nữa?',
  'Tớ thì tớ chọn đi luôn, ngồi tính mãi mệt lắm.',
  'Cậu hỏi khó thế, để tớ nghĩ… mà thôi, cứ làm đi!',
  'Hôm nay cậu thế nào? Kể tớ nghe với.',
  'Tớ đang ở đây mà, không đi đâu cả.',
  'Nghe kiểu này là phải rủ nhau đi đâu đó rồi.',
  'Được, tớ ghi nhớ. Còn gì nữa không?',
  'Paris đêm nay đẹp thật đấy, cậu nhìn tháp kìa.',
  'Thôi đừng nghĩ nhiều, đứng đây với tớ một lát đã.'
];
function cannedReply(text) {
  var s = (text || '').toLowerCase();
  if (/^(hi|hello|chào|hey|alo|ê)/.test(s)) return 'Hế lô cậu! Tớ là Ani. Hôm nay có gì vui không?';
  if (/tên|name/.test(s)) return 'Tớ là Ani. Còn cậu tên gì?';
  if (/(buồn|mệt|stress|tệ|chán)/.test(s)) return 'Thôi nào, nghỉ một lát đi. Tớ ngồi đây với cậu.';
  if (/(đẹp|xinh|dễ thương)/.test(s)) return 'Hihi, cậu khen là tớ đỏ mặt đấy nhé.';
  if (/(paris|tháp|eiffel)/.test(s)) return 'Tháp Eiffel lấp lánh mỗi giờ một lần đấy, cậu ngắm cùng tớ nhé.';
  if (/\?$/.test(s.trim())) return 'Câu này thì… tớ nghĩ cậu đã biết câu trả lời rồi đấy.';
  return CANNED[Math.floor(Math.random() * CANNED.length)];
}
function brainLabel() {
  if (cfg.endpoint && cfg.key) return 'Đang dùng API của bạn: ' + cfg.endpoint.replace(/^https?:\/\//, '').slice(0, 38);
  return 'Chưa cấu hình API → Ani trả lời offline bằng câu mẫu (vẫn nói và nhép miệng bình thường).';
}
function ask(text) {
  history.push({ role: 'user', content: text });
  if (history.length > 12) history = history.slice(-12);
  if (cfg.endpoint && cfg.key) {
    return fetch(cfg.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({
        model: cfg.model || 'gpt-4o-mini', max_tokens: 220,
        messages: [{ role: 'system', content: cfg.persona }].concat(history)
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var out = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!out && j && j.content && j.content[0]) out = j.content[0].text;
      return out || cannedReply(text);
    }).catch(function () { return cannedReply(text); });
  }
  return new Promise(function (res) {
    setTimeout(function () { res(cannedReply(text)); }, 420 + Math.random() * 520);
  });
}
function detectEmotion(text) {
  var s = (text || '').toLowerCase();
  if (/(hihi|haha|vui|tuyệt|yêu|thích|hay quá|😄|!{2,})/.test(s)) return 'happy';
  if (/(trêu|đùa|nghịch|thôi nào|đi mà|nhé!)/.test(s)) return 'playful';
  if (/(xin lỗi|ngại|hic|thôi mà|đỏ mặt)/.test(s)) return 'shy';
  if (/(buồn|tiếc|tệ|mệt|thương)/.test(s)) return 'sad';
  if (/\?/.test(s)) return 'curious';
  return /!/.test(s) ? 'happy' : 'neutral';
}
function setMood(m) {
  SIG.emotion = m;
  $$('#moodBar .mood').forEach(function (b) { b.classList.toggle('on', b.dataset.mood === m); });
}
function bubble(who, text) {
  var d = document.createElement('div');
  d.className = 'bub ' + (who === 'me' ? 'me' : 'ani');
  var w = document.createElement('span');
  w.className = 'who'; w.textContent = who === 'me' ? 'bạn' : 'ani';
  d.appendChild(w);
  d.appendChild(document.createTextNode(text));
  el.bubbles.appendChild(d);
  while (el.bubbles.children.length > 6) el.bubbles.removeChild(el.bubbles.firstChild);
  return d;
}
function typingBubble() {
  var d = document.createElement('div');
  d.className = 'bub ani typing';
  d.innerHTML = '<i></i><i></i><i></i>';
  el.bubbles.appendChild(d);
  return d;
}

/* ================================================ TTS + lịch trình viseme = */
var voices = [];
function loadVoices() {
  if (!window.speechSynthesis) return;
  voices = speechSynthesis.getVoices() || [];
  var sel = $('#fVoice');
  if (!sel) return;
  sel.innerHTML = '';
  var pref = voices.filter(function (v) { return /^vi/i.test(v.lang); });
  var rest = voices.filter(function (v) { return !/^vi/i.test(v.lang); });
  pref.concat(rest).forEach(function (v) {
    var o = document.createElement('option');
    o.value = v.name; o.textContent = v.name + ' · ' + v.lang;
    sel.appendChild(o);
  });
  if (!voices.length) {
    var o2 = document.createElement('option');
    o2.textContent = 'Không có giọng nào'; sel.appendChild(o2);
  }
  if (!cfg.voice && pref.length) cfg.voice = pref[0].name;
  if (cfg.voice) sel.value = cfg.voice;
}
function pickVoice() {
  var v = voices.filter(function (x) { return x.name === cfg.voice; })[0];
  return v || voices.filter(function (x) { return /^vi/i.test(x.lang); })[0] || voices[0] || null;
}

/* nguyên âm -> (độ mở hàm, độ rộng miệng). Âm tiết tiếng Việt một nhân vần. */
var VOWEL = {
  a: [0.95, 0.55], 'ă': [0.84, 0.50], 'â': [0.68, 0.40],
  e: [0.72, 0.85], 'ê': [0.56, 0.90],
  i: [0.34, 1.00], y: [0.34, 1.00],
  o: [0.76, 0.05], 'ô': [0.60, 0.00], 'ơ': [0.60, 0.25],
  u: [0.40, 0.00], 'ư': [0.40, 0.20]
};
var DEACC = {
  'á':'a','à':'a','ả':'a','ã':'a','ạ':'a','ắ':'ă','ằ':'ă','ẳ':'ă','ẵ':'ă','ặ':'ă',
  'ấ':'â','ầ':'â','ẩ':'â','ẫ':'â','ậ':'â','é':'e','è':'e','ẻ':'e','ẽ':'e','ẹ':'e',
  'ế':'ê','ề':'ê','ể':'ê','ễ':'ê','ệ':'ê','í':'i','ì':'i','ỉ':'i','ĩ':'i','ị':'i',
  'ó':'o','ò':'o','ỏ':'o','õ':'o','ọ':'o','ố':'ô','ồ':'ô','ổ':'ô','ỗ':'ô','ộ':'ô',
  'ớ':'ơ','ờ':'ơ','ở':'ơ','ỡ':'ơ','ợ':'ơ','ú':'u','ù':'u','ủ':'u','ũ':'u','ụ':'u',
  'ứ':'ư','ừ':'ư','ử':'ư','ữ':'ư','ự':'ư','ý':'y','ỳ':'y','ỷ':'y','ỹ':'y','ỵ':'y'
};
function deaccent(c) { return DEACC[c] || c; }
/* Phụ âm môi (b, p, m) đóng miệng hoàn toàn — mốc quan trọng khi nhép. */
var LABIAL = { b: 1, p: 1, m: 1, v: 0.6, ph: 0.6 };

function schedule(text) {
  var words = text.split(/\s+/).filter(Boolean), out = [], wi;
  for (wi = 0; wi < words.length; wi++) {
    var raw = words[wi].toLowerCase();
    var w = raw.replace(/[^\p{L}]/gu, '');
    var core = null, ci = -1;
    for (var i = 0; i < w.length; i++) {
      var c = deaccent(w[i]);
      if (VOWEL[c]) { core = VOWEL[c]; ci = i; break; }
    }
    if (!core) core = [0.30, 0.40];
    /* nguyên âm đôi: lấy thêm nhân thứ hai để miệng chuyển hình */
    var core2 = null;
    for (var j = ci + 1; j < w.length; j++) {
      var c2 = deaccent(w[j]);
      if (VOWEL[c2]) { core2 = VOWEL[c2]; break; }
      break;
    }
    var lab = LABIAL[w[0]] || 0;
    var stop = /[.!?,;:…]$/.test(raw);
    out.push({
      jaw: core[0], wide: core[1],
      jaw2: core2 ? core2[0] : core[0], wide2: core2 ? core2[1] : core[1],
      labial: lab,
      dur: 150 + w.length * 24,
      pause: stop ? 230 : 48,
      wi: wi
    });
  }
  return out;
}
var VS = { list: [], t0: 0, active: false, wordAt: {}, total: 0 };
function startSpeech(text) {
  VS.list = schedule(text); VS.t0 = performance.now(); VS.active = true;
  var acc = 0; VS.wordAt = {};
  for (var i = 0; i < VS.list.length; i++) {
    VS.wordAt[VS.list[i].wi] = acc;
    VS.list[i].at = acc;
    acc += VS.list[i].dur + VS.list[i].pause;
  }
  VS.total = acc;
  SIG.speaking = true;
}
function stopSpeech() {
  VS.active = false; SIG.speaking = false;
  SIG.viseme.jaw = 0; SIG.viseme.wide = 0; SIG.energy = 0;
}
function resync(charIndex, text) {
  var upto = text.slice(0, charIndex).split(/\s+/).filter(Boolean).length;
  var off = VS.wordAt[upto];
  if (off != null) VS.t0 = performance.now() - off;
}
/* Trộn đồng phát âm: mỗi thời điểm là tổng có trọng số của các âm lân cận,
   thay vì con trỏ nhảy từng từ như bản cũ. */
function pumpViseme() {
  if (!VS.active) { SIG.energy *= 0.82; return; }
  var now = performance.now() - VS.t0;
  if (now > VS.total) { stopSpeech(); return; }

  var jaw = 0, wide = 0, wsum = 0, energy = 0;
  for (var i = 0; i < VS.list.length; i++) {
    var s = VS.list[i];
    var mid = s.at + s.dur * 0.5;
    var d = Math.abs(now - mid);
    var span = s.dur * 0.92 + 70;
    if (d > span) continue;
    var w = 0.5 + 0.5 * Math.cos(PI * d / span);
    w *= w;
    var f = clamp((now - s.at) / s.dur, 0, 1);
    jaw += lerp(s.jaw, s.jaw2, f) * w;
    wide += lerp(s.wide, s.wide2, f) * w;
    energy = Math.max(energy, w * (0.45 + 0.55 * s.jaw));
    wsum += w;
    /* đánh nhịp cơ thể ở đầu mỗi âm tiết mạnh */
    if (!s.hit && now >= s.at && s.jaw > 0.6) { s.hit = 1; SIG.beat = Math.min(1, SIG.beat + 0.55); }
  }
  if (wsum > 0.0001) { jaw /= wsum; wide /= wsum; } else { jaw = 0; wide = 0; }

  /* đóng môi ở phụ âm môi + khoảng lặng giữa từ */
  for (var k = 0; k < VS.list.length; k++) {
    var q = VS.list[k];
    if (!q.labial) continue;
    var dd = Math.abs(now - q.at);
    if (dd < 55) jaw *= 1 - q.labial * (1 - dd / 55);
  }
  SIG.viseme.jaw = clamp(jaw, 0, 1);
  SIG.viseme.wide = clamp(wide, 0, 1);
  SIG.energy = clamp(energy, 0, 1);
}
function speak(text) {
  setMood(detectEmotion(text));
  if (!window.speechSynthesis) {
    startSpeech(text);
    setTimeout(stopSpeech, Math.min(11000, VS.total || text.length * 70));
    return;
  }
  try { speechSynthesis.cancel(); } catch (e) {}
  var u = new SpeechSynthesisUtterance(text), v = pickVoice();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'vi-VN';
  u.rate = cfg.rate; u.pitch = cfg.pitch;
  u.onstart = function () { startSpeech(text); };
  u.onboundary = function (e) { if (VS.active && e.name !== 'sentence') resync(e.charIndex, text); };
  u.onend = stopSpeech; u.onerror = stopSpeech;
  speechSynthesis.speak(u);
  /* iOS đôi khi không bắn sự kiện nào: vẫn cho miệng chạy */
  setTimeout(function () {
    if (!SIG.speaking) {
      startSpeech(text);
      setTimeout(function () { if (VS.active) stopSpeech(); }, Math.min(11000, VS.total || text.length * 75));
    }
  }, 520);
}

function send(text) {
  text = (text || '').trim();
  if (!text) return;
  el.msg.value = '';
  bubble('me', text);
  setMood('curious');
  var tb = typingBubble();
  ask(text).then(function (reply) {
    tb.remove();
    history.push({ role: 'assistant', content: reply });
    bubble('ani', reply);
    speak(reply);
  });
}

/* ================================================================== mic === */
var rec = null, recOn = false;
function initMic() {
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var btn = $('#btnMic');
  if (!SR) { btn.addEventListener('click', function () { el.msg.focus(); }); return; }
  rec = new SR(); rec.lang = 'vi-VN'; rec.interimResults = true; rec.continuous = false;
  rec.onresult = function (e) {
    var s = '';
    for (var i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
    el.msg.value = s;
    if (e.results[e.results.length - 1].isFinal) { recOn = false; btn.classList.remove('rec'); send(s); }
  };
  rec.onend = rec.onerror = function () { recOn = false; btn.classList.remove('rec'); };
  btn.addEventListener('click', function () {
    if (recOn) { try { rec.stop(); } catch (e) {} return; }
    try { rec.start(); recOn = true; btn.classList.add('rec'); } catch (e) {}
  });
}

/* ============================================================ trang phục == */
function applyOutfit(name) {
  cfg.outfit = name; save();
  R.meshes.forEach(function (m) {
    var pi = m.userData.part;
    if (SET_A[pi]) m.visible = name === 'a';
    else if (SET_B[pi]) m.visible = name === 'b';
  });
  var lb = $('#outfitLabel');
  if (lb) lb.textContent = name === 'a' ? 'Váy gothic' : 'Đầm ren';
}

/* ================================================================== UI ==== */
function bindUI() {
  $('#fPersona').value = cfg.persona;
  $('#fRate').value = cfg.rate; $('#lblRate').textContent = (+cfg.rate).toFixed(2);
  $('#fPitch').value = cfg.pitch; $('#lblPitch').textContent = (+cfg.pitch).toFixed(2);
  $('#fEndpoint').value = cfg.endpoint; $('#fKey').value = cfg.key; $('#fModel').value = cfg.model;
  $('#fOpa').value = cfg.opa; $('#lblOpa').textContent = (+cfg.opa).toFixed(2);
  $('#fBudget').value = cfg.budget; $('#lblBudget').textContent = (+cfg.budget).toFixed(1);
  $('#fHz').value = String(cfg.hz);
  $('#fDust').checked = cfg.dust; $('#fGrain').checked = cfg.grain;
  $('#fSparkle').checked = cfg.sparkle; $('#fSpring').checked = cfg.spring;
  document.documentElement.style.setProperty('--bubbleOpa', cfg.opa);
  el.grain.style.display = cfg.grain ? '' : 'none';
  el.stats.classList.toggle('hidden', !cfg.stats);
  $('#brainHint').textContent = brainLabel();
  setHz(cfg.hz);

  $('#fPersona').addEventListener('input', function () { cfg.persona = this.value; save(); });
  $('#fVoice').addEventListener('change', function () { cfg.voice = this.value; save(); });
  $('#fRate').addEventListener('input', function () { cfg.rate = +this.value; $('#lblRate').textContent = cfg.rate.toFixed(2); save(); });
  $('#fPitch').addEventListener('input', function () { cfg.pitch = +this.value; $('#lblPitch').textContent = cfg.pitch.toFixed(2); save(); });
  $('#btnTestVoice').addEventListener('click', function () { speak('Chào cậu, tớ là Ani. Nghe giọng tớ thế nào?'); });
  ['#fEndpoint', '#fKey', '#fModel'].forEach(function (sel) {
    $(sel).addEventListener('input', function () {
      cfg.endpoint = $('#fEndpoint').value.trim();
      cfg.key = $('#fKey').value.trim();
      cfg.model = $('#fModel').value.trim();
      save(); $('#brainHint').textContent = brainLabel();
    });
  });
  $('#fOpa').addEventListener('input', function () {
    cfg.opa = +this.value; $('#lblOpa').textContent = cfg.opa.toFixed(2);
    document.documentElement.style.setProperty('--bubbleOpa', cfg.opa); save();
  });
  $('#fBudget').addEventListener('input', function () {
    cfg.budget = +this.value; $('#lblBudget').textContent = cfg.budget.toFixed(1);
    ENG.over = ENG.under = 0; save();
  });
  $('#fHz').addEventListener('change', function () { cfg.hz = +this.value; setHz(cfg.hz); save(); });
  $('#fDust').addEventListener('change', function () { cfg.dust = this.checked; save(); });
  $('#fGrain').addEventListener('change', function () {
    cfg.grain = this.checked; el.grain.style.display = cfg.grain ? '' : 'none'; save();
  });
  $('#fSparkle').addEventListener('change', function () { cfg.sparkle = this.checked; save(); });
  $('#fSpring').addEventListener('change', function () { cfg.spring = this.checked; save(); });
  $('#btnClear').addEventListener('click', function () {
    history = []; el.bubbles.innerHTML = ''; el.sheet.classList.add('hidden');
  });

  $('#btnSettings').addEventListener('click', function () {
    loadVoices(); $('#brainHint').textContent = brainLabel(); el.sheet.classList.remove('hidden');
  });
  $('#btnCloseSheet').addEventListener('click', function () { el.sheet.classList.add('hidden'); });
  el.sheet.addEventListener('click', function (e) { if (e.target === el.sheet) el.sheet.classList.add('hidden'); });
  $('#btnStats').addEventListener('click', function () {
    cfg.stats = !cfg.stats; el.stats.classList.toggle('hidden', !cfg.stats); save();
  });

  $('#btnFrame').addEventListener('click', function () {
    var i = FRAME_ORDER.indexOf(cfg.frame);
    setFrame(FRAME_ORDER[(i + 1) % FRAME_ORDER.length]);
  });
  $('#btnOutfit').addEventListener('click', function () { applyOutfit(cfg.outfit === 'a' ? 'b' : 'a'); });
  $('#btnSend').addEventListener('click', function () { send(el.msg.value); });
  el.msg.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(el.msg.value); });
  $$('#moodBar .mood').forEach(function (b) {
    b.addEventListener('click', function () { setMood(b.dataset.mood); });
  });
  setMood('neutral');
}

function initPointer(dom) {
  var dragging = false, lastX = 0, lastY = 0, moved = 0;
  function pt(e) { return e.touches ? e.touches[0] : e; }
  function down(e) {
    var p = pt(e); lastX = p.clientX; lastY = p.clientY; moved = 0;
    dragging = true; SIG.dragging = true;
  }
  function move(e) {
    var p = pt(e);
    if (!dragging) {
      SIG.look.x = (p.clientX / window.innerWidth - 0.5) * 2;
      SIG.look.y = (p.clientY / window.innerHeight - 0.5) * 2;
      return;
    }
    var dx = p.clientX - lastX, dy = p.clientY - lastY;
    lastX = p.clientX; lastY = p.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    SIG.spin += dx * 0.0078;
    SIG.tilt = clamp(SIG.tilt + dy * 0.0016, -0.17, 0.17);
    SIG.tiltTarget = SIG.tilt * 0.55;
    if (e.cancelable) e.preventDefault();
  }
  function up() {
    dragging = false; SIG.dragging = false;
    SIG.spinTarget = SIG.spin; SIG.tiltTarget = SIG.tilt * 0.35;
  }
  dom.addEventListener('touchstart', down, { passive: true });
  dom.addEventListener('touchmove', move, { passive: false });
  dom.addEventListener('touchend', up);
  dom.addEventListener('mousedown', down);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  window.addEventListener('dblclick', function () {
    SIG.spin = 0; SIG.spinTarget = 0; SIG.tilt = 0; SIG.tiltTarget = 0;
  });
}

function fail(msg) {
  el.bootErr.classList.remove('hidden');
  el.bootErr.textContent = msg;
  setProgress(0);
}

/* ================================================================= boot === */
function boot() {
  cacheEl();
  bindUI();
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
  initMic();

  var drawSparks = initBackground();
  var drawDust = initDust();

  if (!window.THREE) { fail('Không nạp được three.js — file bị cắt khi tải về. Hãy tải lại bản đầy đủ.'); return; }
  if (!window.ANI_DATA) { fail('Không tìm thấy dữ liệu model (ANI_DATA).'); return; }
  setProgress(0.08);

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: el.gl, antialias: true, alpha: true,
      preserveDrawingBuffer: true, powerPreference: 'high-performance'
    });
  } catch (e) {
    fail('Thiết bị không hỗ trợ WebGL.'); return;
  }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0);

  setProgress(0.16);

  build(window.ANI_DATA, setProgress).then(function (group) {
    setProgress(0.84);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(27, 1, 0.05, 40);
    scene.add(group);

    /* Ánh sáng đêm Paris. Tổng cường độ được giữ thấp: với vật liệu toon,
       mọi đèn định hướng đều cộng "sàn" của dải chuyển lên toàn bề mặt, nên
       cộng dồn quá 1.0 là kênh đỏ của da bị bão hoà trước → mặt đỏ như bản
       cũ. Bốn đèn dưới đây cộng lại ~1.6, sàn 0.094 → vùng tối ~0.3. */
    scene.add(new THREE.HemisphereLight(0x7d94d8, 0x140f1e, 0.30));
    var key = new THREE.DirectionalLight(0xffe4c2, 0.82); key.position.set(-1.35, 1.50, 1.70); scene.add(key);
    var fill = new THREE.DirectionalLight(0x9ab6ff, 0.24); fill.position.set(1.55, 0.60, 1.25); scene.add(fill);
    var rimL = new THREE.DirectionalLight(0xffb35e, 0.30); rimL.position.set(-1.75, 1.05, -1.30); scene.add(rimL);
    var rimR = new THREE.DirectionalLight(0xff7fb8, 0.24); rimR.position.set(1.80, 0.90, -1.20); scene.add(rimR);

    initMotion();
    applyOutfit(cfg.outfit);
    setFrame(cfg.frame);
    camState.y.x = camState.target.y; camState.d.x = camState.target.dist;
    initPointer(renderer.domElement);

    $('#stSpring').textContent = String(R.joints.length);
    $('#stTri').textContent = (R.tri / 1000).toFixed(0);

    function resize() {
      var w = window.innerWidth, h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = (h / w > 1.75) ? 27 : 32;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
    resize();

    /* ---- ảnh đại diện màn hình khởi động: render 1 khung từ chính model -- */
    setProgress(0.94);
    try {
      var W0 = window.innerWidth, H0 = window.innerHeight, A0 = camera.aspect, F0 = camera.fov;
      renderer.setSize(420, 420, false);
      camera.aspect = 1; camera.fov = 22; camera.updateProjectionMatrix();
      camera.position.set(0.30, 1.545, 1.02);
      camera.lookAt(0, 1.525, 0);
      renderer.render(scene, camera);
      el.bootAvaImg.src = renderer.domElement.toDataURL('image/png');
      el.bootAvaImg.classList.add('on');
      renderer.setSize(W0, H0, false);
      camera.aspect = A0; camera.fov = F0; camera.updateProjectionMatrix();
    } catch (e) {}

    var last = performance.now(), rafId = 0;
    function loop(now) {
      rafId = requestAnimationFrame(loop);
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      /* camera: lò xo tới hạn + trôi nhẹ như cầm máy trên tay */
      var cy = springStep(camState.y, camState.target.y, 3.4, dt);
      var cd = springStep(camState.d, camState.target.dist, 3.4, dt);
      var t = now / 1000;
      camera.position.set(fbm(t * 0.11) * 0.030, cy + fbm(t * 0.09 + 7) * 0.007, cd);
      camera.lookAt(0, cy - cd * 0.012, 0);

      pumpViseme();
      motion(dt);
      drawDust(t);
      drawSparks(t);

      var px = (LAT.lookX * -8).toFixed(2), py = (LAT.lookY * -5).toFixed(2);
      el.bgc.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0)';
      el.spark.style.transform = el.bgc.style.transform;

      renderer.render(scene, camera);

      /* fps + bảng thống kê */
      ENG.fpsAcc += dt; ENG.fpsN++;
      if (ENG.fpsAcc >= 0.5) {
        ENG.fps = ENG.fpsN / ENG.fpsAcc; ENG.fpsAcc = 0; ENG.fpsN = 0;
        if (cfg.stats) {
          $('#stFps').textContent = ENG.fps.toFixed(0);
          $('#stSim').textContent = ENG.simMs.toFixed(2);
          $('#stStep').textContent = ENG.steps + '/' + ENG.maxSteps;
          $('#stSpring').textContent = (ENG.lod < 0 ? 0 : R.joints.length) + '';
        }
      }
    }
    rafId = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(rafId); }
      else { last = performance.now(); ENG.acc = 0; rafId = requestAnimationFrame(loop); }
    });

    setProgress(1);
    setTimeout(function () { el.bootTap.classList.remove('hidden'); }, 320);

    var started = false;
    function begin() {
      if (started) return; started = true;
      el.boot.classList.add('gone');
      setTimeout(function () { el.boot.style.display = 'none'; }, 850);
      setTimeout(function () {
        var hi = 'Hế lô cậu! Tớ là Ani. Đêm Paris đẹp thế này, tính đi đâu chưa?';
        bubble('ani', hi); history.push({ role: 'assistant', content: hi }); speak(hi);
      }, 760);
      el.boot.removeEventListener('click', begin);
      el.boot.removeEventListener('touchend', begin);
    }
    el.boot.addEventListener('click', begin);
    el.boot.addEventListener('touchend', begin);

    window.ANI = {
      R: R, U: U, SIG: SIG, LAT: LAT, ENG: ENG, GAZE: GAZE,
      scene: scene, camera: camera, renderer: renderer, cam: camState,
      setFrame: setFrame, setMood: setMood, speak: speak, send: send, begin: begin
    };
  }).catch(function (err) {
    fail('Không dựng được model: ' + (err && err.message ? err.message : err));
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
})();
