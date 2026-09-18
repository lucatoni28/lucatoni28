// Dựng bản chạy được trên iOS.
//
// VÌ SAO CẦN: Safari chặn <script type="module"> VÀ fetch() trên file://. Bản
// cũ nạp engine dạng module rồi fetch về vá lúc chạy — mở trên iOS là trắng màn.
//
// CÁCH LÀM: vá sẵn lúc build, xuất ra script CỔ ĐIỂN. Babylon vốn kết thúc bằng
// export{…}, engine vốn mở đầu bằng import{…}from"./bjs…" — hai dòng đó được
// đổi thành gán/đọc qua một biến toàn cục, thế là cả hai chạy bằng <script src>
// bình thường, nạp được từ img/ hoặc từ CDN.
//
// Toàn bộ JS xuất ra img/ theo đúng quy ước đường dẫn phẳng của dự án.
//
//   node tools/build-ios.mjs

import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = join(ROOT, 'img');
const kb = n => (n / 1024).toFixed(1);

// Ba phần được dựng trong bộ nhớ rồi nối thành MỘT file img/mu.js.
const PARTS = {};

/** Tên các ký hiệu js/babylon.js xuất ra — bước 1 điền, bước 2 đối chiếu. */
let BJS_EXPORTS = new Set();

/** Ném lỗi nếu mã không phải script cổ điển hợp lệ (vd còn top-level await). */
function assertClassicScript(src, label) {
  try {
    new vm.Script(src, { filename: label });
  } catch (e) {
    throw new Error(`${label} không phải script cổ điển hợp lệ: ${e.message}`);
  }
}

// ---------------------------------------------------------------- 1. Babylon
{
  const src = readFileSync(join(ROOT, 'js', 'babylon.js'), 'utf8');
  const m = src.match(/export\{([^}]*)\};?\s*$/);
  if (!m) throw new Error('babylon.js: không tìm thấy dòng export{…} ở cuối');

  const pairs = m[1].split(',').map(p => {
    const [local, exported] = p.split(/\s+as\s+/).map(s => s.trim());
    return `${exported}:${local}`;
  });

  // Giữ lại danh sách TÊN XUẤT để phần engine đối chiếu ở bước 2.
  BJS_EXPORTS = new Set(
    m[1].split(',').map(p => (p.split(/\s+as\s+/)[1] ?? p).trim())
  );

  let out = src.slice(0, m.index) + `window.__BJS={${pairs.join(',')}};\n`;

  // import.meta.url chỉ hợp lệ trong module. Trong Babylon nó luôn là đối số
  // thứ ba của helper preload Vite, mà đối số deps đứng trước là void 0 nên
  // giá trị này không được dùng tới — thay bằng document.baseURI là an toàn.
  const metas = (out.match(/import\.meta\.url/g) || []).length;
  out = out.replace(/import\.meta\.url/g, 'document.baseURI');
  if (/import\.meta/.test(out)) throw new Error('babylon.js: còn import.meta dạng khác');

  // Bọc IIFE: babylon.js và engine.js được minify RIÊNG nên cùng đặt tên biến
  // cấp cao ngắn (lr, oe, …). Là module thì mỗi file một phạm vi; thành script
  // cổ điển thì đổ chung vào phạm vi toàn cục và đụng nhau ngay.
  out = `(function(){\n${out}\n})();\n`;

  assertClassicScript(out, 'babylon');
  PARTS.babylon = out;
  console.log(`babylon.js  ${pairs.length} ký hiệu → window.__BJS · ${metas} import.meta.url → document.baseURI   ${kb(Buffer.byteLength(out))} KB`);
}

