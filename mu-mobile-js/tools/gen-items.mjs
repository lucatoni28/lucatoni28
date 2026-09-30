// Sinh js/item-data.js — bảng kích thước ô của từng vật phẩm, trích từ
// items.json của engine muonlinejs.
//
// Trường X / Y trong items.json là SỐ Ô NGANG × DỌC mà món đồ chiếm trong túi
// (giáp 2×3, mũ 2×2, kiếm 1×3, cánh 5×3, bình thuốc 1×1). Đây là thứ cho phép
// dựng lưới túi đồ đúng kiểu MU thay vì mọi ô một cỡ.
//
//   node tools/gen-items.mjs <đường-dẫn-public>   (hoặc đường dẫn tới src/common)

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'js', 'item-data.js');

const base = process.argv[2];
if (!base) {
  console.error('Thiếu tham số: đường dẫn repo muonlinejs (hoặc tới items.json)');
  process.exit(1);
}
const candidates = [
  base,
  join(base, 'items.json'),
  join(base, 'src', 'common', 'items.json'),
  resolve(base, '..', 'src', 'common', 'items.json'),
];
const path = candidates.find(p => {
  try { readFileSync(p); return p.endsWith('.json'); } catch { return false; }
});
if (!path) {
  console.error('Không tìm thấy items.json; đã thử:\n  ' + candidates.join('\n  '));
  process.exit(1);
}

const items = JSON.parse(readFileSync(path, 'utf8'));

// Gom theo nhóm, mỗi món một chuỗi "num:x:y:tên".
const groups = new Map();
let count = 0;
for (const it of items) {
  const x = it.X | 0;
  const y = it.Y | 0;
  if (x <= 0 || y <= 0) continue;              // vài dòng rác có X = -1
  const name = String(it.ItemName ?? '').replace(/[|]/g, ' ').trim();
  if (!groups.has(it.Group)) groups.set(it.Group, []);
  groups.get(it.Group).push(`${it.Index}:${x}:${y}:${name}`);
  count++;
}

const body = [...groups.keys()]
  .sort((a, b) => a - b)
  .map(g => `  ${g}: ${JSON.stringify(groups.get(g).join('|'))},`)
  .join('\n');

const js = `// TỰ ĐỘNG SINH bởi tools/gen-items.mjs — đừng sửa tay.
// Nguồn: afrokick/muonlinejs src/common/items.json
// ${count} vật phẩm · ${groups.size} nhóm
//
// Mỗi nhóm là chuỗi các món "num:x:y:tên" nối bằng "|".
// x, y = số ô ngang × dọc món đồ chiếm trong túi (giáp 2×3, mũ 2×2, cánh 5×3…).

const RAW = {
${body}
};

const cache = new Map();

function tableFor(group) {
  let t = cache.get(group);
  if (t) return t;
  t = new Map();
  const raw = RAW[group];
  if (raw) {
    for (const entry of raw.split('|')) {
      const [num, x, y, ...rest] = entry.split(':');
      t.set(+num, { x: +x, y: +y, name: rest.join(':') });
    }
  }
  cache.set(group, t);
  return t;
}

/** Kích thước ô của một món; mặc định 1×1 khi không có trong bảng. */
export function itemSize(group, num) {
  const it = tableFor(group).get(num);
  return it ? { x: it.x, y: it.y } : { x: 1, y: 1 };
}

/** Tên gốc (tiếng Anh) của món; chuỗi rỗng nếu không có. */
export function itemName(group, num) {
  return tableFor(group).get(num)?.name ?? '';
}

export const ITEM_COUNT = ${count};
`;

writeFileSync(OUT, js);
console.log(`${count} vật phẩm · ${groups.size} nhóm → ${OUT}`);
