// Bắt tay với engine đã chạy.
//
// Trước đây file này tải engine dạng text rồi vá lúc chạy. Cách đó KHÔNG chạy
// được trên iOS: Safari chặn fetch() và <script type="module"> trên file://.
//
// Giờ engine được vá sẵn lúc build (tools/build-ios.mjs) và nạp bằng thẻ
// <script> cổ điển trong index.html. Khi hàm này chạy thì engine đã dựng xong
// và đã đặt các biến toàn cục; việc còn lại chỉ là kiểm tra và trả về.

import { MU_ASSETS } from './asset-paths.js';
import { DBG } from './debug.js';

export function bootEngine({ onProgress = () => {} } = {}) {
  const mode = MU_ASSETS.probe();
  onProgress(
    {
      folder: `Nguồn: thư mục ${MU_ASSETS.FOLDER_BASE}`,
      zip: 'Nguồn: img/assets.zip',
      flat: 'Nguồn: img/ phẳng',
    }[mode] || `Nguồn: ${mode}`
  );

  const store = window.__store;
  DBG.info('boot', `engine ${store ? 'đã dựng' : 'CHƯA dựng'} · nguồn ${mode}`);
  if (!store) {
    throw new Error(
      'Engine chưa chạy. index.html phải nạp img/babylon.js rồi img/engine.js ' +
        'TRƯỚC khi gọi MU_START().'
    );
  }

  return {
    store,
    eventBus: window.__eventBus,
    scene: window.__scene,
    world: window.__world,
  };
}
