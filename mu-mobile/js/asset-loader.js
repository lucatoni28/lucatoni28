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

/** Mục nào đã bung vào đệm cho bản đồ nào, để thả ra khi rời map. */
const cachedPerMap = new Map();

/**
 * Bung asset của một bản đồ từ file zip vào đệm.
 *
 * KHÔNG cấp blob URL ở đây. Đã thử và hỏng: blob URL không mang phần mở rộng,
 * mà SceneLoader của Babylon chọn trình đọc theo ĐUÔI FILE, nên mọi .glb đều
 * báo "Unable to find a plugin to load ... files". Đường dẫn thật sự dùng là
 * URL giả __muzip/ (giữ nguyên đuôi), do js/zip-net.js chặn lại; việc bung
 * trước ở đây chỉ để mỗi mục khỏi phải giải nén lại lúc đang chơi.
 *
 * Bung song song có giới hạn. Bản đầu bung tuần tự và ĐO ĐƯỢC là quá chậm:
 * mỗi `await` nhường lại cho vòng lặp sự kiện, mà vòng lặp ấy đang bận vẽ cảnh,
 * nên mỗi file phải chờ trọn một khung hình — 1,5 file/giây, 173 file của Devias
 * mất hơn 70 giây. DecompressionStream vốn chạy ngoài luồng chính nên mở vài
 * luồng cùng lúc là lấp được đúng chỗ chờ đó.
 */
async function extractMapFromZip(mapIndex, queue, onProgress, concurrency = 6) {
  const zip = MU_ASSETS.zip;
  const total = queue.length;
  let next = 0;
  let done = 0;
  let bytes = 0;
  let failed = 0;
  const mine = [];

  // Báo tiến độ dè chừng: gọi mỗi file là mỗi file một lần dựng lại thanh
  // tiến độ, đúng thứ vừa làm chậm vòng bung.
  let baoLuc = 0;
  const bao = path => {
    const gio = performance.now();
    if (done === total || gio - baoLuc > 80) {
      baoLuc = gio;
      onProgress?.(done, total, path);
    }
  };

  async function tho() {
    for (;;) {
      const i = next++;
      if (i >= total) return;
      const a = queue[i];
      try {
        const blob = MU_ASSETS.cache.get(a.path) || (await zip.blob(a.path));
        if (!blob) {
          failed++;
        } else {
          MU_ASSETS.cache.set(a.path, blob);
          mine.push(a.path);
          bytes += blob.size;
        }
      } catch {
        failed++;
      }
      done++;
      bao(a.path);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, tho));

  cachedPerMap.set(mapIndex, mine);
  if (!failed) loaded.add(mapIndex);
  return { files: done, bytes, failed, skipped: false };
}

/**
 * Thả phần đã bung của một bản đồ. Không gọi thì mỗi lần dịch chuyển lại giữ
 * thêm vài trăm MB.
 */
export function releaseMap(mapIndex) {
  const list = cachedPerMap.get(mapIndex);
  if (!list) return 0;
  for (const path of list) {
    MU_ASSETS.cache.delete(path);
    // Nền radar / bản đồ to có cấp blob URL thật, thu hồi luôn kẻo rò.
    const u = MU_ASSETS.urls.get(path);
    if (u) {
      URL.revokeObjectURL(u);
      MU_ASSETS.urls.delete(path);
    }
  }
  cachedPerMap.delete(mapIndex);
  loaded.delete(mapIndex);
  return list.length;
}

/**
 * Nạp trước asset của một bản đồ.
 * Trả về { files, bytes, failed, skipped }.
 *
 * Chế độ zip thì bung từ file nén ra blob URL; hai chế độ còn lại thì tải về
 * cache trình duyệt. Tải song song có giới hạn: nhiều luồng quá thì trên 4G
 * điện thoại các request tranh băng thông và cái nào cũng chậm.
 */
export async function preloadMap(mapIndex, { concurrency = 6, onProgress } = {}) {
  if (loaded.has(mapIndex)) {
    const w = mapWeight(mapIndex);
    return { ...w, failed: 0, skipped: true };
  }

  const queue = mapFolders(mapIndex).flatMap(folderAssets);

  if (MU_ASSETS.mode === 'zip' && MU_ASSETS.zip) {
    return extractMapFromZip(mapIndex, queue, onProgress, concurrency);
  }

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
  return { files: done, bytes, failed, skipped: false };
}

/** Bản đồ nào đã nạp trước xong. */
export function preloadedMaps() {
  return [...loaded];
}
