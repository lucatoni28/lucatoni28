// Sinh js/asset-manifest.js + img/asset-manifest.json từ cây public/ của muonlinejs.
// Dùng: node tools/gen-manifest.mjs <đường-dẫn-public> 
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_JS = join(HERE, '..', 'js', 'asset-manifest.js');
const OUT_JSON = join(HERE, '..', 'img', 'asset-manifest.json');
const ROOTS = ['game-assets', 'items', 'js', 'fonts'];

const publicDir = process.argv[2];
if (!publicDir) {
  console.error('Thiếu tham số: đường dẫn tới thư mục public/ của muonlinejs');
  process.exit(1);
}

/** Duyệt đệ quy, trả về [đường-dẫn-logic, kích-thước] đã sắp xếp. */
function walk(root) {
  const out = [];
  const stack = [join(publicDir, root)];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) stack.push(full);
      else out.push([relative(publicDir, full).split(/[\\/]/).join('/'), st.size]);
    }
  }
  return out.sort((a, b) => a[0].localeCompare(b[0]));
}

const all = ROOTS.flatMap(walk);

// Gom theo thư mục cha để file gọn và dễ đọc khi kiểm soát bằng mắt.
const groups = new Map();
for (const [path, size] of all) {
  const i = path.lastIndexOf('/');
  const dir = path.slice(0, i);
  const file = path.slice(i + 1);
  if (!groups.has(dir)) groups.set(dir, []);
  groups.get(dir).push(`${file}:${size}`);
}

// Kiểm tra va chạm khi làm phẳng — điều kiện sống còn của fallback img/.
const flat = new Map();
for (const [path] of all) {
  const f = path.replace(/\//g, '_');
  if (flat.has(f)) throw new Error(`Va chạm tên phẳng: ${path} vs ${flat.get(f)}`);
  flat.set(f, path);
}

const totalBytes = all.reduce((s, [, b]) => s + b, 0);
const dirs = [...groups.keys()].sort();

const body = dirs
  .map(d => `  ${JSON.stringify(d)}: ${JSON.stringify(groups.get(d).join(' '))},`)
  .join('\n');

const js = `// TỰ ĐỘNG SINH bởi tools/gen-manifest.mjs — đừng sửa tay.
// Nguồn: afrokick/muonlinejs@master public/
// ${all.length} file · ${(totalBytes / 1048576).toFixed(1)} MB · ${dirs.length} thư mục
//
// Mỗi khoá là thư mục logic, giá trị là chuỗi "tên:kíchthước" cách nhau bởi dấu cách.
// Đường dẫn logic  = "<thư mục>/<tên>"        (khớp cây public/ trên CDN)
// Đường dẫn phẳng  = "img/" + logic.replace(/\\//g, "_")

export const ASSET_COUNT = ${all.length};
export const ASSET_BYTES = ${totalBytes};

export const MANIFEST = {
${body}
};

/** Bung manifest thành mảng { path, size } đầy đủ. */
export function listAssets() {
  const out = [];
  for (const dir of Object.keys(MANIFEST)) {
    for (const entry of MANIFEST[dir].split(' ')) {
      const i = entry.lastIndexOf(':');
      out.push({ path: \`\${dir}/\${entry.slice(0, i)}\`, size: +entry.slice(i + 1) });
    }
  }
  return out;
}

/** Tra kích thước một đường dẫn logic; trả về -1 nếu không có trong bảng kê. */
export function assetSize(logicalPath) {
  const i = logicalPath.lastIndexOf('/');
  const group = MANIFEST[logicalPath.slice(0, i)];
  if (!group) return -1;
  const name = logicalPath.slice(i + 1);
  for (const entry of group.split(' ')) {
    if (entry.startsWith(name + ':')) return +entry.slice(name.length + 1);
  }
  return -1;
}
`;

mkdirSync(dirname(OUT_JS), { recursive: true });
mkdirSync(dirname(OUT_JSON), { recursive: true });
writeFileSync(OUT_JS, js);
writeFileSync(
  OUT_JSON,
  JSON.stringify(
    { source: 'afrokick/muonlinejs@master', count: all.length, bytes: totalBytes, assets: all.map(([p, s]) => ({ path: p, size: s })) },
    null,
    0
  )
);

console.log(`${all.length} asset · ${(totalBytes / 1048576).toFixed(1)} MB · ${dirs.length} thư mục`);
console.log(`→ ${OUT_JS}`);
console.log(`→ ${OUT_JSON}`);
