// tools/fix-items-json.mjs
//
// Sinh lại src/common/items.json của muonlinejs từ bảng gốc tools/Item.txt.
//
// VÌ SAO CẦN: bản items.json trong repo bị LỆCH 2 CỘT so với Item.txt. Đối
// chiếu từng món thì thấy ngay:
//
//   Kris   Item.txt  : ItemLvl=6  DmgMin=6  DmgMax=11 Speed=50 Dur=20 Str=40 Agi=40
//          items.json: ItemLvl=0  DmgMin=0  DmgMax=6  Speed=6  Dur=11 Str=0  Agi=0
//
// Giá trị bị đẩy sang phải hai ô, nên mọi thứ đọc ra đều sai: sát thương thấp
// hơn thật, tốc độ đánh thành số vô nghĩa, yêu cầu Sức mạnh/Nhanh nhẹn biến
// mất. Trước đây tôi tưởng "mấy cột ấy không tin được" và bỏ không hiện —
// thật ra dữ liệu đúng vẫn nằm đó, chỉ là đọc sai chỗ.
//
// Item.txt có SÁU lược đồ cột khác nhau (vũ khí, gậy, giáp, cánh, thú, thuốc,
// cuộn), mỗi nhóm một dòng tiêu đề riêng ngay phía trên. Bộ đọc dưới đây bám
// đúng dòng tiêu đề của từng nhóm nên không phải đoán.
//
// szModelFolder / szModelName KHÔNG có trong Item.txt — chúng do bộ chuyển đổi
// cũ thêm vào. Giữ nguyên bằng cách ghép lại theo (Group, Index).
//
//   node tools/fix-items-json.mjs <đường-dẫn-muonlinejs>

import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.argv[2] || '/home/user/afrokick/muonlinejs';
const TXT = join(REPO, 'tools', 'Item.txt');
const JSON_PATH = join(REPO, 'src', 'common', 'items.json');

/** Tách một dòng thành các ô; chuỗi trong ngoặc kép giữ nguyên cả khoảng trắng. */
function tachO(line) {
  const ra = [];
  let i = 0;
  while (i < line.length) {
    const c = line[i];
    if (c === '"') {
      const j = line.indexOf('"', i + 1);
      ra.push(line.slice(i + 1, j));
      i = j + 1;
    } else if (c === ' ' || c === '\t') {
      i++;
    } else {
      let j = i;
      while (j < line.length && line[j] !== ' ' && line[j] !== '\t') j++;
      ra.push(line.slice(i, j));
      i = j;
    }
  }
  return ra;
}

function docItemTxt(path) {
  const ra = [];
  let header = null;
  let group = null;

  for (const raw of readFileSync(path, 'latin1').split('\n')) {
    const t = raw.replace(/\r/g, '').trim();
    if (!t) continue;

    // Dòng tiêu đề của nhóm kế tiếp — nhận ra bằng cột ItemName.
    if (t.startsWith('//')) {
      const h = t.replace(/^\/+/, '').trim();
      if (h.includes('ItemName')) header = tachO(h);
      continue;
    }
    if (t.toLowerCase() === 'end') {
      group = null;
      continue;
    }

    const o = tachO(t);
    // Dòng chỉ có một số = số hiệu nhóm, mở đầu một khối.
    if (o.length === 1 && /^\d+$/.test(o[0])) {
      group = +o[0];
      continue;
    }
    if (group === null || !header) continue;
    // Số ô phải khớp tiêu đề, lệch là bỏ qua chứ không đoán.
    if (o.length !== header.length) continue;

    const rec = { Group: group };
    header.forEach((k, i) => {
      const v = o[i];
      rec[k] = k === 'ItemName' ? v : /^-?\d+$/.test(v) ? +v : v;
    });
    ra.push(rec);
  }
  return ra;
}

const moi = docItemTxt(TXT);
const cu = JSON.parse(readFileSync(JSON_PATH, 'utf8'));

const model = new Map();
for (const x of cu) {
  model.set(`${x.Group}/${x.Index}`, {
    szModelFolder: x.szModelFolder,
    szModelName: x.szModelName,
  });
}

let thieuModel = 0;
let doiGiaTri = 0;
const cuMap = new Map(cu.map(x => [`${x.Group}/${x.Index}`, x]));

for (const r of moi) {
  const k = `${r.Group}/${r.Index}`;
  const m = model.get(k);
  if (m) {
    r.szModelFolder = m.szModelFolder;
    r.szModelName = m.szModelName;
  } else {
    thieuModel++;
  }
  const c = cuMap.get(k);
  if (c) {
    for (const key of Object.keys(r)) {
      if (key.startsWith('sz') || key === 'ItemName') continue;
      if (c[key] !== r[key]) {
        doiGiaTri++;
        break;
      }
    }
  }
}

if (!existsSync(JSON_PATH + '.truoc-khi-sua')) {
  copyFileSync(JSON_PATH, JSON_PATH + '.truoc-khi-sua');
}
writeFileSync(JSON_PATH, JSON.stringify(moi, null, 2));

console.log(
  `items.json  ${moi.length} món · ${doiGiaTri} món có giá trị đổi · ` +
    `${thieuModel} món không có tên model (giữ trống)`
);
