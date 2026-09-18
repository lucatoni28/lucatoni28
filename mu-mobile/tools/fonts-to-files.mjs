// tools/fonts-to-files.mjs
//
// Đổi css/fonts.css từ "nhúng base64" sang "trỏ vào file thật trong img/".
//
// VÌ SAO: base64 trong CSS là một URL dạng data: — đúng thứ cần bỏ. Bỏ hẳn mà
// không thay gì thì mất phông, chữ Việt về phông hệ thống. Nên ghi các khối
// base64 ra thành file .woff2 thật rồi trỏ @font-face vào đó. Không data:,
// không mạng, chữ vẫn nguyên.
//
// Tên file đặt phẳng theo đúng quy ước img/ của dự án:
//   img/font_<họ>_<cânnặng>_<bộkýtự>.woff2
//
//   node tools/fonts-to-files.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSS = join(ROOT, 'css', 'fonts.css');
const IMG = join(ROOT, 'img');

if (!existsSync(IMG)) mkdirSync(IMG, { recursive: true });

const src = readFileSync(CSS, 'utf8');

/* Mỗi @font-face một khối. Lấy ra họ, cân nặng và dải mã để đặt tên file cho
   khỏi trùng — cùng một họ có tới bốn cân nặng × ba bộ ký tự. */
const KHOI = /@font-face\s*\{[^}]*\}/g;
const khoi = src.match(KHOI) ?? [];

let ra = src;
let soFile = 0;
let tongByte = 0;
const dem = new Map();

for (const k of khoi) {
  /* Phải nuốt luôn phần format(...) đi sau URL.
     Lần trước regex dừng ngay sau dấu ) của url(), nên chuỗi thay vào nối
     thêm một format() nữa, ra "src: url(…) format(\"woff2\") format('woff2')".
     Hai format() liền nhau là lỗi cú pháp của thành phần src — trình duyệt
     bỏ CẢ dòng src, @font-face thành rỗng, không phông nào tải. Cả 26 khai
     báo đều dính, và đó là lý do chữ Việt trong bảng báo lỗi hiện ra rời dấu
     (phông hệ thống ghép dấu tổ hợp). */
  const b64 =
    /src:\s*url\(data:font\/woff2;base64,([A-Za-z0-9+/=]+)\)(\s*format\([^)]*\))?/.exec(k);
  if (!b64) continue;

  const ho = (/font-family:\s*'([^']+)'/.exec(k)?.[1] ?? 'font')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  const nang = /font-weight:\s*(\d+)/.exec(k)?.[1] ?? '400';

  // Cùng họ + cân nặng có thể lặp cho từng bộ ký tự; đánh số cho khỏi đè nhau.
  const khoa = `${ho}-${nang}`;
  const n = (dem.get(khoa) ?? 0) + 1;
  dem.set(khoa, n);

  const ten = `font_${khoa}_${n}.woff2`;
  const buf = Buffer.from(b64[1], 'base64');
  writeFileSync(join(IMG, ten), buf);
  soFile++;
  tongByte += buf.length;

  ra = ra.replace(b64[0], `src: url("img/${ten}") format("woff2")`);
}

ra = ra.replace(
  /^\/\* css\/fonts\.css[\s\S]*?\*\//,
  `/* css/fonts.css — SINH TỰ ĐỘNG bởi tools/fetch-fonts.mjs rồi
   tools/fonts-to-files.mjs, đừng sửa tay.
   Phông nằm ở các file img/font_*.woff2 — KHÔNG nhúng base64, KHÔNG data:,
   KHÔNG gọi ra mạng. Mở bằng file:// vẫn đủ chữ. */`
);

writeFileSync(CSS, ra);
console.log(
  `fonts.css   ${soFile} file phông ghi ra img/ · ${(tongByte / 1024).toFixed(1)} KB · ` +
    `css còn ${(Buffer.byteLength(ra) / 1024).toFixed(1)} KB`
);
