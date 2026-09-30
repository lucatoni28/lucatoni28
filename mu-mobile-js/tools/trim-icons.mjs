// Cắt viền trong suốt của icon vật phẩm, dùng cho các ô vuông trên thanh bar.
//
// Icon MU là canvas cố định 120×126 nhưng phần vẽ chỉ chiếm 13–27% và không
// canh giữa (MU đặt hình theo footprint ô của món đồ). Vào một ô vuông thì
// object-fit:contain co cả canvas nên hình thật teo lại. Bản cắt khắc phục.
//
// HÒM ĐỒ KHÔNG DÙNG BẢN CẮT: ở đó tỉ lệ canvas gốc mới khớp số ô món đồ chiếm.
//
//   node tools/trim-icons.mjs <đường-dẫn-public>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'img');

// Chỉ những món xuất hiện trên thanh bar.
const WANTED = [
  { group: 14, num: 2, lvl: 0, label: 'Bình Máu' },
  { group: 14, num: 5, lvl: 0, label: 'Bình Mana' },
  { group: 12, num: 7, lvl: 0, label: 'Xoay Kiếm' },
  { group: 13, num: 4, lvl: 0, label: 'Dark Horse' },
];

const pub = process.argv[2];
if (!pub) {
  console.error('Thiếu tham số: đường dẫn thư mục public/ của muonlinejs');
  process.exit(1);
}

/* ---- PNG tối giản: chỉ đọc/ghi RGBA 8-bit không nén xen kẽ ---- */

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return buf => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunks(buf) {
  const out = [];
  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    out.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  return out;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}

const zlib = await import('node:zlib');

function decodeRGBA(buf) {
  const cs = chunks(buf);
  const ihdr = cs.find(c => c.type === 'IHDR').data;
  const w = ihdr.readUInt32BE(0);
  const h = ihdr.readUInt32BE(4);
  const depth = ihdr[8];
  const color = ihdr[9];
  if (depth !== 8 || color !== 6) throw new Error(`chỉ đọc được RGBA 8-bit (depth=${depth} color=${color})`);
  const idat = Buffer.concat(cs.filter(c => c.type === 'IDAT').map(c => c.data));
  const raw = zlib.inflateSync(idat);
  const px = Buffer.alloc(w * h * 4);
  const stride = w * 4;
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? cur[x - 4] : 0;
      const b = prev[x];
      const c = x >= 4 ? prev[x - 4] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, px };
}

function encodeRGBA(w, h, px) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---- cắt ---- */

let done = 0;
for (const it of WANTED) {
  const src = join(pub, 'items', `item_${it.group}_${it.num}_${it.lvl}.png`);
  if (!existsSync(src)) {
    console.error(`  thiếu ${src}`);
    continue;
  }
  const { w, h, px } = decodeRGBA(readFileSync(src));
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) {
    console.error(`  ${it.label}: canvas rỗng`);
    continue;
  }
  const nw = x1 - x0 + 1;
  const nh = y1 - y0 + 1;
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    px.copy(out, y * nw * 4, ((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + nw) * 4);
  }
  const dst = join(OUT, `icon_${it.group}_${it.num}.png`);
  writeFileSync(dst, encodeRGBA(nw, nh, out));
  console.log(`  ${it.label.padEnd(12)} ${w}×${h} → ${nw}×${nh}  (icon_${it.group}_${it.num}.png)`);
  done++;
}
console.log(`cắt xong ${done}/${WANTED.length} icon`);
