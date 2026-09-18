// Năm panel của cột gem. Mọi số liệu đọc từ Store thật; chỗ nào engine offline
// không có dữ liệu thì nói thẳng trong giao diện thay vì bịa số.

import { el, setText, setStyle, setClass, onTap, clear } from './dom.js';
import { fmtNum, CAMERA_VIEWS, RENDER_SCALES, GFX_DEFAULT, GFX_FX } from '../store-bridge.js';
import {
  EQUIP_SLOTS,
  EQUIP_ART,
  EQUIP_BOXES,
  INV,
  WARP_POINTS,
  ACTION_KEYS,
  itemIconPath,
  itemTier,
  terrainMapPath,
  HEROES,
} from '../game-data.js';
import { itemSize, itemName } from '../item-data.js';
import { DBG } from '../debug.js';

/** Ô chứa dùng chung cho trang bị, túi đồ và ô kỹ năng. */
function slotNode({ tappable = false, onTapSlot = null, title = '' } = {}) {
  const icon = el('img.ae-slot__icon', { alt: '', draggable: 'false', hidden: true });
  const glyph = el('span.ae-slot__glyph');
  const count = el('span.ae-slot__count');
  const node = el(
    `div.ae-slot${tappable ? '.ae-slot--tappable.tappable' : ''}`,
    { title },
    [icon, glyph, count]
  );
  if (tappable && onTapSlot) onTap(node, () => onTapSlot(node));
  return { node, icon, glyph, count };
}

/** Đổ một vật phẩm vào ô, hoặc làm trống ô. */
function fillSlot(slot, item, resolve) {
  if (!item) {
    slot.icon.hidden = true;
    slot.icon.removeAttribute('src');
    setText(slot.glyph, '');
    setText(slot.count, '');
    setClass(slot.node, 'ae-slot--empty', true);
    setClass(slot.node, 'ae-slot--excellent', false);
    slot.node.title = slot.node.dataset.baseTitle || '';
    return;
  }
  slot.icon.src = resolve(itemIconPath(item));
  slot.icon.hidden = false;
  setText(slot.glyph, '');
  setText(slot.count, item.lvl ? `+${item.lvl}` : '');
  setClass(slot.node, 'ae-slot--empty', false);
  setClass(slot.node, 'ae-slot--excellent', !!item.isExcellent);
  const base = slot.node.dataset.baseTitle || '';
  slot.node.title =
    `${base}${base ? ' · ' : ''}nhóm ${item.group} · số ${item.num}` +
    (item.lvl ? ` · +${item.lvl}` : '') +
    (item.isExcellent ? ' · Xuất sắc' : '');
}

/**
 * Bảng chú giải một món đồ, dựng theo nếp MU: dòng tên tô màu theo hạng, rồi
 * các dòng chỉ số, rồi yêu cầu, rồi ngọc khảm.
 *
 * MỌI CON SỐ ĐỀU LẤY TỪ ENGINE qua bridge.describeItem — cùng hàm mà lúc đánh
 * nhau dùng để tính sát thương và phòng thủ (src/offline/itemStats.ts), nên
 * không có chuyện bảng ghi một đằng đánh ra một nẻo.
 */
function createTip(bridge) {
  const node = el('div.ae-tip', { hidden: true });

  function dong(nhan, giatri, lop = '') {
    return el(`div.ae-tip__row${lop}`, null, [
      el('span.ae-tip__k', { text: nhan }),
      el('span.ae-tip__v', { text: String(giatri) }),
    ]);
  }

  /** Một dòng kiểu MU: "Nhãn: giá trị" viết liền, canh trái. */
  function cau(nhan, giatri) {
    return el('div.ae-tip__line', null, [
      el('span.ae-tip__lk', { text: `${nhan}: ` }),
      el('span.ae-tip__lv', { text: String(giatri) }),
    ]);
  }

  function show(item, anchor) {
    const d = bridge.describeItem(item);
    if (!d) return;

    clear(node);
    node.dataset.rank = d.rank;

    node.append(
      el('div.ae-tip__name', {
        text: d.name + (d.lvl ? ` +${d.lvl}` : ''),
        dataset: { rank: d.rank },
      })
    );

    /* Bố cục theo đúng bảng thông tin MU: mỗi dòng là "Nhãn: giá trị" viết
       liền, canh trái — KHÔNG phải nhãn bên trái giá trị bên phải.
       Thứ tự khối cũng theo bản gốc: chỉ số cơ bản → giới hạn lớp nhân vật →
       phép thuật → tuỳ chọn Xuất sắc. */
    const cb = [];
    if (d.dmgMax > 0) {
      cb.push(cau('Lực tấn công một tay', `${d.dmgMin} ÷ ${d.dmgMax}`));
    }
    if (d.def > 0) cb.push(cau('Phòng thủ', d.def));
    if (d.defRate > 0) cb.push(cau('Tỉ lệ phòng thủ', d.defRate));
    if (d.speed > 0) cb.push(cau('Tốc độ', d.speed));
    if (d.dur > 0) cb.push(cau('Độ bền', `[${d.dur} / ${d.dur}]`));
    /* Thuốc: cột Valor trong bảng gốc là lượng hồi (Táo 5 · nhỏ 10 · vừa 20 ·
       lớn 30). Nhóm 14 gồm cả bình máu lẫn bình mana nên đổi chữ theo số món:
       0–4 là máu, 5 trở lên là mana — đúng thứ tự trong Item.txt. */
    if (d.heal > 0) {
      cb.push(cau(d.num >= 5 ? 'Hồi Mana' : 'Hồi Sinh lực', d.heal));
    }
    if (d.reqLvl > 0) cb.push(cau('Cấp độ tối thiểu để sử dụng', d.reqLvl));
    if (d.req.str > 0) cb.push(cau('Sức mạnh tối thiểu để sử dụng', d.req.str));
    if (d.req.agi > 0) cb.push(cau('Nhanh nhẹn tối thiểu để sử dụng', d.req.agi));
    if (d.req.ene > 0) cb.push(cau('Năng lượng tối thiểu để sử dụng', d.req.ene));
    if (d.req.vit > 0) cb.push(cau('Thể lực tối thiểu để sử dụng', d.req.vit));
    if (d.atkRate > 0) cb.push(cau('Tỉ lệ đánh trúng', `+${d.atkRate}`));
    if (d.hp > 0) cb.push(cau('Sinh lực', `+${d.hp}`));
    cb.push(cau('Kích thước', `${d.size.x} × ${d.size.y} ô`));
    node.append(el('div.ae-tip__block', null, cb));

    // Giới hạn lớp nhân vật — màu vàng, một dòng mỗi lớp, y như bản gốc.
    if (d.classes?.length) {
      node.append(
        el(
          'div.ae-tip__block.ae-tip__block--class',
          null,
          d.classes.map(c => el('div.ae-tip__cls', { text: `Chỉ dùng cho ${c}` }))
        )
      );
    }

    // Dòng phép thuật của gậy — màu lục, đứng riêng một khối như ảnh gốc.
    if (d.magicPwr > 0) {
      node.append(
        el('div.ae-tip__block.ae-tip__block--magic', null, [
          el('div.ae-tip__magic', { text: `Tăng ${d.magicPwr}% phép thuật` }),
        ])
      );
    }

    /* Khối XUẤT SẮC, xếp như bảng thông tin MU: một dòng tiêu đề màu lục rồi
       các dòng tuỳ chọn màu lam nhạt, mỗi dòng một tác động THẬT — xem bảng
       trong src/offline/excellent.ts. Không có dòng nào chỉ để trưng bày. */
    if (d.excLines?.length) {
      node.append(
        el('div.ae-tip__block.ae-tip__block--exc', null, [
          el('div.ae-tip__exchead', { text: 'ĐỒ XUẤT SẮC' }),
          ...d.excLines.map(t => el('div.ae-tip__excrow', { text: t })),
        ])
      );
    }

    if (d.sockets.length) {
      /* Mỗi lỗ một dòng, đầu dòng là chấm màu theo hệ ngọc — đúng cách MU vẽ
         đồ khảm: Hoả đỏ cam, Thuỷ lam, Băng xanh băng, Phong lục, Lôi tím. */
      const dongNgoc = (s, i) => {
        const cham = el('span.ae-tip__gem');
        if (s) cham.style.setProperty('--gem', s.color);
        else cham.classList.add('ae-tip__gem--empty');
        const nhan = el('span.ae-tip__k', { text: s ? s.vi : `Lỗ ${i + 1}` });
        const gt = el('span.ae-tip__v', {
          text: s
            ? [
                s.dmg ? `+${s.dmg} sát thương` : '',
                s.def ? `+${s.def} phòng thủ` : '',
                s.atkRate ? `+${s.atkRate} đánh trúng` : '',
                s.hp ? `+${s.hp} sinh lực` : '',
              ]
                .filter(Boolean)
                .join(' · ')
            : 'trống',
        });
        if (s) gt.style.color = s.color;
        return el(`div.ae-tip__row${s ? '' : '.ae-tip__row--empty'}`, null, [
          cham,
          nhan,
          gt,
        ]);
      };

      node.append(
        el('div.ae-tip__block.ae-tip__block--socket', null, [
          el('div.ae-tip__head', { text: `NGỌC KHẢM · ${d.sockets.length} lỗ` }),
          ...d.sockets.map(dongNgoc),
        ])
      );
    }

    const co2 = [];
    if (d.isExcellent) co2.push('Xuất sắc');
    if (d.isDivine) co2.push('Đồ Thần');
    if (co2.length) {
      node.append(el('div.ae-tip__tag', { text: co2.join(' · ') }));
    }

    node.hidden = false;

    // Đặt cạnh món, kẹp trong màn hình.
    const a = anchor.getBoundingClientRect();
    const t = node.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = a.right + 6;
    if (x + t.width > vw - 4) x = a.left - t.width - 6;
    if (x < 4) x = 4;
    let y = a.top;
    if (y + t.height > vh - 4) y = vh - t.height - 4;
    if (y < 4) y = 4;
    node.style.left = `${Math.round(x)}px`;
    node.style.top = `${Math.round(y)}px`;
  }

  function hide() {
    node.hidden = true;
  }

  return { node, show, hide };
}