// ----------------------------------------------------------------- 2. Engine
{
  let src = readFileSync(join(ROOT, 'js', 'engine.js'), 'utf8');

  // import{D as gM,…}from"./bjs-…"  →  const{D:gM,…}=window.__BJS;
  const im = src.match(/^import\{([^}]*)\}from"[^"]*";?/);
  if (!im) throw new Error('engine.js: không tìm thấy dòng import{…} ở đầu');
  const binds = im[1].split(',').map(p => {
    const [exported, local] = p.split(/\s+as\s+/).map(s => s.trim());
    return `${exported}:${local}`;
  });

  /* CHẶN MỘT LỖI ĐÃ TỪNG XẢY RA: engine và Babylon được dựng RIÊNG, mỗi bản
     một bộ tên minify. Thêm một thứ vào src/libs/babylon/exports.ts là khối
     bjs-*.js đổi, nhưng nếu quên chép đè js/babylon.js thì engine đi tìm một
     tên không có trong window.__BJS. Lúc chạy chỉ thấy "Pb is not a
     constructor" giữa màn hình trắng, không manh mối nào.
     Đối chiếu ngay ở đây thì hỏng là dừng, kèm tên còn thiếu. */
  const thieu = im[1]
    .split(',')
    .map(p => p.split(/\s+as\s+/)[0].trim())
    .filter(n => !BJS_EXPORTS.has(n));
  if (thieu.length) {
    throw new Error(
      `engine.js cần ${thieu.length} ký hiệu mà js/babylon.js không có: ` +
        `${thieu.join(', ')}\n` +
        'Hai file này phải cùng một lần dựng. Chép lại cả hai:\n' +
        '  cp dist/assets/bjs-*.js   js/babylon.js\n' +
        '  cp dist/assets/index-*.js js/engine.js'
    );
  }
  src = `const{${binds.join(',')}}=window.__BJS;` + src.slice(im[0].length);

  // Không còn vá gì vào mã đã minify nữa. Đường dẫn asset, tiền tố decoder,
  // icon vật phẩm và bốn biến toàn cục (__store, __eventBus, __world, __scene)
  // đều đã nằm sẵn trong NGUỒN engine — xem src/common/resolveUrlToDataFolder.ts,
  // src/libs/babylon/exports.ts và src/main.tsx bên muonlinejs.
  //
  // Trước đây bốn chỗ đó được tìm-thay bằng chuỗi trên bản minify. Cách ấy gãy
  // ngay lần dựng lại engine đầu tiên: minifier đổi tên hàm i1 và đổi tên biến
  // Store từ v sang w. Kiểm tra dưới đây bắt buộc engine phải là bản đã vá
  // nguồn, thà dừng còn hơn xuất ra file chạy lên là trắng màn.
  for (const dau of ['MU_ASSETS', '__store', '__eventBus']) {
    if (!src.includes(dau)) {
      throw new Error(
        `engine.js thiếu "${dau}" — đây là bản dựng CŨ. Dựng lại engine từ ` +
          'nguồn muonlinejs rồi chép dist/assets/index-*.js đè lên js/engine.js.'
      );
    }
  }

  src = `(function(){\n${src}\n})();\n`;

  assertClassicScript(src, 'engine');
  PARTS.engine = src;
  console.log(`engine.js   ${binds.length} ràng buộc · đã vá sẵn ở nguồn ✓   ${kb(Buffer.byteLength(src))} KB`);
}

