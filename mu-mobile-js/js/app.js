// Điều phối: dựng giao diện, khởi động engine, nối bridge, chuyển màn.

import { MU_ASSETS } from './asset-paths.js';
import { DBG } from './debug.js';
import { createBridge } from './store-bridge.js';
import { el } from './ui/dom.js';
import {
  createLoading,
  createFatal,
  createStartScreen,
  createHeroScreen,
  createRotatePrompt,
} from './ui/screens.js';
import { createHud } from './ui/hud.js';
import { createPanels } from './ui/panels.js';
import { HEROES, WORLD_NAMES } from './game-data.js';
import { preloadMap, mapWeight, releaseMap } from './asset-loader.js';

const SAVE_KEY = 'mu.save';

function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    /* riêng tư / hết chỗ — bỏ qua, phiên vẫn chơi được */
  }
}

function fmtClock(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** playOffline() đổi URL sang /offline làm tải lại trang bị 404. Chặn đúng lời gọi đó. */
function playOfflineSafely(bridge) {
  const original = history.replaceState;
  history.replaceState = function () {};
  try {
    bridge.playOffline();
  } finally {
    history.replaceState = original;
  }
}

export async function startApp() {
  const ui = el('div.ae');
  const loading = createLoading();
  const fatal = createFatal();
  ui.append(loading.root, fatal.root, createRotatePrompt());
  document.body.append(ui);

  let bridge = null;
  let hud = null;

  /* Nhật ký hệ thống. Dòng phát trước khi HUD dựng xong thì xếp hàng, đổ sau. */
  const hangCho = [];
  function sysLog(text, alsoHint = true) {
    if (alsoHint) loading.setHint(text);
    if (hud) hud.pushLog(text, 'sys');
    else hangCho.push(text);
  }
  function xaHangCho() {
    for (const t of hangCho) hud.pushLog(t, 'sys');
    hangCho.length = 0;
  }
  let panels = null;
  let start = null;
  let heroes = null;
  let sessionStart = 0;
  let chosenHero = HEROES[0];

  const showScreen = name => {
    start?.show(name === 'start');
    heroes?.show(name === 'heroes');
    hud?.show(name === 'game');
    if (name !== 'game') panels?.close();
  };

  /** Nạp sẵn asset của một bản đồ, có thanh tiến độ. */
  async function loadMapAssets(mapIndex) {
    const w = mapWeight(mapIndex);
    const verb = 'ĐANG TẢI BẢN ĐỒ';
    const ten = WORLD_NAMES[mapIndex] || `Bản đồ ${mapIndex}`;

    sysLog(`${ten} · ${w.files} tệp · ${(w.bytes / 1048576).toFixed(0)} MB`);
    loading.set(verb, 0.5);
    loading.show(true);

    const kq = await preloadMap(mapIndex, {
      onProgress: (done, total) => loading.set(verb, 0.5 + 0.5 * (done / total)),
    }).catch(e => ({ loi: e }));

    if (kq?.loi) sysLog(`Lỗi nạp ${ten}: ${kq.loi.message || kq.loi}`, false);
    else if (kq?.skipped) sysLog(`${ten}: đã có sẵn trong bộ nhớ`, false);
    else sysLog(`${ten}: ${kq.files} tệp` + (kq.failed ? ` · hụt ${kq.failed}` : ' · đủ'), false);

    loading.show(false);
  }

  async function enterWorld(hero) {
    chosenHero = hero;
    loading.set('ĐANG VÀO THẾ GIỚI', 0.45);
    loading.show(true);

    await loadMapAssets(0);

    playOfflineSafely(bridge);
    bridge.setCharClass(hero.cls);
    sessionStart = Date.now();

    // Áp thiết lập đồ hoạ mặc định (xem GFX_DEFAULT trong store-bridge.js).
    // Phải gọi SAU playOffline: trước đó chưa có camera nào để chỉnh.
    bridge.applyGfxDefaults();
    const g = bridge.gfxState();
    sysLog(`Đồ hoạ: ${g.camera} · ${g.scale}× · ${g.fpsCap || 'không'} giới hạn fps`, false);

    showScreen('game');
    hud.setHero(hero.name);
    hud.pushLog(`Bạn tiến vào ${WORLD_NAMES[0]}.`, 'info');
    hud.flash(hero.name.toUpperCase());
  }

  try {
    DBG.info('khởi động', 'bắt đầu');
    loading.set('ĐANG KHỞI ĐỘNG', 0.1);

    /* Kích thước thật của vùng hiển thị, để soi layout lệch. */
    {
      const w = Math.round(document.documentElement.clientWidth);
      const h = Math.round(document.documentElement.clientHeight);
      const u = Math.min(w / 430, h / 932);
      sysLog(
        `Màn hình: ${w} × ${h} · DPR ${window.devicePixelRatio || 1} · ` +
          `--u ${u.toFixed(3)} · sân khấu ${Math.round(430 * u)} × ${Math.round(932 * u)}`,
        false
      );
    }

    loading.set('ĐANG KHỞI ĐỘNG', 0.45);
    const store = window.__store;
    if (!store) {
      throw new Error('Engine chưa chạy: window.__store trống.');
    }
    const engine = {
      store,
      eventBus: window.__eventBus,
      scene: window.__scene,
      world: window.__world,
    };

    loading.set('ĐANG DỰNG GIAO DIỆN', 0.75);
    sysLog(`Dữ liệu nạp từ thư mục ${MU_ASSETS.GOC}`);

    bridge = createBridge({
      store: engine.store,
      world: engine.world,
      eventBus: engine.eventBus,
      soundsManager: window.__soundsManager,
      scene: engine.scene,
      prepareMap: mapIndex => loadMapAssets(mapIndex),
    });

    const resolve = p => MU_ASSETS.resolve(p);
    const resolveBg = async p => MU_ASSETS.resolve(p);

    hud = createHud({
      bridge,
      resolveIcon: resolve,
      resolveBg,
      onOpenPanel: id => {
        if (panels.current === id) {
          panels.close();
          hud.setPanelActive(id, false);
          return;
        }
        if (panels.current) hud.setPanelActive(panels.current, false);
        panels.open(id, bridge.snapshot());
        hud.setPanelActive(id, true);
      },
    });

    panels = createPanels({
      bridge,
      resolve,
      resolveBg,
      onClose: () => {
        const id = panels.current;
        panels.close();
        if (id) hud.setPanelActive(id, false);
      },
      onQuit: () => {
        panels.close();
        showScreen('start');
        start.setSave(readSave());
      },
    });

    start = createStartScreen({
      onContinue: () => {
        const save = readSave();
        const hero = HEROES.find(h => h.cls === save?.cls) || HEROES[0];
        enterWorld(hero);
      },
      onNewGame: () => showScreen('heroes'),
    });

    heroes = createHeroScreen({
      onBack: () => showScreen('start'),
      onEnter: hero => enterWorld(hero),
    });

    ui.append(start.root, heroes.root, hud.root, panels.root);
    xaHangCho();

    /* Lỗi và cảnh báo bắt được ở lớp gỡ lỗi hiện luôn lên khung nhật ký góc
       trái, để nhìn màn hình là biết có chuyện, không phải mở Cài đặt. */
    DBG.onLine((dong, muc) => {
      if (muc === 'error') hud.pushLog(dong.slice(0, 120), 'bad');
      else if (muc === 'net') hud.pushLog(dong.slice(0, 120), 'warn');
    });

    bridge.onLog((text, kind) => hud.pushLog(text, kind));

    /* Chiến đấu chơi đơn. Toàn bộ phép tính nằm trong engine
       (src/offline/ bên engine) và báo ra bằng sự kiện; lớp giao diện chỉ
       vẽ lại. Bốn sự kiện dưới đây là tất cả những gì HUD cần biết. */
    const bus = engine.eventBus;
    if (bus) {
      bus.on('offlineHit', ({ x, y, amount, kind }) => {
        // x, y là pixel màn hình do engine tính sẵn; popFloat nhận phần trăm.
        // Lệch ngẫu nhiên vài phần trăm: đánh liên tục mà số cứ rơi trúng
        // một chỗ thì chồng lên nhau đọc không ra.
        const lech = () => (Math.random() - 0.5) * 6;
        const px = (x > 0 ? (x / window.innerWidth) * 100 : 50) + lech();
        const py = (y > 0 ? (y / window.innerHeight) * 100 : 62) + lech();
        if (kind === 'miss') {
          hud.popFloat('TRƯỢT', 'mana', px, py);
        } else {
          hud.popFloat(String(amount), kind, px, py);
        }
      });

      bus.on('offlineKill', ({ name, exp, zen }) => {
        hud.pushLog(`Hạ ${name} · +${exp} KN · +${zen} Zen`, 'good');
      });

      bus.on('offlineLoot', ({ name }) => {
        hud.pushLog(name === 'TÚI ĐẦY' ? 'Túi đã đầy, không nhặt được' : `Nhặt được ${name}`,
          name === 'TÚI ĐẦY' ? 'warn' : 'good');
      });

      bus.on('offlineLevelUp', ({ level, points }) => {
        hud.pushLog(`LÊN CẤP ${level}! Có ${points} điểm cộng`, 'warn');
        hud.flash(`LÊN CẤP ${level}`);
      });

      /* Đổi bản đồ thì quên map cũ. */
      let mapDangChoi = 0;
      bus.on('warpCompleted', ({ map }) => {
        if (map !== mapDangChoi) {
          releaseMap(mapDangChoi);
          mapDangChoi = map;
          const ten = WORLD_NAMES[map] || `Bản đồ ${map}`;
          hud.pushLog(`Bạn tiến vào ${ten}.`, 'info');
          hud.flash(ten.toUpperCase());
        }
        // Đổi bản đồ là engine dựng lại camera, phải áp lại góc nhìn ĐANG CHỌN.
        bridge.applyGfx();
      });

      bus.on('offlinePlayerDied', () => {
        hud.pushLog('Bạn gục ngã — hồi sinh ngay tại chỗ', 'bad');
        hud.flash('BẠN ĐÃ GỤC');
      });
    }

    bridge.subscribe((snap, changed) => {
      hud.update(snap, changed);
      panels.update(snap, changed);
    });
    bridge.start();

    // Ghi lại phiên chơi mỗi 5 giây để màn khởi đầu có dữ liệu thật.
    setInterval(() => {
      if (!sessionStart) return;
      const snap = bridge.snapshot();
      writeSave({
        cls: chosenHero.cls,
        heroName: chosenHero.name,
        level: snap.level,
        mapName: snap.mapName,
        playtime: fmtClock(Date.now() - sessionStart),
        savedAt: Date.now(),
      });
    }, 5000);

    loading.show(false);
    start.setSave(readSave());
    showScreen('start');
  } catch (err) {
    DBG.error('khởi động', err);
    console.error(err);
    loading.show(false);
    fatal.show(err);
  }
}
