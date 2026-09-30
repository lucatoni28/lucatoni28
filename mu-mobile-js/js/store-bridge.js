// Cầu nối giữa Store (mobx, nằm trong bundle engine) và lớp giao diện Aetherfall.
//
// Bundle không xuất mobx ra ngoài nên ta không dùng được autorun/observe. Thay
// vào đó bridge đọc Store mỗi khung hình rồi so sánh nông: HUD chỉ có khoảng
// hai chục số vô hướng nên chi phí không đáng kể, còn túi đồ (100+ ô) chỉ được
// băm lại khi panel hành trang đang mở.
//
// Mọi giá trị dưới đây là dữ liệu thật của engine, không có số giả.

import { WORLD_NAMES, INV, ACTION_KEYS } from './game-data.js';

const clamp01 = n => (n < 0 ? 0 : n > 1 ? 1 : n);

/** 1.234.567 — dấu chấm theo cách viết số tiếng Việt. */
export function fmtNum(n) {
  return Math.round(n || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* Chữ ký một món, dùng để biết túi có đổi gì không mà vẽ lại.
   Phải gồm CẢ ngọc khảm và cờ đồ Thần: thiếu thì khảm ngọc xong bảng không
   vẽ lại, nhìn như không có tác dụng. */
function itemSig(it) {
  if (!it) return '';
  const ng = (it.sockets ?? []).map(x => (x === null || x === undefined ? '-' : x)).join('');
  return `${it.group}.${it.num}.${it.lvl || 0}.${it.isExcellent ? 1 : 0}.${
    it.isDivine ? 1 : 0
  }.${ng}`;
}

/**
 * Năm góc camera đặt sẵn.
 *
 * Camera của engine là ArcRotateCamera; alpha là góc quay quanh trục đứng,
 * beta là góc NGHIÊNG TÍNH TỪ ĐỈNH ĐẦU (beta 0 = nhìn thẳng từ trên xuống,
 * π/2 = ngang tầm mắt), radius là khoảng cách, fov là góc mở ống kính.
 *
 * Giá trị gốc engine dùng: alpha −π/4, beta 0,698 (≈40°), radius 10, fov 0,8 —
 * đó chính là mục "MU cổ điển", để đầu danh sách và là mặc định. Bốn mục còn
 * lại giữ nguyên alpha để không mất cảm giác chéo góc quen thuộc của MU.
 */
export const CAMERA_VIEWS = [
  { id: 'mu', name: 'MU cổ điển', beta: 0.698, radius: 10, fov: 0.8 },
  { id: 'near', name: 'Cận cảnh', beta: 0.8, radius: 7.5, fov: 0.8 },
  { id: 'wide', name: 'Toàn cảnh', beta: 0.62, radius: 15, fov: 0.8 },
  { id: 'cine', name: 'Điện ảnh', beta: 0.95, radius: 12, fov: 0.72 },
  { id: 'top', name: 'Nhìn từ trên', beta: 0.42, radius: 13, fov: 0.85 },
];

/** Bốn mức độ nét khi dựng hình.
 *
 * Canvas đặt cứng 430×932 điểm ảnh CSS. Mức 3× là 1290×2796 — đúng bằng mật độ
 * thật của màn iPhone Pro Max, nét hơn nữa thì mắt không thấy mà GPU vẫn phải
 * tô. Vì vậy setRenderScale() tự hạ xuống devicePixelRatio của máy đang chạy:
 * trên máy DPR 2 chọn 3× cũng chỉ dựng ở 2×, không phí. */
export const RENDER_SCALES = [
  { id: 1, name: '1× · nhẹ' },
  { id: 1.5, name: '1,5× · cân bằng' },
  { id: 2, name: '2× · nét' },
  { id: 3, name: '3× · nét nhất' },
];

/**
 * Thiết lập đồ hoạ mặc định khi vào game.
 *
 * Trước đây các hàng nút trong Cài đặt chỉ TÔ SẴN một lựa chọn chứ không áp
 * dụng gì cả — engine vẫn chạy theo mặc định của nó cho tới khi người chơi bấm
 * tay. Nay bridge.applyGfxDefaults() áp thật lúc vào thế giới và sau mỗi lần
 * dịch chuyển bản đồ.
 */
export const GFX_DEFAULT = {
  camera: 'wide',   // Toàn cảnh
  scale: 3,         // nét nhất, tự hạ theo devicePixelRatio
  fpsCap: 0,        // không giới hạn
  fx: {
    shadow: true,     // bóng đổ nhân vật và quái xuống đất
    sharpen: true,    // hậu kỳ làm nét
    dust: true,       // bụi mịn bay trong không trung
    firelight: true,  // ánh lửa nhấp nháy từ đuốc, đèn, đống lửa
    /* Vòng đom đóm khi mặc đủ bộ 5/5. BẬT SẴN để test được.
       Chưa hoàn chỉnh: mã đếm đúng 22 đốm khi đủ bộ nhưng chưa hiện rõ trên
       hình — thin instance mang ma trận riêng nên billboardMode của Babylon
       bị bỏ qua, tấm phẳng nằm nghiêng cạnh về camera. Còn phải nhân tay
       phần quay của camera vào từng ma trận. Để BẬT thì bạn nhìn thấy đúng
       hiện trạng mà chỉ chỗ sửa. */
    setAura: true,
    /* TẮT SẴN. Lớp tán sáng hậu kỳ (bloom) này KHÔNG có trong bản gốc — tôi
       thêm vào, và nó làm hỏng hình: ánh sáng nhoè tràn ra ngoài đường viền,
       nhân vật mặc đủ bộ +7 trở lên là bảy quầng chồng nhau thành một cục
       vàng, không còn nhìn ra người lẫn cánh.

       Hiệu ứng đồ Xuất sắc thật đã chuyển vào shader — ánh cầu vồng chạy
       trên viền món đồ, đúng thứ client MU làm. Xem itemMaterial.ts.

       Vẫn bật lại được trong HỆ THỐNG, không cắt bỏ tính năng. */
    itemGlow: false,   // ← bạn vừa chốt bỏ; bật lại trong HỆ THỐNG bất cứ lúc nào
  },
};

/** Sáu hiệu ứng dựng trong engine — xem src/gfx bên engine. */
export const GFX_FX = [
  { id: 'shadow', name: 'Bóng đổ' },
  { id: 'sharpen', name: 'Làm nét' },
  { id: 'dust', name: 'Bụi bay trong không trung' },
  { id: 'firelight', name: 'Ánh lửa đuốc, đèn' },
  { id: 'itemGlow', name: 'Quầng sáng nhoè (không phải bản gốc)' },
  { id: 'setAura', name: 'Vòng sáng khi đủ bộ (chưa xong)' },
];

export function createBridge({
  store,
  world,
  eventBus,
  soundsManager,
  scene,
  prepareMap = null,
}) {
  if (!store) throw new Error('bridge: thiếu Store');

  const listeners = new Set();
  let prev = null;
  let running = false;
  let rafId = 0;
  let wantInventory = false;
  let lastLogLen = 0;
  const logSink = new Set();

  /* Thiết lập đồ hoạ đang chọn. Giữ ở đây để áp lại được sau mỗi lần đổi bản
     đồ, vì engine dựng lại camera mỗi lần ấy. */
  const gfx = { ...GFX_DEFAULT, fx: { ...GFX_DEFAULT.fx } };

  let rampTimer = 0;

  /** Đặt độ nét khung dựng, không vượt quá mật độ thật của màn. */
  function datDoNet(eng, scale) {
    // Nét hơn mật độ màn thì mắt không thấy mà số điểm ảnh phải tô vẫn tăng
    // theo bình phương.
    const tran = Math.max(1, window.devicePixelRatio || 1);
    eng.setHardwareScalingLevel(1 / Math.min(scale, tran));
    eng.resize();
  }

  /* Đo nhịp vẽ và chặn nhịp vẽ. Bọc scene.render đúng MỘT lần. */
  let fpsCap = 0;
  let renderedFps = 0;
  let renderWrapped = false;

  function capRender() {
    if (renderWrapped) return true;
    if (!scene?.render) return false;

    const goc = scene.render.bind(scene);
    let lanTruoc = 0;
    let dem = 0;
    let mocDem = performance.now();

    scene.render = (...args) => {
      const bayGio = performance.now();
      // Trừ 1 ms cho sai số của requestAnimationFrame, không thì cứ đúng 60 Hz
      // mà chặn 30 khung/giây sẽ rơi xuống 20.
      if (fpsCap && bayGio - lanTruoc < 1000 / fpsCap - 1) return undefined;
      lanTruoc = bayGio;

      dem++;
      if (bayGio - mocDem >= 500) {
        renderedFps = (dem * 1000) / (bayGio - mocDem);
        dem = 0;
        mocDem = bayGio;
      }
      return goc(...args);
    };

    renderWrapped = true;
    return true;
  }
  capRender();

  /** Nhân vật người chơi trong ECS, nếu đã dựng xong. */
  function playerEntity() {
    return world?.playerEntity ?? null;
  }

  function readInventory() {
    const items = store.playerData?.items ?? store.items ?? [];
    const equip = [];
    for (let i = INV.FirstEquippableItemSlotIndex; i <= INV.LastEquippableItemSlotIndex; i++) {
      equip.push(items[i] ?? null);
    }
    const bagStart = INV.LastEquippableItemSlotIndex + 1;
    const bagSize = INV.InventoryRows * INV.RowSize;
    const bag = [];
    for (let i = 0; i < bagSize; i++) bag.push(items[bagStart + i] ?? null);
    return { equip, bag };
  }

  function inventorySignature() {
    const { equip, bag } = readInventory();
    return equip.concat(bag).map(itemSig).join(',');
  }

  /**
   * Dời một món trong TÚI sang ô khác của túi.
   *
   * Chỉ sắp xếp trong túi. Mặc và cởi đồ đi đường khác — bridge.moveItem /
   * equipItem / unequipItem, gọi thẳng sang engine, nơi có bảng loại→ô thật
   * (cột ItemSlot trong items.json).
   *
   * Chỉ số truyền vào là chỉ số Ô TÚI (0…63), không phải chỉ số slot của
   * engine — hàm tự cộng phần bù.
   */
  function moveBagItem(from, to) {
    const items = store.playerData?.items ?? store.items;
    if (!items) return false;
    const size = INV.InventoryRows * INV.RowSize;
    if (from === to) return false;
    if (from < 0 || from >= size || to < 0 || to >= size) return false;

    const base = INV.LastEquippableItemSlotIndex + 1;
    const mon = items[base + from];
    if (!mon) return false;
    // Ô đích phải trống — bên gọi đã dựng bản đồ ô bị chiếm (món nhiều ô che
    // cả những ô không phải gốc) và kiểm trước khi gọi.
    if (items[base + to]) return false;

    items[base + to] = mon;
    items[base + from] = undefined;
    return true;
  }

  /** Ảnh chụp trạng thái phục vụ render. */
  function snapshot() {
    const pd = store.playerData ?? store;
    const ent = playerEntity();

    const maxHP = Math.max(pd.maxHP || 1, 1);
    const maxMP = Math.max(pd.maxMP || 1, 1);
    const maxSD = Math.max(pd.maxSD || 1, 1);
    const maxAG = Math.max(pd.maxAG || 1, 1);
    const lvlSpan = Math.max((pd.expToNextLvl || 1) - (pd.currentLvlExp || 0), 1);

    const snap = {
      uiState: store.uiState,
      isOffline: !!store.isOffline,

      level: pd.level || 1,
      points: pd.points || 0,

      /* Bốn số dẫn xuất lấy THẲNG từ hàm engine đang dùng để tính sát thương
         (window.__combat, đặt trong src/main.tsx), không chép lại công thức —
         chép là sớm muộn cũng lệch với engine. */
      dmgMin: window.__combat?.minDamage?.() ?? 0,
      dmgMax: window.__combat?.maxDamage?.() ?? 0,
      def: window.__combat?.defense?.() ?? 0,
      atkRate: window.__combat?.attackRate?.() ?? 0,

      hp: pd.currentHP || 0,
      maxHp: maxHP,
      hpPct: clamp01((pd.currentHP || 0) / maxHP),
      mp: pd.currentMP || 0,
      maxMp: maxMP,
      mpPct: clamp01((pd.currentMP || 0) / maxMP),
      sd: pd.currentSD || 0,
      maxSd: maxSD,
      sdPct: clamp01((pd.currentSD || 0) / maxSD),
      ag: pd.currentAG || 0,
      maxAg: maxAG,
      agPct: clamp01((pd.currentAG || 0) / maxAG),

      exp: pd.exp || 0,
      expFrom: pd.currentLvlExp || 0,
      expTo: pd.expToNextLvl || 1,
      expPct: clamp01(((pd.exp || 0) - (pd.currentLvlExp || 0)) / lvlSpan),

      str: pd.str || 0,
      agi: pd.agi || 0,
      sta: pd.sta || 0,
      eng: pd.eng || 0,

      money: pd.money || 0,
      x: Math.round(pd.x || 0),
      y: Math.round(pd.y || 0),
      selectedSkill: pd.selectedSkill ?? -1,

      worldIndex: ent?.worldIndex ?? null,
      mapName: WORLD_NAMES[ent?.worldIndex] ?? '—',
      charClass: ent?.charAppearance?.charClass ?? null,

      // Bốn ô hành động: id vật phẩm và số lượng thật trong Store.
      action: ACTION_KEYS.map(k => {
        const s = pd.actionBar?.[k];
        return s ? { key: k, itemId: s.itemId ?? 0, count: s.count ?? 0 } : { key: k, itemId: 0, count: 0 };
      }),

      notificationCount: store.notifications?.length ?? 0,
      invSig: wantInventory ? inventorySignature() : '',
    };

    return snap;
  }

  /** Chỉ báo cho render biết trường nào đổi, tránh chạm DOM thừa. */
  function diff(a, b) {
    if (!a) return null; // lần đầu: vẽ tất cả
    const changed = {};
    let any = false;
    for (const k of Object.keys(b)) {
      const av = a[k];
      const bv = b[k];
      if (k === 'action') {
        const same =
          av &&
          av.length === bv.length &&
          av.every((s, i) => s.itemId === bv[i].itemId && s.count === bv[i].count);
        if (!same) {
          changed[k] = true;
          any = true;
        }
        continue;
      }
      if (av !== bv) {
        changed[k] = true;
        any = true;
      }
    }
    return any ? changed : {};
  }

  function pump() {
    if (!running) return;
    const next = snapshot();
    const changed = diff(prev, next);

    // Thông báo mới của engine đẩy thẳng vào nhật ký chiến đấu.
    const notes = store.notifications ?? [];
    if (notes.length > lastLogLen) {
      for (let i = lastLogLen; i < notes.length; i++) {
        const n = notes[i];
        for (const cb of logSink) cb(n.text, n.type === 'error' ? 'bad' : 'info');
      }
    }
    lastLogLen = notes.length;

    if (changed === null || Object.keys(changed).length) {
      for (const cb of listeners) cb(next, changed);
    }
    prev = next;
    rafId = requestAnimationFrame(pump);
  }

  const bridge = {
    /** Đăng ký nhận trạng thái mỗi khi có thay đổi. */
    subscribe(cb) {
      listeners.add(cb);
      if (prev) cb(prev, null);
      return () => listeners.delete(cb);
    },

    /** Đăng ký nhận dòng nhật ký (thông báo của engine). */
    onLog(cb) {
      logSink.add(cb);
      return () => logSink.delete(cb);
    },

    /** Bật/tắt việc băm túi đồ — chỉ bật khi panel hành trang đang mở. */
    watchInventory(on) {
      wantInventory = !!on;
    },

    readInventory,
    moveBagItem,
    snapshot,

    start() {
      if (running) return;
      running = true;
      lastLogLen = store.notifications?.length ?? 0;
      rafId = requestAnimationFrame(pump);
    },

    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },

    // ---------------------------------------------------------------- lệnh

    /** Vào thế giới ở chế độ chơi đơn. */
    playOffline() {
      store.playOffline();
    },

    /**
     * Đổi lớp nhân vật của người chơi. AppearanceSystem dựng lại model khi
     * cờ changed được bật, nên nhân vật đổi hình ngay trong cảnh.
     */
    setCharClass(cls) {
      const ent = playerEntity();
      if (!ent?.charAppearance) return false;
      ent.charAppearance.charClass = cls;
      ent.charAppearance.changed = true;
      return true;
    },

    /** Dịch chuyển sang bản đồ khác. prepareMap nạp sẵn asset trước khi engine dựng. */
    warp(mapId) {
      if (!prepareMap) {
        eventBus?.emit('requestWarp', { map: mapId });
        return;
      }
      Promise.resolve(prepareMap(mapId))
        .catch(() => {})
        .then(() => eventBus?.emit('requestWarp', { map: mapId }));
    },

    /**
     * Yêu cầu đánh — chỉ có tác dụng ở chế độ chơi đơn, nơi
     * OfflineCombatSystem bắt sự kiện này rồi tự chọn mục tiêu gần nhất nếu
     * chưa chạm vào con nào.
     */
    attack(slot = 0) {
      eventBus?.emit('offlineAttack', { slot });
    },

    /**
     * Hai công tắc chơi đơn. Việc thật nằm trong engine:
     *   tự đánh — OfflineCombatSystem tự bắt mục tiêu gần nhất rồi chạy tới,
     *             mọi phép tính sát thương vẫn đi qua đúng đường cũ.
     *   tự nhặt — offlineProgress chỉ cho đồ vào túi khi cờ này bật.
     */
    setAutoAttack(on) {
      store.autoAttack = !!on;
      return store.autoAttack;
    },

    setAutoLoot(on) {
      store.autoLoot = !!on;
      return store.autoLoot;
    },

    autoState() {
      return { attack: !!store.autoAttack, loot: !!store.autoLoot };
    },

    /**
     * Cộng một điểm vào chỉ số. Việc thật nằm ở engine (spendPoint trong
     * src/offline/offlineProgress.ts) — sinh lực và năng lượng phép được tính
     * lại theo đúng công thức có sẵn, không cộng tay ở đây.
     */
    spendPoint(stat) {
      return !!store.spendPointOffline?.(stat);
    },

    /* ------------------------------------------------------- đồ đạc
       Toàn bộ phép tính nằm ở engine (src/offline/itemStats.ts và
       itemActions.ts); bridge chỉ là đường gọi sang, không tính lại con số
       nào — tính lại là sớm muộn lệch với lúc đánh nhau. */

    /** Mô tả đầy đủ một món: tên, hạng, sát thương, phòng thủ, yêu cầu, ngọc. */
    describeItem(item) {
      return window.__itemStats?.describe?.(item) ?? null;
    },

    /** Hạng của món, quyết định màu chữ: wing | divine | excellent | socket | normal. */
    itemRank(item) {
      return window.__itemStats?.rank?.(item) ?? 'normal';
    },

    /** Những ô trang bị mà món này mặc vào được. */
    equipSlotsFor(item) {
      return window.__itemStats?.equipSlotsFor?.(item) ?? [];
    },

    /** Bảng năm loại ngọc khảm. */
    socketKinds() {
      return window.__itemStats?.SOCKET_KINDS ?? [];
    },

    /** Giá và tỉ lệ thành công của lần cường hoá kế tiếp. */
    upgradeInfo(lvl) {
      const s = window.__itemStats;
      if (!s) return null;
      return {
        cost: s.upgradeCost(lvl),
        chance: s.upgradeChance(lvl),
        max: s.MAX_UPGRADE,
      };
    },

    socketInfo(count) {
      const s = window.__itemStats;
      if (!s) return null;
      return { cost: s.openSocketCost(count), max: s.MAX_SOCKETS, mount: s.MOUNT_COST };
    },

    /** Bộ trang phục đang mặc. */
    gearSet() {
      return window.__combat?.gearSet?.() ?? { num: -1, name: '', count: 0, defPct: 0, atkRate: 0 };
    },

    moveItem(from, to) {
      return store.moveItemOffline?.(from, to) ?? 'engine chưa sẵn sàng';
    },

    equipItem(bagSlot) {
      return store.equipItemOffline?.(bagSlot) ?? 'engine chưa sẵn sàng';
    },

    unequipItem(equipSlot) {
      return store.unequipItemOffline?.(equipSlot) ?? 'engine chưa sẵn sàng';
    },

    upgradeItem(slot) {
      return store.upgradeItemOffline?.(slot) ?? { ok: false, reason: 'engine chưa sẵn sàng' };
    },

    openSocket(slot) {
      return store.openSocketOffline?.(slot) ?? { ok: false, reason: 'engine chưa sẵn sàng' };
    },

    mountSocket(slot, index, kind) {
      return store.mountSocketOffline?.(slot, index, kind) ?? { ok: false, reason: 'engine chưa sẵn sàng' };
    },

    clearSocket(slot, index) {
      return store.clearSocketOffline?.(slot, index) ?? { ok: false, reason: 'engine chưa sẵn sàng' };
    },

    /** Chọn kỹ năng đang dùng. */
    selectSkill(index) {
      const pd = store.playerData ?? store;
      pd.selectedSkill = index;
    },

    /* ------------------------------------------------ camera và hiệu năng
       Cả ba hàm dưới đây chỉ đụng tới CÁCH DỰNG HÌNH: góc nhìn, độ phân giải
       khung dựng, nhịp vẽ. Không hàm nào sửa chỉ số nhân vật, sát thương,
       tốc độ hay bất kỳ con số nào của lối chơi. */

    /** Đặt một góc camera có sẵn. Trả false nếu chưa có camera. */
    setCameraView(id) {
      const cam = scene?.activeCamera;
      const v = CAMERA_VIEWS.find(x => x.id === id);
      if (!v) return false;
      gfx.camera = id;
      if (!cam) return false;
      if (cam.beta !== undefined) cam.beta = v.beta;
      if (cam.radius !== undefined) cam.radius = v.radius;
      cam.fov = v.fov;
      return true;
    },

    /**
     * Độ nét khung dựng. Canvas đặt cứng 430×932 nên mặc định engine dựng ở
     * đúng 1 điểm ảnh CSS = 1 điểm ảnh khung, tức chỉ bằng 1/3 mật độ màn
     * Retina. Đặt mức tỉ lệ cứng 1/scale là dựng ở độ phân giải cao hơn:
     * nét hơn nhưng số điểm ảnh phải tô tăng theo bình phương.
     */
    setRenderScale(scale) {
      const eng = scene?.getEngine?.();
      if (!eng) return false;
      gfx.scale = scale;
      datDoNet(eng, scale);
      return true;
    },

    /**
     * Nâng độ nét lên mức đang chọn SAU KHI cảnh nạp xong.
     *
     * Vì sao cần: model và texture chỉ nạp được mỗi khung hình một ít, nên
     * dựng ngay ở 3× (Retina, gấp 9 lần số điểm ảnh so với 1×) làm chính việc
     * nạp chậm theo — đo được là nhân vật vào tới nơi vẫn trần trùng trục, đồ
     * chưa kịp mặc. Nạp ở 1× cho nhanh rồi mới nâng lên là ảnh cuối vẫn nét y
     * hệt mà vào game không phải chờ.
     */
    rampRenderScale(timeoutMs = 30000) {
      const eng = scene?.getEngine?.();
      if (!eng) return false;

      const dich = gfx.scale;
      if (dich <= 1) return true;

      datDoNet(eng, 1);
      clearInterval(rampTimer);

      const het = Date.now() + timeoutMs;
      let yen = 0;
      rampTimer = setInterval(() => {
        if (Date.now() < het) {
          // Hai điều kiện, không phải một: hàng đợi AssetsManager rỗng KHÔNG có
          // nghĩa là xong — texture đọc xong rồi vẫn còn phải giải mã và đẩy
          // lên GPU, đo được là lúc ấy nhân vật vẫn còn trắng. Nên chờ thêm cho
          // mọi texture báo sẵn sàng, và giữ yên hai nhịp liền mới nâng.
          const conCho = scene?.getWaitingItemsCount?.() ?? 0;
          const texChua = (scene?.textures ?? []).some(
            t => t.isReady && !t.isReady()
          );
          if (conCho > 0 || texChua) {
            yen = 0;
            return;
          }
          if (++yen < 2) return;
        }
        clearInterval(rampTimer);
        rampTimer = 0;
        datDoNet(eng, gfx.scale);
      }, 400);
      return true;
    },

    /**
     * Áp lại bộ thiết lập đồ hoạ ĐANG CHỌN.
     *
     * Gọi sau mỗi lần dịch chuyển bản đồ: engine dựng lại camera nên góc nhìn
     * về mặc định của nó. Áp lại lựa chọn hiện tại chứ KHÔNG áp lại mặc định —
     * người chơi đã đổi sang góc khác thì giữ đúng góc ấy.
     */
    applyGfx() {
      const kq = {
        camera: this.setCameraView(gfx.camera),
        scale: this.rampRenderScale(),
        fpsCap: this.setFpsCap(gfx.fpsCap),
      };
      for (const k of Object.keys(gfx.fx)) kq[k] = this.setFx(k, gfx.fx[k]);
      return kq;
    },

    /**
     * Bật/tắt một hiệu ứng dựng hình. Phần việc thật nằm trong engine
     * (src/gfx bên engine), đây chỉ là đường gọi sang.
     */
    setFx(key, on) {
      gfx.fx[key] = !!on;
      const g = window.__gfx;
      if (!g) return false;
      return g.set(key, !!on);
    },

    /** Áp bộ thiết lập đồ hoạ mặc định. Gọi một lần lúc vào thế giới. */
    applyGfxDefaults() {
      gfx.camera = GFX_DEFAULT.camera;
      gfx.scale = GFX_DEFAULT.scale;
      gfx.fpsCap = GFX_DEFAULT.fpsCap;
      gfx.fx = { ...GFX_DEFAULT.fx };
      return this.applyGfx();
    },

    /** Thiết lập đồ hoạ đang chọn — để giao diện tô đúng nút. */
    gfxState() {
      return { ...gfx, fx: { ...gfx.fx } };
    },

    /**
     * Giới hạn nhịp vẽ. 0 là không giới hạn.
     *
     * Bọc thẳng scene.render: chưa tới hạn thì bỏ qua hẳn lần vẽ đó, GPU không
     * phải tô gì cả — đó mới là chỗ tiết kiệm thật. Không dùng getFps() của
     * Babylon để báo lại vì bộ đếm ấy nằm ở endFrame của vòng lặp, bỏ qua
     * scene.render nó vẫn đếm; nên tự đo số lần VẼ THẬT.
     */
    setFpsCap(cap) {
      gfx.fpsCap = cap || 0;
      if (!capRender()) return false;
      fpsCap = cap || 0;
      return true;
    },

    /** Số khung/giây VẼ THẬT, để người chơi tự đối chiếu khi đổi thiết lập. */
    fps() {
      return Math.round(renderedFps);
    },

    /** Ghi một dòng thông báo qua đúng kênh của engine. */
    notify(text, type = 'info') {
      store.addNotification?.(text, type);
    },

    /** Bật/tắt nhạc nền và hiệu ứng âm thanh. */
    setMusic(on) {
      const t = soundsManager?.musicTrack;
      if (t) t.setVolume?.(on ? 1 : 0);
      return !!t;
    },

    setSfx(on) {
      const t = soundsManager?.effectsTrack;
      if (t) t.setVolume?.(on ? 1 : 0);
      return !!t;
    },

    get store() {
      return store;
    },
    get world() {
      return world;
    },
    get playerEntity() {
      return playerEntity();
    },
  };

  return bridge;
}
