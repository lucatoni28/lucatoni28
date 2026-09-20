// Dựng lại js/engine.js và js/babylon.js từ engine-src/muonlinejs.
//
//   cd engine-src/muonlinejs && bun install
//   node tools/dung-engine.mjs
//
// Dựng với minify: false nên ra file đọc được, không nén.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GOC = join(dirname(fileURLToPath(import.meta.url)), '..');
const NGUON = join(GOC, 'engine-src', 'muonlinejs');
const DIST = join(NGUON, 'dist', 'assets');

/* Babylon nhúng sẵn địa chỉ CDN cho vài thứ nó tự tải. Chúng nằm trong gói
   @babylonjs ở node_modules nên không sửa được ở nguồn muonlinejs — phải thay
   sau khi dựng. Mỗi dòng dưới đây là một chỗ, không giấu chỗ nào. */
const VA = [
  ['Tools._DefaultCdnUrl = "https://cdn.babylonjs.com";', 'Tools._DefaultCdnUrl = "assets/js";'],
  ['Tools._DefaultAssetsUrl = "https://assets.babylonjs.com/core";', 'Tools._DefaultAssetsUrl = "assets/js";'],
  ['"https://cdn.babylonjs.com/Assets/audio.png"', '"assets/js/audio.png"'],
  ['jsDecoderModule: "https://cdn.babylonjs.com/babylon.ktx2Decoder.js",', 'jsDecoderModule: "assets/js/babylon.ktx2Decoder.js",'],
  ['Animation.SnippetUrl = `https://snippet.babylonjs.com`;', 'Animation.SnippetUrl = `assets/js`;'],
  ['Constants.SnippetUrl = "https://snippet.babylonjs.com";', 'Constants.SnippetUrl = "assets/js";'],
  ['ShaderMaterial.SnippetUrl = `https://snippet.babylonjs.com`;', 'ShaderMaterial.SnippetUrl = `assets/js`;'],
  ['ExrLoaderGlobalConfiguration.FFLATEUrl = "https://unpkg.com/fflate@0.8.2";', 'ExrLoaderGlobalConfiguration.FFLATEUrl = "assets/js/fflate";'],

  // Địa chỉ nằm trong câu báo lỗi của React, mobx và Babylon.
  ['see: https://doc.babylonjs.com/features/featuresDeepDive/importers/loadingFileTypes', 'xem tài liệu Babylon về loadingFileTypes'],
  ['var b = "https://reactjs.org/docs/error-decoder.html?invariant=" + a', 'var b = "Lỗi React #" + a'],
  ['". Find the full error at: https://github.com/mobxjs/mobx/blob/main/packages/mobx/src/errors.ts"', '". Tra mã lỗi trong packages/mobx/src/errors.ts"'],
  ['https://github.com/mobxjs/mobx/', 'mobxjs/mobx '],

  // Móc cho tiện ích theo dõi trạng thái của React và MobX.
  ['if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {', 'if (false) {   // móc React DevTools — đã vô hiệu'],
  ['  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {\n    return;\n  }', '  return;   // móc React DevTools — đã vô hiệu'],
  ['if (typeof __MOBX_DEVTOOLS_GLOBAL_HOOK__ === "object") {', 'if (false) {   // móc MobX DevTools — đã vô hiệu'],
];

console.log('Đang dựng…');
execSync('npx vite build', { cwd: NGUON, stdio: 'inherit' });

const ra = readdirSync(DIST);
const nguonEngine = ra.find(f => f.startsWith('index-') && f.endsWith('.js'));
const nguonBjs = ra.find(f => f.startsWith('bjs-') && f.endsWith('.js'));
if (!nguonEngine || !nguonBjs) throw new Error('Không thấy file dựng trong ' + DIST);

for (const [tu, den] of [
  [nguonEngine, 'engine.js'],
  [nguonBjs, 'babylon.js'],
]) {
  let s = readFileSync(join(DIST, tu), 'utf8');

  // Vite đặt tên chunk kèm mã băm; đổi về tên cố định.
  s = s.replace(/from "\.\/bjs-[A-Za-z0-9_-]*\.js"/g, 'from "./babylon.js"');

  let dem = 0;
  for (const [a, b] of VA) {
    if (s.includes(a)) {
      s = s.split(a).join(b);
      dem++;
    }
  }

  const duong = join(GOC, 'js', den);
  writeFileSync(duong, s);
  console.log(`js/${den}  ${(s.length / 1048576).toFixed(2)} MB  · vá ${dem} chỗ`);
}

// Kiểm lại: không được còn địa chỉ mạng nào trong mã chạy.
for (const f of ['engine.js', 'babylon.js']) {
  const s = readFileSync(join(GOC, 'js', f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, '$1');
  const con = [...s.matchAll(/https?:\/\/([A-Za-z0-9._-]+)/g)]
    .map(m => m[1])
    .filter(h => !h.endsWith('w3.org'));
  if (con.length) throw new Error(`js/${f} còn địa chỉ mạng: ${[...new Set(con)].join(', ')}`);
  if (s.includes('new WebSocket')) throw new Error(`js/${f} còn new WebSocket`);
}
console.log('Kiểm xong: không còn địa chỉ mạng nào trong mã chạy.');