// ------------------------------------------------------------------- 3. main
{
  const ORDER = [
    // debug.js phải ĐẦU TIÊN: nó tự cài bộ bắt lỗi ngay khi nạp, cài muộn một
    // nhịp là mất đúng dòng cần nhất khi khởi động hỏng.
    'js/debug.js',
    // Hàng rào mạng ngay sau lớp gỡ lỗi và TRƯỚC mọi thứ khác: nó bọc fetch,
    // XHR và .src, nên phải bọc trước khi có ai kịp gọi.
    'js/netguard.js',
    'js/asset-manifest.js',
    'js/zip-store.js',
    'js/zip-remote.js',
    'js/zip-net.js',
    'js/asset-paths.js',
    'js/asset-loader.js',
    'js/game-data.js',
    'js/item-data.js',
    'js/ui/dom.js',
    'js/store-bridge.js',
    'js/boot.js',
    'js/ui/screens.js',
    'js/ui/hud.js',
    'js/ui/panels.js',
    'js/app.js',
  ];
  const RE_IMPORT = /^\s*import\s+(?:[\s\S]*?)\s+from\s+['"]\.[^'"]+['"]\s*;?\s*$/gm;
  const RE_EXPORT = /^(\s*)export\s+(?=(?:const|let|var|function|async|class)\b)/gm;

  const seen = new Map();
  const parts = [];
  for (const rel of ORDER) {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    const re = /^(?:export\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
    let d;
    while ((d = re.exec(raw))) {
      if (seen.has(d[1])) throw new Error(`trùng tên "${d[1]}": ${seen.get(d[1])} và ${rel}`);
      seen.set(d[1], rel);
    }
    parts.push(`/* ${rel} */\n${raw.replace(RE_IMPORT, '').replace(RE_EXPORT, '$1').trim()}`);
  }

  // Bọc trong IIFE: script cổ điển dùng chung phạm vi toàn cục, không bọc thì
  // 75 tên này rải hết ra window và dễ đụng biến của engine.
  const out =
    `(function(){\n"use strict";\n\n${parts.join('\n\n')}\n\n` +
    `window.MU_START=function(){return startApp();};\n})();\n`;

  assertClassicScript(out, 'main');
  PARTS.main = out;
  console.log(`main.js     ${ORDER.length} module · ${seen.size} tên   ${kb(Buffer.byteLength(out))} KB`);
}

// ----------------------------------------------------- 4. gộp thành script.js
//
// Thứ tự bắt buộc: main trước (định nghĩa MU_ASSETS mà engine cần ngay lúc
// khởi động), rồi babylon (đặt __BJS), rồi engine (dùng cả hai), cuối cùng mới
// gọi MU_START() để dựng giao diện trên Store đã có.
{
  let than =
    PARTS.main + '\n' + PARTS.babylon + '\n' + PARTS.engine + '\n' +
    'MU_START();\n';

  /* ───────────── XOÁ HẲN MỌI ĐỊA CHỈ MẠNG KHỎI FILE ─────────────
     Trước đây các địa chỉ này chỉ bị CHẶN LÚC CHẠY bằng js/netguard.js. Chặn
     lúc chạy là chưa đủ: chuỗi vẫn nằm trong file, mở ra vẫn thấy, và chỉ cần
     một đường nào đó lách qua hàng rào là nó ra tới nơi. Nên cắt luôn ở khâu
     dựng — sau bước này trong file không còn một địa chỉ mạng nào để mà gọi.

     Chúng nằm trong thư viện ngoài (Babylon, React, mobx), không phải mã dự
     án: hằng số CDN của bộ giải nén KTX2/Draco, máy chủ "snippet", một ảnh
     audio.png, và mấy đường dẫn tài liệu in kèm thông báo lỗi.

     Thay bằng đường dẫn nội bộ chết (about:blank#…) chứ không xoá trắng: xoá
     trắng thì chuỗi rỗng có thể thành đường dẫn tương đối và đi lấy nhầm file
     ngay cạnh trang. about:blank thì không bao giờ đi đâu cả. */
  const DIA_CHI = [
    'https://cdn.babylonjs.com',
    'https://assets.babylonjs.com',
    'https://snippet.babylonjs.com',
    'https://unpkg.com',
    'https://doc.babylonjs.com',
    'https://reactjs.org',
    'https://github.com',
    'https://www.babylonjs.com',
    'http://cdn.babylonjs.com',
  ];
  const CHET = 'about:blank#khong-ra-mang';

  const daCat = [];
  for (const dc of DIA_CHI) {
    const n = than.split(dc).length - 1;
    if (n > 0) {
      daCat.push(`${n}× ${dc}`);
      than = than.split(dc).join(CHET);
    }
  }

  /* Kiểm lại lần cuối. Hai thứ được giữ, vì cả hai đều KHÔNG đi ra khỏi máy:

     – http://www.w3.org/… là KHÔNG GIAN TÊN của XML/SVG, một cái tên định
       danh chứ không ai tải nó; bỏ đi là SVG hỏng.
     – localhost / 127.0.0.1 nằm trong câu hướng dẫn người dùng tự chạy máy
       chủ tĩnh trên máy mình ("python3 -m http.server 8000"). Đó là chữ in
       ra màn hình, và kể cả có gọi thì cũng là gọi chính máy đang chạy. */
  const NOI_BO = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])([:/]|$)/;
  const conLai = [
    ...new Set(
      (than.match(/https?:\/\/[A-Za-z0-9._~:/?#@!$&*+,;=%-]{4,90}/g) || []).filter(
        u => !u.startsWith('http://www.w3.org/') && !NOI_BO.test(u)
      )
    ),
  ];
  if (conLai.length) {
    throw new Error(
      `img/mu.js còn ${conLai.length} địa chỉ mạng chưa cắt:\n  ` +
        conLai.slice(0, 20).join('\n  ') +
        '\nThêm chúng vào mảng DIA_CHI trong tools/build-ios.mjs.'
    );
  }

  console.log(
    `            cắt địa chỉ mạng: ${daCat.length ? daCat.join(' · ') : 'không còn cái nào'}`
  );

  const bundle =
    `/* MU Mobile · Aetherfall — toàn bộ mã chạy, trong một file.\n` +
    ` * Sinh bởi tools/build-ios.mjs. Script cổ điển, không dùng module,\n` +
    ` * nên mở được cả trên iOS qua file://.\n` +
    ` *\n` +
    ` * Thứ tự ba phần là BẮT BUỘC:\n` +
    ` *   1. lớp giao diện + phân giải đường dẫn asset  (đặt MU_ASSETS)\n` +
    ` *   2. Babylon.js 7                                (đặt window.__BJS)\n` +
    ` *   3. engine 3D của game                          (dùng cả hai)\n` +
    ` * rồi mới gọi MU_START() ở dòng cuối.\n` +
    ` *\n` +
    ` * KHÔNG RA MẠNG. Hai lớp, không phải một:\n` +
    ` *   – lúc dựng: mọi địa chỉ http(s) đã bị cắt khỏi chính file này,\n` +
    ` *     kiểm lại bằng: grep -o "https\\?://[^\\"']*" img/mu.js\n` +
    ` *   – lúc chạy: js/netguard.js chặn fetch, XMLHttpRequest và .src,\n` +
    ` *     danh sách cho phép để RỖNG.\n` +
    ` * Asset đọc từ thư mục nội bộ, xem hai thẻ meta trong index.html.\n` +
    ` */\n\n` +
    than;

  assertClassicScript(bundle, 'img/mu.js');

  /* Ghi kèm BOM UTF-8 (EF BB BF).
     Khi thẻ <script src> không được server khai charset, trình duyệt lấy theo
     charset của TRANG. Trang thiếu <meta charset="UTF-8"> là toàn bộ chữ Việt
     trong giao diện thành ký tự rác (Â·, â€”, toÃ n bá»™...). BOM ép UTF-8 bất kể
     server hay trang khai gì, nên file tự bảo vệ được mình.
     Thêm SAU khi kiểm cú pháp vì vm.Script của Node không nuốt BOM. */
  writeFileSync(join(IMG, 'mu.js'), '\uFEFF' + bundle, 'utf8');
  console.log(`img/mu.js   gộp 3 phần   ${kb(Buffer.byteLength(bundle))} KB`);

  /* Bản trước để mã ở script.js ngoài gốc. Xoá đi để khỏi còn hai bản song
     song — một bản cũ nằm lại là đúng thứ "mã ẩn" cần tránh. */
  if (existsSync(join(ROOT, 'script.js'))) {
    unlinkSync(join(ROOT, 'script.js'));
    console.log('            đã xoá bản cũ script.js');
  }
}

// ------------------------------------------------------ 5. style.css
{
  // fonts.css trước aetherfall.css: @font-face phải khai báo xong thì các
  // quy tắc font-family phía sau mới bắt được. File do tools/fetch-fonts.mjs
  // sinh ra, font nhúng base64 nên không còn thẻ <link> ra fonts.googleapis.com.
  const fonts = readFileSync(join(ROOT, 'css', 'fonts.css'), 'utf8');
  let css = readFileSync(join(ROOT, 'css', 'aetherfall.css'), 'utf8');
  // Nguồn viết '../img/…' vì css/ nằm trong thư mục con; bản xuất nằm cạnh
  // index.html nên phải thành 'img/…'.
  css = css.replace(/url\((['"]?)\.\.\/img\//g, (m, q) => `url(${q}img/`);

  /* @charset phải là thứ ĐẦU TIÊN trong file, không được có gì đứng trước.
     Mở bằng file:// thì không có header HTTP khai charset, thiếu dòng này là
     mọi chữ Việt trong nội dung sinh bởi CSS (content: '…') thành ký tự rác. */
  const sheet = `@charset "UTF-8";\n` + fonts + '\n' + css;
  writeFileSync(join(ROOT, 'style.css'), sheet);
  console.log(`style.css   phông + giao diện   ${kb(Buffer.byteLength(sheet))} KB`);
}

// -------------------------------------------------------------- 6. index.html
{

  const html = `<!DOCTYPE html>
<html lang="vi" translate="no" spellcheck="false">
<head>
<meta charset="UTF-8">
<title>MU Mobile · Aetherfall</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, minimal-ui, shrink-to-fit=no, viewport-fit=cover, user-scalable=no">
<meta name="format-detection" content="telephone=no">
<meta name="msapplication-tap-highlight" content="no">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#05050a">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Aetherfall">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

<!-- ═══ HAI DÒNG NÀY ĐIỀU KHIỂN NƠI LẤY ASSET. Sửa thẳng ở đây. ═══

     mu-source : nguồn đọc
                 folder  đọc thẳng cây thư mục (mặc định, dùng cho bộ đầy đủ)
                 zip     đọc trong img/assets.zip
                 flat    đọc img/ tên phẳng (cho iOS không cho thư mục con)
     mu-folder : gốc cây thư mục khi mu-source="folder".
                 Tương đối so với index.html, PHẢI có dấu / ở cuối.
                 Ví dụ: "assets/" · "data/mu/" · "../kho-asset/"

     Đổi xong chỉ cần tải lại trang, không phải dựng lại img/mu.js.
     Không có trạng thái nào nhớ ngầm trong trình duyệt: hai dòng này và
     ?assets= / ?folder= trên URL là TẤT CẢ những gì quyết định. -->
<meta name="mu-source" content="folder">
<meta name="mu-folder" content="public/">

<!-- ═══ ĐỌC KHO TỪ MỘT FILE ZIP TRÊN MẠNG (tuỳ chọn) ═══

     Bỏ trống hoặc xoá hẳn dòng dưới  →  game chạy HOÀN TOÀN CỤC BỘ, không một
     yêu cầu nào ra khỏi máy. Đó là mặc định.

     Điền địa chỉ vào  →  kho asset đọc thẳng từ file zip ấy, KHÔNG cần thư mục
     public/ trên máy. Đọc bằng HTTP Range nên khởi động chỉ tải bảng mục lục
     (~1,3 MB cho zip 275 MB), sau đó mỗi asset tải đúng cỡ nó.

     Máy chủ chứa zip phải có đủ hai thứ, thiếu một là không chạy:
         accept-ranges: bytes
         access-control-allow-origin: *
     Mở hỏng thì game tự quay về kho cục bộ và ghi lý do vào nhật ký.

     Đây là ĐƯỜNG RA MẠNG DUY NHẤT trong cả gói, và nó nằm ngay đây để bạn
     nhìn thấy. Xoá dòng này là cắt đứt, không phải dựng lại img/mu.js.
     Thay nhanh không cần sửa file: thêm ?zipurl=… vào cuối địa chỉ trang. -->
<meta name="mu-zip-url" content="">

<link rel="icon" href="img/ui_favicon.svg">

<link rel="stylesheet" href="style.css">
</head>

<body>
<canvas class="game-canvas" width="430" height="932"></canvas>
<div id="root"></div>

<!-- Một thẻ script duy nhất, không có mã nội tuyến nào trong trang này.
     Gỡ lỗi mặc định BẬT; tắt bằng ?debug=0 trên URL, bật lại bằng ?debug=1. -->
<script src="img/mu.js"></script>
</body>
</html>
`;
  writeFileSync(join(ROOT, 'index.html'), html);
  console.log(`index.html  ${kb(Buffer.byteLength(html))} KB`);
}
