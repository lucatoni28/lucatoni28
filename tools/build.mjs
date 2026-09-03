/* Gộp src/ thành một file HTML5 duy nhất, không phụ thuộc gì bên ngoài.
   Dùng: node tools/build.mjs  →  Ani.html
   Không có bước biên dịch nào cả: chỉ nhúng nguyên văn CSS + JS.           */
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'Ani.html');

const read = (p) => readFileSync(join(SRC, p), 'utf8');
/* chuỗi "</script" trong nội dung JS sẽ đóng thẻ sớm — phải vô hiệu hoá */
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html');

/* Bắt buộc dùng hàm thay thế: replace() với chuỗi sẽ diễn giải $', $`, $&…
   mà app.js đầy ký tự "$(" và "$'" → bundle sẽ bị chèn nhầm nội dung.      */
const put = (needle, text) => {
  if (!html.includes(needle)) throw new Error('Không tìm thấy mốc: ' + needle);
  html = html.replace(needle, () => text);
};

put('<link rel="stylesheet" href="style.css">',
  '<style>\n' + read('style.css').trim() + '\n</style>');

const inline = (file, banner) =>
  '<script>\n/* ' + banner + ' */\n' + safe(read(file).trim()) + '\n</script>';

put('<script src="data/ani-data.js"></script>',
  inline('data/ani-data.js', 'ANI_DATA — hình học + xương + texture của model gốc (dữ liệu nguồn)'));
put('<script src="vendor/three.min.js"></script>',
  inline('vendor/three.min.js', 'three.js r128 — MIT, nhúng để chạy hoàn toàn offline'));
put('<script src="app.js"></script>',
  inline('app.js', 'ANI-2 engine'));

if (/<script src=/.test(html)) throw new Error('Còn tham chiếu script chưa nhúng');
if (/href="style\.css"/.test(html)) throw new Error('CSS chưa nhúng');

writeFileSync(OUT, html);
const mb = (statSync(OUT).size / 1048576).toFixed(2);
console.log('✔ Ani.html — ' + mb + ' MB');