export function createPanels({ bridge, resolve, resolveBg, onClose, onQuit }) {
  const tip = createTip(bridge);
  document.body.append(tip.node);

  /* Cờ "đang nhấc món lên". Chú giải và thao tác kéo nằm ở hai tầng khác
     nhau — ganChuGiai() ở đây, còn biến drag nằm trong IIFE invView bên dưới
     nên không với tới nhau được. Thiếu cờ này thì:

       nhấc món  → pointerenter đã hiện chú giải từ trước
       kéo đi    → nút gốc bị vẽ lại, pointerleave KHÔNG BAO GIỜ bắn
       thả ra    → chú giải dính lại giữa màn hình, neo vào một nút đã biến mất

     Đo thật trước khi sửa: bảng "Sword of Archangel +15" còn nguyên ở cả bốn
     nhịp nhấc / kéo / thả / sau 1,2 giây. */
  let dangKeo = false;
  const datDangKeo = v => {
    dangKeo = v;
    if (v) tip.hide();
  };

  /** Mở khoá chú giải ở động tác kế tiếp — xem chú thích trong keoXong(). */
  function moKhoaChuGiaiSau() {
    const mo = () => {
      document.removeEventListener('pointermove', mo);
      document.removeEventListener('pointerdown', mo);
      dangKeo = false;
    };
    document.addEventListener('pointermove', mo);
    document.addEventListener('pointerdown', mo);
  }

  /**
   * Gắn bảng chú giải cho một nút món đồ.
   * Chuột thì rê vào là hiện; cảm ứng thì GIỮ 350 ms mới hiện, để không cướp
   * mất thao tác kéo thả.
   */
  function ganChuGiai(node, getItem) {
    let hen = 0;
    node.addEventListener('pointerenter', ev => {
      if (dangKeo) return;
      if (ev.pointerType === 'mouse') tip.show(getItem(), node);
    });
    node.addEventListener('pointerleave', () => {
      clearTimeout(hen);
      tip.hide();
    });
    node.addEventListener('pointerdown', ev => {
      if (ev.pointerType === 'mouse') return;
      clearTimeout(hen);
      hen = setTimeout(() => {
        if (dangKeo) return;
        tip.show(getItem(), node);
      }, 350);
    });
    const thoi = () => {
      clearTimeout(hen);
      tip.hide();
    };
    node.addEventListener('pointerup', thoi);
    node.addEventListener('pointercancel', thoi);
    node.addEventListener('pointermove', ev => {
      // Trượt đi là đang kéo, không phải giữ để xem.
      if (ev.pointerType !== 'mouse') thoi();
    });
  }

  const title = el('span.ae-titlebar__text');
  const closeBtn = el('span.ae-titlebar__close.tappable', { text: '✕' });
  const body = el('div.ae-modal__body');

  const panel = el('div.ae-modal__panel.ae-frame.ae-frame--modal', null, [
    el('div.ae-frame__body', null, [
      el('div.ae-titlebar.ae-titlebar--modal', null, [title, closeBtn]),
      body,
    ]),
  ]);

  const root = el('div.ae-modal', { hidden: true }, [panel]);

  onTap(closeBtn, () => onClose());
  root.addEventListener('pointerup', e => {
    if (e.target === root) onClose();
  });
  panel.addEventListener('pointerup', e => e.stopPropagation());

  /* ------------------------------------------------------- NHÂN VẬT
     Dựng theo bảng nhân vật của MU: đầu bảng là lớp — tên — cấp, rồi thanh
     kinh nghiệm, rồi BỐN chỉ số gốc mỗi dòng một nút cộng, cuối cùng là khối
     số dẫn xuất (sát thương, phòng thủ, tỉ lệ đánh trúng, sinh lực, mana).

     Bảng màu giữ trong sắc đá – giấy cũ – đồng: chỉ số không tô mỗi thứ một
     màu nữa (trước đây đỏ/lục/lam/tím), vì bốn màu rực cạnh nhau trên nền gỗ
     nhìn rối. Chỉ nút cộng khi còn điểm là sáng lên màu vàng đồng. */
  const heroView = (() => {
    const portrait = el('div.ae-charhead__portrait');
    const name = el('div.ae-charhead__name');
    const role = el('div.ae-charhead__role');
    const points = el('div.ae-charhead__points');

    const expFill = el('div.ae-meter__fill');
    const expText = el('span.ae-stat__value');

    /* Bốn chỉ số gốc. Cột "mod" ghi chỉ số ấy ảnh hưởng tới cái gì — đúng theo
       công thức trong src/offline/combatFormulas.ts bên engine, không phải mô
       tả cho vui. */
    const statDefs = [
      { key: 'str', label: 'SỨC MẠNH', mod: 'sát thương' },
      { key: 'agi', label: 'NHANH NHẸN', mod: 'phòng thủ · tỉ lệ đánh trúng' },
      { key: 'sta', label: 'THỂ LỰC', mod: 'sinh lực tối đa' },
      { key: 'eng', label: 'NĂNG LƯỢNG', mod: 'mana tối đa' },
    ];

    const rows = statDefs.map(def => {
      const value = el('span.ae-stat__value');
      const plus = el('button.ae-stat__plus', { text: '+', title: `Cộng ${def.label}` });
      plus.addEventListener('click', () => {
        if (!bridge.spendPoint(def.key)) {
          bridge.notify('Không còn điểm cộng', 'error');
          return;
        }
        update(bridge.snapshot());
      });
      const node = el('div.ae-stat.ae-stat--mu', null, [
        el('div.ae-stat__head', null, [
          el('span.ae-stat__label', { text: def.label }),
          value,
          plus,
        ]),
        el('div.ae-stat__mod', { text: def.mod }),
      ]);
      return { def, node, value, plus };
    });

    /* Năm số dẫn xuất. Giá trị lấy từ chính hàm engine dùng lúc tính sát
       thương (bridge đọc window.__combat), nên bảng này không bao giờ lệch với
       con số thật lúc đánh nhau. */
    const derDefs = [
      { key: 'dmg', label: 'SÁT THƯƠNG' },
      { key: 'def', label: 'PHÒNG THỦ' },
      { key: 'atkRate', label: 'TỈ LỆ ĐÁNH TRÚNG' },
      { key: 'hp', label: 'SINH LỰC' },
      { key: 'mp', label: 'MANA' },
    ];
    const derRows = derDefs.map(d => {
      const v = el('span.ae-der__value');
      return {
        d,
        v,
        node: el('div.ae-der__row', null, [
          el('span.ae-der__label', { text: d.label }),
          v,
        ]),
      };
    });

    const node = el('div.ae-hero', null, [
      el('div.ae-charhead', null, [
        portrait,
        el('div.ae-charhead__text', null, [name, role, points]),
      ]),
      el('div.ae-stat.ae-stat--exp', null, [
        el('div.ae-stat__head', null, [
          el('span.ae-stat__label', { text: 'KINH NGHIỆM' }),
          expText,
        ]),
        el('div.ae-meter.ae-meter--gold', null, [expFill]),
      ]),
      el('div.ae-stats', null, rows.map(r => r.node)),
      el('div.ae-der', null, [
        el('div.ae-der__title', { text: 'CHỈ SỐ CHIẾN ĐẤU' }),
        ...derRows.map(r => r.node),
      ]),
    ]);

    function update(snap) {
      const hero = HEROES.find(h => h.cls === snap.charClass) || HEROES[0];
      setText(portrait, hero.glyph);
      setText(name, hero.name);
      setText(role, `${hero.role} · CẤP ${snap.level}`);

      const conDiem = snap.points > 0;
      points.innerHTML = '';
      points.append('Điểm cộng: ', el('b', { text: String(snap.points) }));
      setClass(points, 'ae-charhead__points--has', conDiem);

      setText(expText, `${fmtNum(snap.exp)} / ${fmtNum(snap.expTo)}`);
      setStyle(expFill, 'width', `${(snap.expPct * 100).toFixed(1)}%`);

      for (const r of rows) {
        setText(r.value, fmtNum(snap[r.def.key]));
        // Hết điểm thì nút mờ đi và không bấm được, không giấu hẳn — giấu thì
        // mỗi lần lên cấp bảng lại nhảy chỗ.
        r.plus.disabled = !conDiem;
        setClass(r.plus, 'ae-stat__plus--on', conDiem);
      }

      const val = {
        dmg: `${fmtNum(snap.dmgMin)} – ${fmtNum(snap.dmgMax)}`,
        def: fmtNum(snap.def),
        atkRate: fmtNum(snap.atkRate),
        hp: `${fmtNum(snap.hp)} / ${fmtNum(snap.maxHp)}`,
        mp: `${fmtNum(snap.mp)} / ${fmtNum(snap.maxMp)}`,
      };
      for (const r of derRows) setText(r.v, val[r.d.key]);
    }

    return { node, update };
  })();

  // ------------------------------------------------------ HÀNH TRANG
  /* Cấu trúc MU giữ nguyên (12 ô trang bị + lưới 8×8 = 64 ô), cách thể hiện
     nâng theo quy ước ARPG hiện đại: món đồ trải đúng số ô nó chiếm, nền ô là
     kính mờ tô theo cấp cường hoá. */
  const invView = (() => {
    const COLS = INV.RowSize;
    const ROWS = INV.InventoryRows;
    const BAG_SIZE = COLS * ROWS;
    /* Engine đánh số 12 ô trang bị trước rồi mới tới 64 ô túi; giao diện đếm
       ô túi từ 0 nên mọi lần gọi sang engine phải cộng phần bù này. */
    const BAG_BASE = INV.LastEquippableItemSlotIndex + 1;

    const zen = el('span');
    const used = el('b');

    /** Một món đồ: ô kính tô theo bậc cường hoá + icon canvas gốc. */
    function itemNode(it, onTapItem) {
      const tier = itemTier(it.lvl);
      const rank = bridge.itemRank(it);
      /* Bậc PHÁT SÁNG của icon, đặt đúng theo các mốc trong shader cường hoá
         của engine (src/common/itemMaterial.ts): dưới +2 không đổi, +2–4 ánh
         đỏ, +5–6 ánh lam, +7–8 ánh vàng, +9 vàng đậm, +10 trở lên rực và chạy
         sáng. Nhờ vậy món trong hòm đồ đổi màu ĐÚNG như khi mặc lên người. */
      const lv = it.lvl ?? 0;
      const glow =
        lv < 2 ? '0' : lv < 5 ? 'red' : lv < 7 ? 'blue' : lv < 9 ? 'gold' : lv < 10 ? 'gold9' : 'max';
      const node = el(
        `div.ae-item${it.isExcellent ? '.ae-item--exc' : ''}${it.hasSkill ? '.ae-item--skill' : ''}`,
        {
          dataset: { tier: String(tier), rank, glow },
          title:
            `${itemName(it.group, it.num) || `nhóm ${it.group}/${it.num}`}` +
            (it.lvl ? ` +${it.lvl}` : '') +
            (it.isExcellent ? ' · Xuất sắc' : '') +
            (it.hasSkill ? ' · Có kỹ năng' : ''),
        },
        [
          el('img.ae-item__icon', {
            src: resolve(itemIconPath(it)),
            alt: '',
            draggable: 'false',
            // Không phải món nào cũng có icon riêng cho từng cấp cường hoá
            // (cánh chỉ có bản +0). Thiếu thì lùi về bản gốc, thử đúng một lần.
            onerror: ev => {
              const img = ev.currentTarget;
              if (img.dataset.fallback) return;
              img.dataset.fallback = '1';
              img.src = resolve(itemIconPath({ group: it.group, num: it.num }));
            },
          }),
          it.lvl ? el('span.ae-item__lvl', { text: `+${it.lvl}` }) : null,
          /* Dãy lỗ khảm ở mép dưới ô, giống cách MU đánh dấu đồ có lỗ: lỗ
             trống là chấm rỗng, lỗ đã khảm là chấm tô đúng màu hệ. */
          it.sockets?.length
            ? el(
                'span.ae-item__sockets',
                null,
                it.sockets.map(k => {
                  const kind = bridge.socketKinds()[k] ?? null;
                  const dot = el(`i.ae-item__gem${kind ? '' : '.ae-item__gem--empty'}`);
                  if (kind) dot.style.setProperty('--gem', kind.color);
                  return dot;
                })
              )
            : null,
        ]
      );
      if (onTapItem) onTap(node, onTapItem);
      ganChuGiai(node, () => it);
      return node;
    }

    // ---- khay trang bị: ảnh art + 12 ô phủ lên đúng vị trí đã đo
    const labelOf = new Map(EQUIP_SLOTS.map(s => [s.idx, s.label]));
    const dollSlots = new Map();
    const doll = el('div.ae-doll', null, [
      el('img.ae-doll__art', { src: EQUIP_ART.src, alt: '', draggable: 'false' }),
    ]);
    for (const box of EQUIP_BOXES) {
      if (box.idx === null) continue;   // ô hoạ tiết của art, không gắn dữ liệu
      const holder = el('div.ae-doll__slot', {
        style: { left: box.x, top: box.y, width: box.w, height: box.h },
        title: labelOf.get(box.idx) ?? '',
      });
      doll.append(holder);
      dollSlots.set(box.idx, { holder });
    }

    /* Hai ô THÔNG TIN đặt vào khoảng trống dưới ô quần trên tấm art.
       Toạ độ suy từ chính EQUIP_BOXES: ô quần kết thúc ở y 75,5%, ô Thú cưng
       chiếm x 3,1–21,6% và ô hoạ tiết góc phải bắt đầu từ x 80,2% — nên dải
       x 25–76%, y 79–97% là chỗ trống thật, không đè lên ô nào.

       Đây là ô ĐỌC, không phải ô mặc đồ: một bên gom mọi viên ngọc đang khảm
       trên người, một bên cho biết đang mặc bộ nào và được thưởng bao nhiêu. */
    const socketBox = el('div.ae-optbox.ae-optbox--socket', {
      style: { left: '25.586%', top: '79.2%', width: '24.5%', height: '18.3%' },
    });
    const setBox = el('div.ae-optbox.ae-optbox--set', {
      style: { left: '51.5%', top: '79.2%', width: '24.5%', height: '18.3%' },
    });
    const socketHead = el('div.ae-optbox__head', { text: 'TUỲ CHỌN NGỌC' });
    const socketBody = el('div.ae-optbox__body');
    const setHead = el('div.ae-optbox__head', { text: 'TUỲ CHỌN BỘ' });
    const setBody = el('div.ae-optbox__body');
    socketBox.append(socketHead, socketBody);
    setBox.append(setHead, setBody);
    doll.append(socketBox, setBox);

    /** Vẽ lại hai ô thông tin từ đồ đang mặc. */
    function veTuyChon(equip) {
      clear(socketBody);
      const gom = new Map();
      for (const it of equip) {
        for (const k of bridge.describeItem(it)?.sockets ?? []) {
          if (!k) continue;
          gom.set(k.vi, (gom.get(k.vi) ?? 0) + 1);
        }
      }
      if (gom.size === 0) {
        socketBody.append(el('div.ae-optbox__none', { text: 'chưa khảm' }));
      } else {
        for (const [ten, n] of gom) {
          socketBody.append(
            el('div.ae-optbox__line', { text: n > 1 ? `${ten} ×${n}` : ten })
          );
        }
      }

      clear(setBody);
      const bo = bridge.gearSet();
      if (!bo || bo.count < 2) {
        setBody.append(el('div.ae-optbox__none', { text: 'chưa đủ bộ' }));
      } else {
        setBody.append(el('div.ae-optbox__line', { text: `${bo.name} ${bo.count}/5` }));
        if (bo.defPct > 0) {
          setBody.append(
            el('div.ae-optbox__line.ae-optbox__line--on', {
              text: `+${Math.round(bo.defPct * 100)}% phòng thủ`,
            })
          );
        }
        if (bo.atkRate > 0) {
          setBody.append(
            el('div.ae-optbox__line.ae-optbox__line--on', {
              text: `+${bo.atkRate} đánh trúng`,
            })
          );
        }
      }
    }

    // ---- túi đồ: nền 64 ô + lớp món đồ phủ lên
    const bagGrid = el('div.ae-bag__grid');
    const bagCells = [];
    for (let i = 0; i < BAG_SIZE; i++) {
      const c = el('div.ae-cell', { dataset: { slot: String(i) } });
      bagCells.push(c);
      bagGrid.append(c);
    }
    const bagItems = el('div.ae-bag__items');
    const marker = el('div.ae-bag__marker', { hidden: true });
    bagItems.append(marker);
    const bag = el('div.ae-bag', null, [bagGrid, bagItems]);

    /* ---------------------------------------------------------------------
       KÉO THẢ SẮP XẾP TÚI

       Dùng Pointer Events + setPointerCapture nên một mã chạy cho cả chuột lẫn
       ngón tay. Ô đồ đặt touch-action:none trong CSS — thiếu dòng đó thì Safari
       coi cú trượt là cuộn trang và nuốt mất thao tác kéo, đây chính là chỗ
       "bị canvas cản" trước đây.

       Chỉ sắp xếp TRONG TÚI. Kéo vào ô trang bị thì phải biết loại món nào hợp
       ô nào, engine offline không phơi bảng đó ra, đoán bừa là hỏng dữ liệu.
       --------------------------------------------------------------------- */

    let drag = null;
    let bagCache = [];

    /** Bước lưới thật, đọc từ khoảng cách grid nên không lệch khi đổi cỡ ô. */
    function bagGeom() {
      const r = bagGrid.getBoundingClientRect();
      const cs = getComputedStyle(bagGrid);
      const gx = parseFloat(cs.columnGap) || 0;
      const gy = parseFloat(cs.rowGap) || 0;
      return {
        r,
        px: (r.width - gx * (COLS - 1)) / COLS + gx,
        py: (r.height - gy * (ROWS - 1)) / ROWS + gy,
      };
    }

    /**
     * Bản đồ ô bị chiếm. Engine chỉ lưu món ở ô GỐC, những ô còn lại trong
     * hình dáng món không có gì — nên phải tự trải ra mới biết chỗ nào trống.
     */
    function occupancy(arr, boQua = -1) {
      const occ = new Array(BAG_SIZE).fill(-1);
      arr.forEach((it, i) => {
        if (!it || i === boQua) return;
        const s = itemSize(it.group, it.num);
        const c0 = i % COLS;
        const r0 = (i / COLS) | 0;
        for (let y = 0; y < s.y; y++) {
          for (let x = 0; x < s.x; x++) {
            const c = c0 + x;
            const r = r0 + y;
            if (c < COLS && r < ROWS) occ[r * COLS + c] = i;
          }
        }
      });
      return occ;
    }

    function datDuoc(occ, col, row, size) {
      if (col < 0 || row < 0) return false;
      if (col + size.x > COLS || row + size.y > ROWS) return false;
      for (let y = 0; y < size.y; y++) {
        for (let x = 0; x < size.x; x++) {
          if (occ[(row + y) * COLS + col + x] !== -1) return false;
        }
      }
      return true;
    }

    /** Ô trang bị nằm dưới con trỏ, nếu có và nếu món kéo mặc vào đó được. */
    function oTrangBiDuoi(ev, item) {
      const ok = bridge.equipSlotsFor(item);
      if (ok.length === 0) return -1;
      for (const [idx, ref] of dollSlots) {
        if (!ok.includes(idx)) continue;
        const r = ref.holder.getBoundingClientRect();
        if (
          ev.clientX >= r.left &&
          ev.clientX <= r.right &&
          ev.clientY >= r.top &&
          ev.clientY <= r.bottom
        ) {
          return idx;
        }
      }
      return -1;
    }

    function veOTrangBi() {
      for (const [idx, ref] of dollSlots) {
        setClass(ref.holder, 'ae-doll__slot--drop', drag?.equipTo === idx);
      }
    }

    function veDauDich() {
      veOTrangBi();
      if (!drag || drag.equipTo >= 0 || drag.col < 0) {
        marker.hidden = true;
        return;
      }
      marker.hidden = false;
      setClass(marker, 'ae-bag__marker--no', !drag.ok);
      Object.assign(marker.style, {
        gridColumn: `${drag.col + 1} / span ${drag.size.x}`,
        gridRow: `${drag.row + 1} / span ${drag.size.y}`,
      });
    }

    function keoTiep(ev) {
      if (!drag) return;
      drag.ghost.style.transform =
        `translate(${ev.clientX - drag.dx}px, ${ev.clientY - drag.dy}px)`;

      // Ưu tiên ô trang bị: đang lơ lửng trên một ô mặc được thì thả xuống là
      // mặc, không phải dời trong túi.
      drag.equipTo = oTrangBiDuoi(ev, drag.item);

      const g = bagGeom();
      const col = Math.floor((ev.clientX - g.r.left) / g.px) - drag.grabX;
      const row = Math.floor((ev.clientY - g.r.top) / g.py) - drag.grabY;
      drag.col = col;
      drag.row = row;
      drag.ok = drag.equipTo < 0 && datDuoc(drag.occ, col, row, drag.size);
      veDauDich();
    }

    function keoXong(ev) {
      if (!drag) return;
      const { from, fromEquip, col, row, ok, equipTo, node, ghost } = drag;
      try {
        node.releasePointerCapture(ev.pointerId);
      } catch {
        /* con trỏ đã mất, bỏ qua */
      }
      ghost.remove();
      node.classList.remove('ae-item--dragging');
      marker.hidden = true;
      drag = null;
      /* Thả xong KHÔNG mở khoá ngay. Món vừa thả được vẽ lại đúng dưới con
         trỏ, nên pointerenter của nút mới bắn liền và bảng chữ lại bung ra
         giữa lúc người chơi còn chưa kịp nhả tay — đo được ở nhịp [3] và [4].

         Mở khoá ở động tác KẾ TIẾP thay vì theo đồng hồ: rê chuột đi (chuột)
         hoặc chạm lần sau (cảm ứng). Phải nghe cả hai, vì trên cảm ứng nhấn
         giữ không sinh pointermove nào — chỉ nghe move thì chú giải nhấn giữ
         chết luôn. */
      tip.hide();
      moKhoaChuGiaiSau();
      veOTrangBi();

      // Thả lên một ô trang bị → mặc vào. Engine kiểm loại món và cấp yêu cầu.
      if (equipTo >= 0) {
        const nguon = fromEquip ? from : BAG_BASE + from;
        const loi = bridge.moveItem(nguon, equipTo);
        if (loi) bridge.notify(loi, 'error');
        update.refreshAll();
        return;
      }

      // Kéo từ ô trang bị xuống túi → cởi ra.
      if (fromEquip) {
        if (ok) {
          const loi = bridge.moveItem(from, BAG_BASE + row * COLS + col);
          if (loi) bridge.notify(loi, 'error');
        }
        update.refreshAll();
        return;
      }

      if (ok) {
        const to = row * COLS + col;
        if (bridge.moveBagItem(from, to)) {
          update.refreshBag();
          return;
        }
      }
      veDauDich();
    }

    /**
     * Cho một nút món đồ kéo được.
     * `from` là chỉ số Ô TÚI khi fromEquip = false, còn khi fromEquip = true
     * thì là chỉ số slot trang bị (0…11) của engine.
     */
    function ganKeo(node, from, size, item, fromEquip = false) {
      node.addEventListener('pointerdown', ev => {
        if (drag || ev.button > 0) return;
        const g = bagGeom();
        const nr = node.getBoundingClientRect();
        const ghost = node.cloneNode(true);
        ghost.classList.add('ae-item--ghost');
        Object.assign(ghost.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          gridColumn: '',
          gridRow: '',
          width: `${nr.width}px`,
          height: `${nr.height}px`,
        });
        document.body.append(ghost);
        node.classList.add('ae-item--dragging');
        /* Tắt chú giải NGAY khi nhấc, và chặn nó bật lại suốt lúc kéo. Rê qua
           ô khác trong lúc kéo vẫn bắn pointerenter, không chặn thì mỗi ô đi
           qua lại bung một bảng chữ. */
        datDangKeo(true);

        drag = {
          from,
          fromEquip,
          item,
          size,
          node,
          ghost,
          equipTo: -1,
          occ: occupancy(bagCache, fromEquip ? -1 : from),
          grabX: Math.floor((ev.clientX - nr.left) / g.px),
          grabY: Math.floor((ev.clientY - nr.top) / g.py),
          dx: ev.clientX - nr.left,
          dy: ev.clientY - nr.top,
          col: -1,
          row: -1,
          ok: false,
        };
        node.setPointerCapture(ev.pointerId);
        keoTiep(ev);
      });

      node.addEventListener('pointermove', keoTiep);
      node.addEventListener('pointerup', keoXong);
      node.addEventListener('pointercancel', keoXong);
    }

    /* ------------------------------------------------------- XƯỞNG RÈN
       Chạm một món (trong túi hoặc đang mặc) là chọn nó; hàng dưới hiện giá và
       tỉ lệ thành công của lần cường hoá kế tiếp, nút mở lỗ khảm, và năm viên
       ngọc để khảm vào lỗ trống đầu tiên.

       Mọi phép tính và mọi lần trừ tiền đều nằm trong engine
       (src/offline/itemActions.ts); ở đây chỉ gọi sang rồi vẽ lại. Cường hoá
       xong là mô hình 3D tự sáng lên theo cấp — shader itemMaterial của engine
       vốn đã đọc mesh.metadata.itemLvl, phần này chỉ cần đổi đúng dữ liệu. */
    let chonSlot = -1;

    const forgeName = el('div.ae-forge__name', { text: 'Chạm một món để chọn' });
    const forgeUp = el('button.ae-forge__btn', { text: 'CƯỜNG HOÁ' });
    const forgeOpen = el('button.ae-forge__btn', { text: 'MỞ LỖ' });
    const forgeHint = el('div.ae-forge__hint');
    const forgeGems = el('div.ae-forge__gems');

    /* Lò rèn tách thành panel mini bật lên khi chạm một món, thay vì chiếm
       một hàng cố định giữa khay trang bị và túi đồ. Hàng cố định đó cao 40px
       và chính nó làm nội dung panel vượt khung 35px, sinh ra thanh cuộn —
       cuộn thì khay trang bị trôi lên bị thanh tiêu đề cắt ngang. Bỏ hàng đó
       đi là panel vừa khít, không còn cuộn, tiêu đề hết bị cắt. */
    const forgeX = el('button.ae-forge__x', { type: 'button', text: '✕' });
    const forge = el('div.ae-forge.ae-forge--mini', { hidden: true }, [
      el('div.ae-forge__top', null, [forgeName, forgeUp, forgeOpen, forgeX]),
      forgeHint,
      forgeGems,
    ]);
    const forgeScrim = el('div.ae-forge__scrim', { hidden: true });

    function dongLoRen() {
      chonSlot = -1;
      veXuong();
    }
    onTap(forgeX, dongLoRen);
    onTap(forgeScrim, dongLoRen);

    function monDangChon() {
      if (chonSlot < 0) return null;
      const items = bridge.readInventory();
      return chonSlot < BAG_BASE
        ? items.equip[chonSlot] ?? null
        : items.bag[chonSlot - BAG_BASE] ?? null;
    }

    function chonMon(slot, it) {
      chonSlot = slot;
      veXuong();
      const d = bridge.describeItem(it);
      if (d) bridge.notify(`${d.name}${d.lvl ? ` +${d.lvl}` : ''}`);
    }

    function veXuong() {
      const it = monDangChon();
      clear(forgeGems);

      if (!it) {
        setText(forgeName, 'Chạm một món để chọn');
        setText(forgeHint, '');
        forgeUp.disabled = true;
        forgeOpen.disabled = true;
        setClass(forge, 'ae-forge--on', false);
        forge.hidden = true;
        forgeScrim.hidden = true;
        return;
      }

      setClass(forge, 'ae-forge--on', true);
      forge.hidden = false;
      forgeScrim.hidden = false;
      const d = bridge.describeItem(it);
      setText(forgeName, `${d.name}${d.lvl ? ` +${d.lvl}` : ''}`);
      forgeName.dataset.rank = d.rank;

      const up = bridge.upgradeInfo(d.lvl);
      const sk = bridge.socketInfo(d.sockets.length);

      const het = d.lvl >= (up?.max ?? 15);
      forgeUp.disabled = het;
      forgeOpen.disabled = d.sockets.length >= (sk?.max ?? 5);

      setText(
        forgeHint,
        het
          ? `Đã đạt cấp cao nhất +${up.max}`
          : `Cường hoá +${d.lvl + 1}: ${fmtNum(up.cost)} Zen · ` +
              `${Math.round(up.chance * 100)}% thành công   |   ` +
              `Mở lỗ thứ ${d.sockets.length + 1}: ${fmtNum(sk.cost)} Zen`
      );

      // Năm viên ngọc, khảm vào lỗ TRỐNG đầu tiên.
      const trong = d.sockets.findIndex(x => !x);
      for (const k of bridge.socketKinds()) {
        const b = el('button.ae-forge__gem', {
          text: k.vi.replace('Ngọc ', ''),
          title:
            `${k.vi} — ` +
            [
              k.dmg ? `+${k.dmg} sát thương` : '',
              k.def ? `+${k.def} phòng thủ` : '',
              k.atkRate ? `+${k.atkRate} đánh trúng` : '',
              k.hp ? `+${k.hp} sinh lực` : '',
            ]
              .filter(Boolean)
              .join(' · '),
          dataset: { kind: String(k.id) },
        });
        b.style.setProperty('--gem', k.color);
        b.disabled = trong < 0;
        b.addEventListener('click', () => {
          const r = bridge.mountSocket(chonSlot, trong, k.id);
          bridge.notify(r.reason, r.ok ? 'info' : 'error');
          update.refreshAll();
        });
        forgeGems.append(b);
      }
    }

    forgeUp.addEventListener('click', () => {
      const r = bridge.upgradeItem(chonSlot);
      bridge.notify(r.reason, r.ok ? 'good' : 'error');
      update.refreshAll();
    });

    forgeOpen.addEventListener('click', () => {
      const r = bridge.openSocket(chonSlot);
      bridge.notify(r.reason, r.ok ? 'good' : 'error');
      update.refreshAll();
    });

    /* Ba tab túi. Engine chỉ có MỘT túi 64 ô (INV.RowSize × InventoryRows) nên
       tab 2 và 3 là chỗ mở rộng để dành: bấm vào thì lưới mờ đi và ghi rõ chưa
       mở, chứ không giả vờ có dữ liệu. */
    const TABS = [
      { id: 0, label: 'TÚI 1', open: true },
      { id: 1, label: 'TÚI 2', open: false },
      { id: 2, label: 'TÚI 3', open: false },
    ];
    let tabActive = 0;

    const lock = el('div.ae-bag__lock', { hidden: true, text: 'KHOANG NÀY CHƯA MỞ' });
    bag.append(lock);

    const tabNodes = TABS.map(t => {
      const n = el(
        `div.ae-invtab.tappable${t.open ? '' : '.ae-invtab--locked'}`,
        { text: t.open ? t.label : `${t.label} ✦` }
      );
      onTap(n, () => selectTab(t.id));
      return n;
    });

    function selectTab(id) {
      tabActive = id;
      tabNodes.forEach((n, i) => setClass(n, 'ae-invtab--on', i === id));
      const open = TABS[id].open;
      lock.hidden = open;
      setClass(bagItems, 'ae-bag__items--off', !open);
    }

    const tabs = el('div.ae-invtabs', null, tabNodes);

    /* Hàng chân theo đúng khay dưới của ảnh mẫu: chồng tiền, ô Zen, một ô đếm
       số ô đã dùng, một ô chờ. Gộp số ô vào đây thay vì thêm dòng riêng — thêm
       dòng là panel dài quá khung và hàng tiền bị đẩy trôi xuống dưới. */
    const node = el('div.ae-inv2', null, [
      doll,
      el('div.ae-inv__divider'),
      tabs,
      bag,
      el('div.ae-invfoot', null, [
        el('img.ae-invfoot__coin', { src: 'img/ui_coin.png', alt: '', draggable: 'false' }),
        el('div.ae-invfoot__field.ae-invfoot__field--zen', null, [zen]),
        el('div.ae-invfoot__field.ae-invfoot__field--use', null, [
          used,
          ` / ${BAG_SIZE}`,
        ]),
        el('div.ae-invfoot__field.ae-invfoot__field--ph', { text: 'Ô CHỜ' }),
      ]),
      // Hai thứ này nằm ngoài dòng chảy (absolute) nên không cộng vào chiều
      // cao panel — đó là điểm mấu chốt của việc tách ra.
      forgeScrim,
      forge,
    ]);

    selectTab(0);

    function update(snap) {
      setText(zen, fmtNum(snap.money));
      const { equip, bag: bagArr } = bridge.readInventory();

      // trang bị
      for (const [idx, ref] of dollSlots) {
        const it = equip[idx] ?? null;
        const old = ref.holder.querySelector('.ae-item');
        if (old) old.remove();
        setClass(ref.holder, 'has-item', !!it);
        if (!it) continue;
        const n = itemNode(it, () => chonMon(idx, it));
        // Thụt vào một chút để viền chạm khắc trên art vẫn lộ ra quanh món.
        Object.assign(n.style, { position: 'absolute', inset: '5%' });
        // Kéo món đang mặc xuống túi là cởi ra.
        ganKeo(n, idx, itemSize(it.group, it.num), it, true);
        ref.holder.append(n);
      }

      veTuyChon(equip);
      veXuong();

      // Đang kéo thì để yên, dựng lại lớp món giữa chừng là mất luôn nút đang
      // giữ con trỏ.
      if (!drag) drawBag(bagArr);
    }

    /** Dựng lại lớp món đồ; ô nền 64 ô giữ nguyên, chỉ thay lớp phủ. */
    function drawBag(bagArr) {
      bagCache = bagArr;
      for (const n of [...bagItems.querySelectorAll('.ae-item')]) n.remove();

      let count = 0;
      bagArr.forEach((it, i) => {
        if (!it) return;
        count++;
        const size = itemSize(it.group, it.num);
        const col = i % COLS;
        const row = (i / COLS) | 0;
        const n = itemNode(it, () => chonMon(BAG_BASE + i, it));
        Object.assign(n.style, {
          gridColumn: `${col + 1} / span ${Math.min(size.x, COLS - col)}`,
          gridRow: `${row + 1} / span ${Math.min(size.y, ROWS - row)}`,
        });
        ganKeo(n, i, size, it);
        bagItems.append(n);
      });
      setText(used, String(count));
    }

    update.refreshBag = () => drawBag(bridge.readInventory().bag);
    update.refreshAll = () => update(bridge.snapshot());

    return { node, update };
  })();

  // -------------------------------------------------------- KỸ NĂNG
  const skillView = (() => {
    const list = el('div.ae-skilllist');
    const rows = ACTION_KEYS.map((key, i) => {
      const icon = slotNode({ title: `Phím ${key.toUpperCase()}` });
      icon.node.classList.add('ae-skillrow__icon');
      const name = el('div.ae-skillrow__name');
      const desc = el('div.ae-skillrow__desc');
      const lvl = el('div.ae-skillrow__lvl', { text: key.toUpperCase() });
      const mp = el('div.ae-skillrow__mp');
      const node = el('div.ae-skillrow.tappable', null, [
        icon.node,
        el('div.ae-skillrow__main', null, [name, desc]),
        el('div.ae-skillrow__meta', null, [lvl, mp]),
      ]);
      onTap(node, () => bridge.selectSkill(i));
      list.append(node);
      return { node, icon, name, desc, mp };
    });

    const note = el('div.ae-inv__hint', {
      text:
        'Bốn ô này là thanh hành động thật của engine (Store.actionBar). ' +
        'Bản chơi đơn chưa có hệ sát thương nên không có hồi chiêu.',
    });

    const node = el('div', null, [list, note]);

    function update(snap) {
      snap.action.forEach((slot, i) => {
        const r = rows[i];
        const filled = slot.itemId > 0;
        setText(r.name, filled ? `Ô ${slot.key.toUpperCase()} · id ${slot.itemId}` : `Ô ${slot.key.toUpperCase()} trống`);
        setText(r.desc, filled ? 'Đã gán vật phẩm' : 'Chưa gán');
        setText(r.mp, filled && slot.count ? `x${slot.count}` : '');
        setClass(r.node, 'ae-skillrow--active', snap.selectedSkill === i);
        setClass(r.icon.node, 'ae-slot--empty', !filled);
      });
    }

    return { node, update };
  })();

  // ---------------------------------------------------- DỊCH CHUYỂN
  /* Bản đồ lớn + bảng chọn điểm đến.
     Nền bản đồ là TerrainLight.jpg của chính map đang đứng — ảnh nhìn từ trên
     xuống thật của engine, cùng lưới toạ độ 0…255 nên chấm người chơi đặt theo
     x/255, y/255 là khớp, không phải căn tay. */
  const warpView = (() => {
    const land = el('div.ae-bigmap__land');
    const self = el('div.ae-bigmap__self');
    const bigName = el('div.ae-bigmap__name');
    const bigCoord = el('div.ae-bigmap__coord');
    const bigmap = el('div.ae-bigmap', null, [
      land,
      el('div.ae-bigmap__grid'),
      self,
      el('div.ae-bigmap__cap', null, [bigName, bigCoord]),
    ]);

    const list = el('div.ae-warpgrid');
    const rows = WARP_POINTS.map(w => {
      const state = el('span.ae-warp__state');
      const node = el('div.ae-warp.tappable', null, [
        el('div.ae-warp__name', { text: w.vi }),
        el('div.ae-warp__meta', { text: `${w.name} · ${fmtNum(w.cost)} Zen` }),
        state,
      ]);
      onTap(node, () => {
        const snap = bridge.snapshot();
        if (snap.worldIndex === w.id) {
          bridge.notify(`Đang ở ${w.vi} rồi`);
          return;
        }
        if (snap.level < w.minLvl) {
          bridge.notify(`Cần cấp ${w.minLvl} để tới ${w.vi}`, 'error');
          return;
        }
        bridge.warp(w.id);
        onClose();
      });
      list.append(node);
      return { w, node, state };
    });

    const node = el('div.ae-warpview', null, [bigmap, list]);

    let lastWorld = -1;

    function update(snap) {
      if (snap.worldIndex !== lastWorld) {
        lastWorld = snap.worldIndex;
        // url() trong CSS không qua lớp chặn zip được, phải xin blob URL thật.
        Promise.resolve(resolveBg(terrainMapPath(snap.worldIndex))).then(u => {
          setStyle(land, 'backgroundImage', `url("${u}")`);
        });
      }
      setText(bigName, snap.mapName || '—');
      setText(bigCoord, `${snap.x} , ${snap.y}`);
      setStyle(self, 'left', `${((snap.x / 255) * 100).toFixed(2)}%`);
      setStyle(self, 'top', `${((snap.y / 255) * 100).toFixed(2)}%`);

      for (const r of rows) {
        const ok = snap.level >= r.w.minLvl;
        const here = snap.worldIndex === r.w.id;
        // Nơi đang đứng không tính là khoá, dù cấp chưa đủ — làm mờ nó đi thì
        // người chơi tưởng mình đang ở chỗ bị cấm.
        setClass(r.node, 'ae-warp--locked', !ok && !here);
        setClass(r.node, 'ae-warp--here', here);
        setText(r.state, here ? 'ĐANG Ở ĐÂY' : ok ? 'ĐI ›' : `CẦN CẤP ${r.w.minLvl}`);
      }
    }

    return { node, update };
  })();

  // ------------------------------------------------------ HỆ THỐNG
  const setView = (() => {
    const state = {
      music: true,
      sfx: true,
      labels: true,
      reduce: false,
      debug: DBG.on,
      ...GFX_DEFAULT.fx,
    };

    function toggleRow(key, label, apply) {
      const knob = el('span.ae-toggle__knob');
      const sw = el('span.ae-toggle__switch', null, [knob]);
      const node = el('div.ae-toggle.tappable', null, [
        el('span.ae-toggle__label', { text: label }),
        sw,
      ]);
      const sync = () => setClass(node, 'ae-toggle--on', state[key]);
      onTap(node, () => {
        state[key] = !state[key];
        sync();
        apply(state[key]);
      });
      sync();
      return node;
    }

    /* Hàng nút chọn một-trong-nhiều, dùng cho góc camera và độ nét. */
    function pickRow(label, items, initial, apply) {
      const btns = items.map(it => {
        const b = el('div.ae-pick__btn.tappable', { text: it.name });
        onTap(b, () => {
          btns.forEach((x, i) => setClass(x, 'ae-pick__btn--on', items[i].id === it.id));
          apply(it.id);
        });
        return b;
      });
      btns.forEach((b, i) => setClass(b, 'ae-pick__btn--on', items[i].id === initial));
      return el('div.ae-pick', null, [
        el('div.ae-pick__label', { text: label }),
        el('div.ae-pick__row', null, btns),
      ]);
    }

    const fpsRead = el('span.ae-perf__fps', { text: '—' });
    let fpsTimer = 0;

    /* Ba mục dưới đây chỉ đổi CÁCH DỰNG HÌNH — góc nhìn, độ phân giải khung
       dựng, nhịp vẽ. Không mục nào đụng vào chỉ số nhân vật hay bất kỳ con số
       nào của lối chơi. */
    const camPick = pickRow('Góc camera', CAMERA_VIEWS, GFX_DEFAULT.camera, id => {
      if (!bridge.setCameraView(id)) bridge.notify('Chưa có camera', 'error');
    });

    const scalePick = pickRow('Độ nét khung dựng', RENDER_SCALES, GFX_DEFAULT.scale, id => {
      if (!bridge.setRenderScale(id)) bridge.notify('Chưa dựng được engine', 'error');
    });

    const capPick = pickRow(
      'Giới hạn khung/giây',
      [
        { id: 0, name: 'Không giới hạn' },
        { id: 45, name: '45' },
        { id: 30, name: '30 · mát máy' },
      ],
      GFX_DEFAULT.fpsCap,
      id => bridge.setFpsCap(id)
    );

    /* ---------------------------------------------------------- GỠ LỖI
       Chơi trên điện thoại thì không mở được bảng điều khiển trình duyệt, nên
       mọi lỗi được giữ lại trong bộ nhớ (js/debug.js) và bày ra đây để chép
       gửi đi. Ô chữ dùng <textarea> chứ không dùng nút chép vào bộ nhớ tạm:
       trên iOS quyền chép hay bị chặn, còn bôi đen chữ thì luôn được. */
    const dbgDem = el('div.ae-dbg__count');
    const dbgO = el('textarea.ae-dbg__box', { readonly: 'readonly', hidden: true });

    function veDem() {
      const d = DBG.dem;
      setText(
        dbgDem,
        `${DBG.buf.length} dòng · ${d.loi} lỗi · ${d.canh} cảnh báo · ${d.mang} sự cố tải`
      );
      setClass(dbgDem, 'ae-dbg__count--bad', d.loi > 0);
    }

    const dbgXem = el('button.ae-forge__btn', { text: 'XEM NHẬT KÝ' });
    dbgXem.addEventListener('click', () => {
      if (dbgO.hidden) {
        dbgO.value = DBG.dump();
        dbgO.hidden = false;
        setText(dbgXem, 'ẨN NHẬT KÝ');
        // Bôi đen sẵn cho đỡ phải kéo tay trên điện thoại.
        dbgO.focus();
        dbgO.select();
      } else {
        dbgO.hidden = true;
        setText(dbgXem, 'XEM NHẬT KÝ');
      }
      veDem();
    });

    const dbgXoa = el('button.ae-forge__btn', { text: 'XOÁ' });
    dbgXoa.addEventListener('click', () => {
      DBG.clear();
      dbgO.value = '';
      veDem();
    });

    const dbgKhoi = el('div.ae-dbg', null, [
      el('div.ae-pick__label', { text: 'Gỡ lỗi' }),
      el('div.ae-toggles', null, [
        toggleRow('debug', 'Ghi nhật ký gỡ lỗi', on => DBG.setOn(on)),
      ]),
      el('div.ae-dbg__row', null, [dbgDem, dbgXem, dbgXoa]),
      dbgO,
    ]);

    const quit = el('button.ae-btn.ae-btn--danger.ae-modal__quit', {
      text: 'VỀ MÀN HÌNH CHÍNH',
      onclick: () => onQuit(),
    });

    const node = el('div', null, [
      camPick,
      scalePick,
      capPick,
      el('div.ae-perf', null, [
        el('span', { text: 'Khung/giây đang vẽ' }),
        fpsRead,
      ]),
      /* Bốn hiệu ứng dựng hình. Việc thật nằm trong engine (src/gfx), tắt mục
         nào là engine huỷ hẳn phần ấy chứ không chỉ giấu đi. */
      el('div.ae-pick__label', { text: 'Hiệu ứng dựng hình' }),
      el('div.ae-toggles', null,
        GFX_FX.map(fx =>
          toggleRow(fx.id, fx.name, on => {
            if (!bridge.setFx(fx.id, on)) bridge.notify('Chưa dựng được engine', 'error');
          })
        )
      ),
      el('div.ae-toggles', null, [
        toggleRow('music', 'Nhạc nền', on => {
          if (!bridge.setMusic(on)) bridge.notify('Chưa có kênh nhạc', 'error');
        }),
        toggleRow('sfx', 'Âm thanh hiệu ứng', on => {
          if (!bridge.setSfx(on)) bridge.notify('Chưa có kênh hiệu ứng', 'error');
        }),
        toggleRow('labels', 'Hiện tên vật thể', on => {
          document.body.classList.toggle('ae-no-labels', !on);
        }),
        toggleRow('reduce', 'Giảm hiệu ứng chuyển động', on => {
          document.body.classList.toggle('ae-reduce', on);
        }),
      ]),
      dbgKhoi,
      quit,
    ]);

    return {
      node,
      /* Chỉ đếm khung khi panel đang mở — mở bộ đếm suốt ngày cũng là một
         khoản hao vô ích. */
      update() {
        setText(fpsRead, String(bridge.fps()));
        veDem();
        clearInterval(fpsTimer);
        fpsTimer = setInterval(() => {
          if (!node.isConnected) {
            clearInterval(fpsTimer);
            return;
          }
          setText(fpsRead, String(bridge.fps()));
        }, 700);
      },
    };
  })();

  const views = {
    hero: heroView,
    inv: invView,
    skill: skillView,
    warp: warpView,
    set: setView,
  };

  const TITLES = {
    hero: 'NHÂN VẬT',
    inv: 'HÀNH TRANG',
    skill: 'KỸ NĂNG',
    warp: 'DỊCH CHUYỂN',
    set: 'HỆ THỐNG',
  };

  let current = null;

  return {
    root,

    open(id, snap) {
      if (!views[id]) return [];
      current = id;
      setText(title, TITLES[id]);
      clear(body);
      body.append(views[id].node);
      bridge.watchInventory(id === 'inv');
      if (snap) views[id].update(snap);
      root.hidden = false;
      return [];
    },

    close() {
      current = null;
      root.hidden = true;
      bridge.watchInventory(false);
    },

    isOpen(id) {
      return current === id;
    },

    get openIds() {
      return current ? [current] : [];
    },

    get current() {
      return current;
    },

    update(snap, changed) {
      if (!current) return;
      // Túi đồ chỉ vẽ lại khi chữ ký đổi, tránh dựng 76 ô mỗi khung hình.
      if (current === 'inv' && changed !== null && !changed.invSig && !changed.money) return;
      views[current].update(snap);
    },
  };
}
