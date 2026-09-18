// Lớp nạp asset theo bản đồ.
//
// Engine engine vốn đã nạp model theo nhu cầu: đi tới đâu, AssetsManager tải
// model tới đó. Module này KHÔNG thay thế cơ chế ấy — nó làm hai việc engine
// không làm:
//
//   1. Nạp trước (warm cache) toàn bộ asset của một bản đồ, kèm tiến độ, để lúc
//      bước vào không bị khựng từng model một.
//   2. Cho biết bản đồ nào cần những gì, nặng bao nhiêu, đã tải xong chưa.
//
// Bản đồ số m dùng thư mục World{m+1} (địa hình + texture) và Object{m+1}
// (vật thể trang trí) — đúng quy ước engine dựng đường dẫn.

import { MANIFEST } from './asset-manifest.js';
import { MU_ASSETS } from './asset-paths.js';

/** Các thư mục logic mà một bản đồ cần. */
export function mapFolders(mapIndex) {
  const n = mapIndex + 1;
  return [`game-assets/World${n}`, `game-assets/Object${n}`];
}

/** Danh sách { path, size } của một thư mục logic. */
export function folderAssets(folder) {
  const raw = MANIFEST[folder];
  if (!raw) return [];
  return raw.split(' ').map(entry => {
    const i = entry.lastIndexOf(':');
    return { path: `${folder}/${entry.slice(0, i)}`, size: +entry.slice(i + 1) };
  });
}

/** Tổng dung lượng của một bản đồ, tính trước khi tải. */
export function mapWeight(mapIndex) {
  let files = 0;
  let bytes = 0;
  for (const f of mapFolders(mapIndex)) {
    for (const a of folderAssets(f)) {
      files++;
      bytes += a.size;
    }
  }
  return { files, bytes };
}

const loaded = new Set();

/** Bản đồ nào đã nạp trước xong. */
const cachedPerMap = new Map();

/** Quên phần đã nạp trước của một bản đồ. */
export function releaseMap(mapIndex) {
  const n = cachedPerMap.get(mapIndex) || 0;
  cachedPerMap.delete(mapIndex);
  loaded.delete(mapIndex);
  return n;
}

/** Nạp trước asset của một bản đồ. Trả { files, bytes, failed, skipped }. */
export async function preloadMap(mapIndex, { concurrency = 6, onProgress } = {}) {
  if (loaded.has(mapIndex)) {
    const w = mapWeight(mapIndex);
    return { ...w, failed: 0, skipped: true };
  }

  const queue = mapFolders(mapIndex).flatMap(folderAssets);

  const total = queue.length;
  let done = 0;
  let bytes = 0;
  let failed = 0;

  async function worker() {
    for (;;) {
      const a = queue.pop();
      if (!a) return;
      try {
        const res = await fetch(MU_ASSETS.resolve(a.path), { cache: 'force-cache' });
        if (!res.ok) throw new Error(String(res.status));
        await res.arrayBuffer();
        bytes += a.size;
      } catch {
        failed++;
      }
      done++;
      onProgress?.(done, total, a.path);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  if (!failed) loaded.add(mapIndex);
  cachedPerMap.set(mapIndex, done);
  return { files: done, bytes, failed, skipped: false };
}

/** Bản đồ nào đã nạp trước xong. */
export function preloadedMaps() {
  return [...loaded];
}
