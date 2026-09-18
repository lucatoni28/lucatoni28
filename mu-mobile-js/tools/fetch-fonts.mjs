// tools/fetch-fonts.mjs
//
// Tải font Google về nhúng thẳng vào CSS, để bản chơi không còn bất kỳ đường
// nào ra mạng. Chạy MỘT LẦN lúc build; lúc chơi không ai gọi tới file này.
//
// Vì sao nhúng base64 thay vì để woff2 rời trong img/: ba họ font × các cân
// nặng × các bộ ký tự là hơn ba chục file rời, mà JSAnywhere chỉ nhập được
// từng file một. Nhúng vào CSS thì số file phải mang sang iOS vẫn là ba
// (index.html, mu.js, assets.zip).
//
// Chỉ giữ ba bộ ký tự: latin, latin-ext, vietnamese. Bỏ cyrillic/greek vì
// giao diện chỉ có tiếng Việt và tiếng Anh.

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GIU = new Set(['latin', 'latin-ext', 'vietnamese']);

// UA của Chrome: Google Fonts trả woff2 theo UA, UA lạ là nhận ttf nặng gấp ba.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HO = [
  'Cinzel:wght@400;600;700;900',
  'Be+Vietnam+Pro:wght@300;400;500;600',
  'JetBrains+Mono:wght@400;600',
];

async function tai(url, kieu) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return kieu === 'text' ? r.text() : Buffer.from(await r.arrayBuffer());
}

const khoi = [];
let tongGoc = 0;
let boQua = 0;

for (const ho of HO) {
  const css = await tai(
    `https://fonts.googleapis.com/css2?family=${ho}&display=swap`,
    'text'
  );
  // CSS của Google là chuỗi "/* tên-bộ */ @font-face{…}" lặp lại; cắt theo
  // đúng cặp đó để biết mỗi khối thuộc bộ ký tự nào.
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m;
  while ((m = re.exec(css))) {
    const [, bo, than] = m;
    if (!GIU.has(bo)) { boQua++; continue; }
    const u = /src:\s*url\((https:\/\/[^)]+\.woff2)\)/.exec(than);
    if (!u) continue;
    const bin = await tai(u[1], 'bin');
    tongGoc += bin.length;
    khoi.push(
      than.replace(
        /src:\s*url\(https:\/\/[^)]+\.woff2\)/,
        `src: url(data:font/woff2;base64,${bin.toString('base64')})`
      )
    );
  }
}

const ra =
  '/* css/fonts.css — SINH TỰ ĐỘNG bởi tools/fetch-fonts.mjs, đừng sửa tay.\n' +
  '   Font nhúng thẳng dạng base64: bản chơi không gọi ra fonts.googleapis.com\n' +
  '   hay fonts.gstatic.com nữa, mở bằng file:// vẫn đủ chữ. */\n\n' +
  khoi.join('\n\n') +
  '\n';

writeFileSync(join(ROOT, 'css/fonts.css'), ra);
console.log(
  `fonts.css   ${khoi.length} khối · woff2 gốc ${(tongGoc / 1024).toFixed(1)} KB ` +
    `→ css ${(Buffer.byteLength(ra) / 1024).toFixed(1)} KB · bỏ ${boQua} bộ ký tự thừa`
);
