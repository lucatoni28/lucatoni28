// HUD trong màn chơi: thông tin góc, minimap, cột gem, nhật ký, thanh dưới.
// Toàn bộ số liệu đến từ bridge (Store thật của engine).

import { el, setText, setStyle, setVar, setClass, onTap, clear } from './dom.js';
import { fmtNum } from '../store-bridge.js';
import {
  BAR_ORBS,
  BAR_SLOTS,
  BAR_DEFAULT_SLOTS,
  MENU_ITEMS,
  ACTION_KEYS,
  barIconPath,
  terrainMapPath,
} from '../game-data.js';

/* Nhật ký nay nằm ở góc trái trên và gánh thêm thông báo hệ thống (nạp nguồn
   dữ liệu, bung bản đồ, lỗi) để soi lỗi ngay trên máy, nên chứa nhiều dòng
   hơn trước. */
const MAX_LOG_LINES = 7;

export function createHud({ bridge, onOpenPanel, resolveIcon, resolveBg }) {
  /* Góc trái trên TRỐNG. Trước đây chỗ này có tên nhân vật, hai ô buff SD/AG
     và huy hiệu túi tiền + nút tự động. Đã bỏ hết theo yêu cầu; khung nhật ký
     chuyển lên thay. Tên và cấp vẫn xem được ở panel NHÂN VẬT, Zen ở chân
     panel HÀNH TRANG, hai công tắc tự động nay nằm dưới radar. */

  /* ---------------------- góc trên phải: radar tròn
     Nền radar là TerrainLight.jpg của chính bản đồ đang chơi — ảnh nhìn từ
     trên xuống thật do engine dùng để đổ sáng địa hình, không phải hình vẽ.
     Tên bản đồ và toạ độ nằm luôn trong khung radar. Chạm vào mở bản đồ lớn
     kèm bảng chọn điểm dịch chuyển. */
  const miniSelf = el('div.ae-minimap__self');
  const miniGrid = el('div.ae-minimap__grid');
  const miniLand = el('div.ae-minimap__land');
  const minimap = el('div.ae-minimap', null, [miniLand, miniGrid, miniSelf]);

  const mapText = el('div.ae-radar__name');
  const coordText = el('div.ae-radar__coord');
  const radar = el('div.ae-radar.tappable', { title: 'Bản đồ · chạm để dịch chuyển' }, [
    el('div.ae-radar__ring', null, [minimap]),
    el('div.ae-radar__band', null, [mapText, coordText]),
  ]);
  onTap(radar, () => onOpenPanel('warp'));

  /* Hai công tắc ngay dưới radar.
     Cả hai đều có tác dụng THẬT trong engine, không phải nhãn suông:
       tự đánh — OfflineCombatSystem tự bắt con gần nhất trong 12 ô rồi chạy tới
       tự nhặt — offlineProgress chỉ bỏ đồ vào túi khi cờ này bật */
  function congTac(nhan, batDau, apDung) {
    const den = el('span.ae-switch__dot');
    const node = el('div.ae-switch.tappable', { title: nhan }, [
      den,
      el('span.ae-switch__text', { text: nhan }),
    ]);
    let on = batDau;
    const ve = () => setClass(node, 'ae-switch--on', on);
    onTap(node, () => {
      on = !on;
      ve();
      apDung(on);
    });
    ve();
    /* KHÔNG gọi apDung ngay ở đây. Hàm đó ghi một dòng nhật ký, mà khung nhật
       ký (const log) khai báo ở phía dưới file — gọi lúc này là chạm vào biến
       chưa khởi tạo và cả HUD chết ngay từ đầu. Trạng thái ban đầu đã trùng
       mặc định trong Store (autoAttack false, autoLoot true) nên không cần áp
       lại; đổi tay mới gọi. */
    return node;
  }

  const autoAtk = congTac('TỰ ĐÁNH', false, on => {
    bridge.setAutoAttack(on);
    pushLog(on ? 'Tự đánh: BẬT' : 'Tự đánh: TẮT', 'sys');
  });
  const autoLoot = congTac('TỰ NHẶT', true, on => {
    bridge.setAutoLoot(on);
    pushLog(on ? 'Tự nhặt: BẬT' : 'Tự nhặt: TẮT', 'sys');
  });

  const topRight = el('div.ae-hud__topright', null, [
    radar,
    el('div.ae-switches', null, [autoAtk, autoLoot]),
  ]);

  /* ------------------------------------------------------------- cột gem
     Năm mục gộp vào MỘT nút tròn ở mép phải; chạm thì bung lên thành cột, chọn
     xong tự thu lại. Trước đây cột này nằm dọc mép trái và chắn đúng chỗ người
     chơi hay đặt ngón tay để xoay cảnh. */
  const gemNodes = new Map();
  const menuList = el('div.ae-hud__menu', { hidden: true });
  for (const item of MENU_ITEMS) {
    const badgeDot = el('span.ae-gem__badge');
    const gem = el('div.ae-gem.tappable', { title: item.title }, [
      el('span.ae-gem__glyph', { text: item.glyph }),
      badgeDot,
      el('span.ae-gem__label', { text: item.label }),
    ]);
    onTap(gem, () => {
      closeMenu();
      onOpenPanel(item.id);
    });
    gemNodes.set(item.id, { gem, badge: badgeDot });
    menuList.append(gem);
  }

  const menuBtn = el('div.ae-menu__toggle.tappable', { title: 'Bảng điều khiển' }, [
    el('span.ae-menu__glyph', { text: '☰' }),
  ]);
  const menu = el('div.ae-menuwrap', null, [menuList, menuBtn]);

  function closeMenu() {
    menuList.hidden = true;
    setClass(menuBtn, 'ae-menu__toggle--on', false);
  }
  onTap(menuBtn, () => {
    menuList.hidden = !menuList.hidden;
    setClass(menuBtn, 'ae-menu__toggle--on', !menuList.hidden);
  });

  /* --------------------------- hai nút tròn to góc phải dưới
     Nút TẤN CÔNG đánh thật: engine đã có OfflineCombatSystem, nút này phát sự
     kiện offlineAttack, hệ thống đó tự bắt con quái gần nhất nếu chưa chạm
     chọn con nào. Chạm thẳng vào quái trong cảnh cũng chọn được mục tiêu. */
  const MAIN_SKILL_SLOT = 2;
  const mainSkill = BAR_DEFAULT_SLOTS[MAIN_SKILL_SLOT];

  const atkBtn = el('div.ae-act.ae-act--atk.tappable', { title: 'Tấn công' }, [
    el('span.ae-act__glyph', { text: '⚔' }),
  ]);
  onTap(atkBtn, () => bridge.attack(0));

  const skillBtn = el('div.ae-act.ae-act--skill.tappable', {
    title: `Kỹ năng chính · ${mainSkill.name}`,
  }, [
    el('img.ae-act__icon', {
      src: barIconPath(mainSkill),
      alt: '',
      draggable: 'false',
    }),
  ]);
  onTap(skillBtn, () => {
    bridge.selectSkill(MAIN_SKILL_SLOT);
    bridge.attack(MAIN_SKILL_SLOT);
  });

  const acts = el('div.ae-hud__acts', null, [skillBtn, atkBtn]);

  // ---------------------------------------------------------- nhật ký
  const log = el('div.ae-log');
  function pushLog(text, kind = 'info') {
    log.append(el(`div.ae-log__line.ae-log__line--${kind}`, { text }));
    while (log.childElementCount > MAX_LOG_LINES) log.firstElementChild.remove();
  }

  // ------------------------------------------------------------ số bay
  const floats = el('div.ae-floats');
  function popFloat(text, kind = 'dmg', xPct = 50, yPct = 58) {
    const node = el(`div.ae-float.ae-float--${kind}`, {
      text,
      style: { left: `${xPct}%`, top: `${yPct}%` },
    });
    floats.append(node);
    setTimeout(() => node.remove(), 1000);
  }

  // --------------------------------------------------------- thanh dưới
  const expFill = el('div.ae-exp__fill');
  const expText = el('div.ae-exp__text');
  // Chữ đặt TRÊN thanh: thanh EXP giờ nằm sát ngay trên khung bar, chữ mà ở
  // dưới thì đè lên hoạ tiết khung.
  const exp = el('div.ae-exp', null, [
    expText,
    el('div.ae-exp__track', null, [expFill, el('div.ae-exp__ticks')]),
  ]);

  /* Hai quả cầu.
     Lòng vòng cầu trong ui_bar.png đã trong suốt hẳn, nên chất lỏng đặt DƯỚI
     ảnh và tự bị đầu sọ / đầu rồng che đúng chỗ. Hộp cầu là hình tròn hoàn
     hảo (border-radius 50% + overflow hidden), bán kính đã trừ lề an toàn nên
     không thể lem ra ngoài viền.

     Mặt nước gợn nhẹ bằng hai khối bo góc lệch nhau quay chậm ngược chiều —
     mép trên của khối nhấp nhô quanh mực nước. Không dùng SVG hay canvas: chỉ
     hai div xoay, gần như không tốn gì. */
  const orbs = {};
  function makeOrb(kind) {
    const box = BAR_ORBS[kind];
    const geo = { left: box.left, top: box.top, width: box.w, height: box.h };

    const node = el(`div.ae-orb.ae-orb--${kind}`, { style: geo }, [
      el('div.ae-orb__well'),
      el('div.ae-orb__body'),
      el('div.ae-orb__wave.ae-orb__wave--a'),
      el('div.ae-orb__wave.ae-orb__wave--b'),
      el('div.ae-orb__line'),
      el('div.ae-orb__gloss'),
    ]);

    // Số nằm RIÊNG, không nằm trong quả cầu: quả cầu vẽ dưới ảnh khung nên đầu
    // sọ / đầu rồng sẽ che mất số. Hộp số đặt trùng hộp cầu nhưng z-index cao
    // hơn ảnh, nên số luôn đọc được.
    const now = el('b.ae-orb-num__now');
    const max = el('i.ae-orb-num__max');
    const num = el(`div.ae-orb-num.ae-orb-num--${kind}`, { style: geo }, [now, max]);

    orbs[kind] = { node, num, now, max };
    return node;
  }

  /* Bốn ô trên khung, bám Store.actionBar (q/w/e/r). Icon lấy từ kho items/
     của engine, không vẽ lại. */
  const slotNodes = BAR_SLOTS.map((spec, i) => {
    const def = BAR_DEFAULT_SLOTS[i];
    const icon = el('img.ae-skill__icon', {
      alt: '',
      draggable: 'false',
      hidden: !def?.group,
    });
    if (def?.group !== null && def?.group !== undefined) {
      // Icon đã cắt viền nằm trong icons/.
      icon.src = barIconPath(def);
    }
    const count = el('span.ae-skill__count');
    const node = el(
      `div.ae-skill.tappable${def?.group == null ? '.ae-skill--empty' : ''}`,
      {
        style: { left: spec.left, top: spec.top, width: spec.w, height: spec.h },
        title: def ? `${def.key} · ${def.name}` : '',
      },
      [icon, count]
    );
    onTap(node, () => {
      if (!def || def.group == null) {
        bridge.notify('Ô trống');
        return;
      }
      if (i < ACTION_KEYS.length) bridge.selectSkill(i);
      bridge.notify(def.name);
    });
    return { node, icon, count, def };
  });

  const barImg = el('img.ae-bar__img', {
    src: 'ui/bar.png',
    alt: '',
    draggable: 'false',
  });

  // Thứ tự quan trọng: hai quả cầu trước, ảnh khung sau — ảnh vẽ đè lên nên
  // đầu sọ và đầu rồng che đúng phần chất lỏng lẽ ra bị khuất.
  const barArt = el('div.ae-bar__art', null, [
    el('div.ae-bar__frame', null, [
      makeOrb('hp'),
      makeOrb('mp'),
      barImg,
      orbs.hp.num,
      orbs.mp.num,
      ...slotNodes.map(x => x.node),
    ]),
  ]);

  const bar = el('div.ae-bar', null, [el('div.ae-bar__scrim'), exp, barArt]);

  // ------------------------------------------------------------ thông báo
  const toast = el('div.ae-toast', { hidden: true });
  let toastTimer = 0;
  function flash(msg) {
    setText(toast, msg);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  const root = el('div.ae-hud', { hidden: true }, [
    floats,
    topRight,
    menu,
    acts,
    log,
    bar,
    toast,
  ]);

  // ------------------------------------------------------------ cập nhật

  /* Mực nước là một biến CSS duy nhất; thân nước, hai lớp sóng và vạch mặt
     nước đều bám theo nó, nên chỉ cần đặt một chỗ. */
  function applyOrb(kind, pct, cur, max) {
    const o = orbs[kind];
    setVar(o.node, '--lv', `${(Math.max(0, Math.min(1, pct)) * 100).toFixed(1)}%`);
    setText(o.now, fmtNum(cur));
    setText(o.max, `/${fmtNum(max)}`);
  }

  function update(snap, changed) {
    const all = changed === null;
    const has = k => all || changed[k];

    if (has('mapName')) setText(mapText, snap.mapName);
    if (has('x') || has('y')) setText(coordText, `${snap.x} , ${snap.y}`);

    if (has('hp') || has('maxHp') || has('hpPct')) {
      applyOrb('hp', snap.hpPct, snap.hp, snap.maxHp);
    }
    if (has('mp') || has('maxMp') || has('mpPct')) {
      applyOrb('mp', snap.mpPct, snap.mp, snap.maxMp);
    }

    if (has('expPct')) setStyle(expFill, 'width', `${(snap.expPct * 100).toFixed(1)}%`);
    if (has('expPct') || has('level') || has('exp')) {
      setText(expText, `CẤP ${snap.level} · ${fmtNum(snap.exp)} / ${fmtNum(snap.expTo)}`);
    }

    /* Zen, khiên (SD) và thể lực (AG) không còn vẽ ở HUD nữa — cụm góc trái
       trên đã bỏ. Zen xem ở chân panel HÀNH TRANG, SD/AG ở panel NHÂN VẬT. */

    if (has('points')) {
      const b = gemNodes.get('hero');
      if (b) setText(b.badge, snap.points > 0 ? String(snap.points) : '');
    }

    // Nền radar đổi theo bản đồ; chỉ nạp lại khi thật sự sang map khác.
    if (has('worldIndex')) {
      const want = snap.worldIndex;
      Promise.resolve(resolveBg(terrainMapPath(want))).then(url => {
        setStyle(miniLand, 'backgroundImage', `url("${url}")`);
      });
    }

    // Toạ độ MU chạy 0..255 trên mỗi trục; quy về phần trăm của minimap.
    if (has('x') || has('y')) {
      setStyle(miniSelf, 'left', `${((snap.x / 255) * 100).toFixed(1)}%`);
      setStyle(miniSelf, 'top', `${((snap.y / 255) * 100).toFixed(1)}%`);
    }

    if (has('action') || has('selectedSkill') || has('invSig')) {
      const inv = bridge.readInventory();
      slotNodes.forEach((sn, i) => {
        if (!sn.def || sn.def.group == null) return;
        // Số lượng lấy từ túi đồ thật: đếm mọi ô cùng mã vật phẩm.
        const n = inv.bag.filter(
          x => x && x.group === sn.def.group && x.num === sn.def.num
        ).length;
        setText(sn.count, n > 1 ? String(n) : '');
        setClass(sn.node, 'ae-skill--selected', snap.selectedSkill === i);
      });
    }
  }

  return {
    root,
    update,
    pushLog,
    popFloat,
    flash,
    /** Tên nhân vật. Chip góc trái trên đã bỏ nên chỉ ghi vào nhật ký. */
    setHero(name) {
      pushLog(`Nhân vật: ${name}`, 'sys');
    },
    setPanelActive(id, on) {
      const g = gemNodes.get(id);
      if (g) setClass(g.gem, 'ae-gem--on', on);
    },
    show(on) {
      root.hidden = !on;
    },
  };
}
