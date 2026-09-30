import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './style.less';
import './logic';
import { Store } from './store';
import { Engine } from './libs/babylon/exports';
import { createEngine } from './libs/babylon/utils';
import { TestScene } from './scenes/testScene';
import { loadMapIntoScene } from './libs/mu/loadMapIntoScene';
import { createWorld } from './ecs/createWorld';
import { ENUM_WORLD } from './common';
import { EventBus } from './libs/eventBus';
import { SoundsManager } from './libs/soundsManager';
import { createGfx } from './gfx';
import {
  playerAttackRate,
  playerDefense,
  playerMaxDamage,
  playerMinDamage,
  gearDefense,
  gearSet,
} from './offline/combatFormulas';
import { describeItem, itemRank, SOCKET_KINDS } from './offline/itemStats';
import {
  equipSlotsFor,
  MAX_SOCKETS,
  MAX_UPGRADE,
  MOUNT_COST,
  openSocketCost,
  upgradeChance,
  upgradeCost,
} from './offline/itemActions';

if (APP_STAGE === 'dev' || QA_ENABLED) {
  import('@babylonjs/core/Legacy/legacy');
}

const canvas = document.querySelector('canvas')!;

let useAntialiaing = false;

let engine: Engine;
try {
  const result = createEngine(canvas, useAntialiaing);
  engine = result.engine;
  engine.hideLoadingUI();
} catch (e) {
  console.error(e);
  throw e;
}

//some tricks for scrolling
window.addEventListener('keydown', ev => {
  if (['ArrowDown', 'ArrowUp', ' '].includes(ev.key)) {
    ev.preventDefault();
  }
});
const ignoredIds = ['scene-explorer-host', 'inspector-host'];
window.addEventListener(
  'wheel',
  ev => {
    let p = ev.target as HTMLElement;
    while (p) {
      if (
        p.classList &&
        (p.classList.contains('scrollable') || ignoredIds.includes(p.id))
      )
        return;

      p = p.parentElement as any;
    }

    ev.preventDefault();
  },
  { passive: false }
);

let _hiddenAttr = '';
const onVisibilityChanged = () => {
  const hidden = !!document[_hiddenAttr as 'hidden'];

  EventBus.emit('pageVisibilityChanged', !hidden);
};

if (document.hidden !== undefined) {
  _hiddenAttr = 'hidden';
  document.addEventListener('visibilitychange', onVisibilityChanged, false);
}
//@ts-ignore
else if (document.mozHidden !== undefined) {
  _hiddenAttr = 'mozHidden';
  document.addEventListener('mozvisibilitychange', onVisibilityChanged, false);
}
//@ts-ignore
else if (document.msHidden !== undefined) {
  _hiddenAttr = 'msHidden';
  document.addEventListener('msvisibilitychange', onVisibilityChanged, false);
}
//@ts-ignore
else if (document.webkitHidden !== undefined) {
  _hiddenAttr = 'webkitHidden';
  document.addEventListener(
    'webkitvisibilitychange',
    onVisibilityChanged,
    false
  );
}

const scene = new TestScene(engine);

SoundsManager.initializeSounds(scene);

const { world, updateSystems } = createWorld(scene);
Store.world = world;

(window as any).__scene = scene;
(window as any).__world = world;

/* Bốn hiệu ứng đồ hoạ bật/tắt được — xem src/gfx. Lớp giao diện điện thoại
   điều khiển qua biến này. */
const gfx = createGfx(world);
(window as any).__gfx = gfx;

let lastTime = performance.now();
engine.runRenderLoop(() => {
  const now = performance.now();

  const deltaTime = (now - lastTime) / 1000; // Convert to seconds
  world.gameTime.TotalGameTime.TotalSeconds += deltaTime;

  updateSystems(deltaTime);
  gfx.update(deltaTime);

  scene.render();

  lastTime = now;
});

const onResize = () => engine.resize();

window.addEventListener('resize', onResize);

onResize();

EventBus.on('requestWarp', ({ map, pos }) => {
  loadMapIntoScene(world, map, pos);
});

/* Đổi bản đồ là địa hình và vật thể dựng lại từ đầu, nên phải mắc lại bóng đổ
   và ánh lửa vào lứa mới. */
EventBus.on('warpCompleted', () => {
  gfx.apply();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/* Lớp giao diện ngoài (mu-mobile) đọc Store và phát sự kiện qua hai biến này.
   Trước đây chúng được nối vào cuối file đã minify bằng cách dò tên biến —
   minifier đổi tên mỗi lần dựng nên cách đó rất dễ gãy. Khai báo thẳng ở nguồn
   thì tên không bao giờ trượt. */
(window as any).__store = Store;
(window as any).__eventBus = EventBus;

/* Bốn số dẫn xuất của chế độ chơi đơn (sát thương, phòng thủ, tỉ lệ đánh trúng).
   Phơi ra đây để bảng NHÂN VẬT hiển thị đúng con số engine đang dùng khi tính
   sát thương, thay vì lớp giao diện tự chép lại công thức rồi lệch nhau. */
(window as any).__combat = {
  minDamage: playerMinDamage,
  maxDamage: playerMaxDamage,
  defense: playerDefense,
  attackRate: playerAttackRate,
  gearDefense,
  gearSet,
};

/* Thông tin một món đồ và bảng giá cường hoá / khảm ngọc. Giao diện đọc qua
   đây để bảng chú giải hiện đúng con số engine dùng khi đánh nhau. */
(window as any).__itemStats = {
  describe: describeItem,
  rank: itemRank,
  SOCKET_KINDS,
  equipSlotsFor,
  upgradeCost,
  upgradeChance,
  openSocketCost,
  MAX_UPGRADE,
  MAX_SOCKETS,
  MOUNT_COST,
};

if (Store.isOffline) {
  Store.playOffline();
}
