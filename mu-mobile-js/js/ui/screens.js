// Màn nạp, màn khởi đầu, màn chọn anh hùng và màn báo lỗi.

import { el, setText, setStyle, setClass, onTap } from './dom.js';
import { HEROES } from '../game-data.js';

/** Màn nạp có tiến độ và dòng trạng thái thật của quá trình boot. */
export function createLoading() {
  const text = el('div.ae-loading__text', { text: 'ĐANG KHỞI ĐỘNG' });
  const hint = el('div.ae-loading__hint');
  const fill = el('div.ae-loading__fill');
  const root = el('div.ae-loading', null, [
    el('div.ae-loading__mark'),
    text,
    el('div.ae-loading__track', null, [fill]),
    hint,
  ]);

  return {
    root,
    set(message, pct) {
      setText(text, message);
      if (typeof pct === 'number') setStyle(fill, 'width', `${Math.round(pct * 100)}%`);
    },
    setHint(message) {
      setText(hint, message);
    },
    show(on) {
      root.hidden = !on;
    },
  };
}

/** Màn lỗi — in nguyên văn để gỡ rối, không nuốt lỗi. */
export function createFatal() {
  const msg = el('div.ae-fatal__msg');
  const root = el('div.ae-fatal', { hidden: true }, [
    el('div.ae-fatal__title', { text: 'KHÔNG KHỞI ĐỘNG ĐƯỢC' }),
    msg,
    el('div.ae-loading__hint', {
      text:
        'Thêm ?debug=1 vào cuối địa chỉ trang để xem nhật ký gỡ lỗi đầy đủ.',
    }),
  ]);

  return {
    root,
    show(error) {
      setText(msg, error && error.stack ? error.stack : String(error));
      root.hidden = false;
    },
  };
}

/**
 * Ảnh tiêu đề màn khởi đầu. Chưa có file thì khung nét đứt hiện thay, ghi rõ
 * đường dẫn và cỡ ảnh — thả đúng file này vào ui/ là hiện ngay, không phải
 * dựng lại gì.
 *
 * Ảnh hiện dùng là logo MU đã cắt sạch viền trong suốt: 1238 × 1206. Ô chứa
 * trong CSS đặt đúng tỉ lệ đó. Thay ảnh khác thì chỉnh aspect-ratio của
 * .ae-start__logo cho khớp, không thì ảnh bị thừa khoảng hai bên.
 */
const TITLE_IMG = 'ui/title.png';
const TITLE_IMG_SIZE = '1238 × 1206';

/** Khung tiêu đề: ảnh nếu có, khung chờ nếu chưa. */
function createTitleSlot() {
  const img = el('img.ae-start__logo-img', {
    alt: 'AETHERFALL',
    hidden: true,
    decoding: 'async',
  });
  const placeholder = el('div.ae-start__logo-ph', null, [
    el('div.ae-start__logo-ph__label', { text: 'TIÊU ĐỀ CHÍNH' }),
    el('div.ae-start__logo-ph__path', { text: TITLE_IMG }),
    el('div.ae-start__logo-ph__size', { text: `PNG NỀN TRONG · ${TITLE_IMG_SIZE}` }),
  ]);

  // Gắn hai lắng nghe TRƯỚC khi gán src, để không lỡ mất sự kiện.
  img.addEventListener('load', () => {
    img.hidden = false;
    placeholder.hidden = true;
  });
  img.addEventListener('error', () => {
    img.hidden = true;
    placeholder.hidden = false;
  });
  img.src = TITLE_IMG;

  return el('div.ae-start__logo', null, [img, placeholder]);
}

/** Màn khởi đầu: tiếp tục hoặc chơi mới. */
export function createStartScreen({ onContinue, onNewGame }) {
  const heroName = el('span.ae-savebox__value');
  const place = el('span.ae-savebox__value.ae-savebox__value--plain');
  const clock = el('span.ae-savebox__value.ae-savebox__value--num');

  const continueBtn = el('button.ae-btn.ae-btn--primary', {
    text: 'TIẾP TỤC',
    onclick: onContinue,
  });
  const newBtn = el('button.ae-btn.ae-btn--ghost', {
    text: 'CHƠI MỚI',
    onclick: onNewGame,
  });

  const root = el('div.ae-screen.ae-start', { hidden: true }, [
    el('div.ae-start__art'),
    el('div.ae-start__wash'),
    el('div.ae-start__vignette'),
    el('div.ae-start__brand', null, [
      createTitleSlot(),
      el('div.ae-start__subtitle', { text: 'Truyền thuyết Hắc Long' }),
    ]),
    el('div.ae-start__card.ae-frame', null, [
      el('div.ae-frame__body', null, [
        el('div.ae-titlebar', null, [
          el('span.ae-titlebar__text', { text: 'HÀNH TRÌNH' }),
        ]),
        el('div.ae-savebox', null, [
          el('div.ae-savebox__row', null, [
            el('span.ae-label', { text: 'NHÂN VẬT' }),
            heroName,
          ]),
          el('div.ae-hairline'),
          el('div.ae-savebox__row', null, [
            el('span.ae-label', { text: 'VỊ TRÍ' }),
            place,
          ]),
          el('div.ae-hairline'),
          el('div.ae-savebox__row', null, [
            el('span.ae-label', { text: 'THỜI GIAN CHƠI' }),
            clock,
          ]),
        ]),
        el('div.ae-start__actions', null, [continueBtn, newBtn]),
      ]),
    ]),
    el('div.ae-start__build', { text: 'MU MOBILE · BẢN DỰNG THỬ NGHIỆM' }),
  ]);

  return {
    root,
    /** Đổ thông tin phiên trước (lấy từ localStorage, không bịa). */
    setSave(save) {
      if (save) {
        setText(heroName, `${save.heroName} · Lv ${save.level}`);
        setText(place, save.mapName);
        setText(clock, save.playtime);
        continueBtn.disabled = false;
      } else {
        setText(heroName, 'Chưa có');
        setText(place, '—');
        setText(clock, '00:00');
        continueBtn.disabled = true;
      }
    },
    show(on) {
      root.hidden = !on;
    },
  };
}

/** Màn chọn anh hùng — ba lớp nhân vật thật của engine. */
export function createHeroScreen({ onBack, onEnter }) {
  let picked = 0;

  const cards = HEROES.map((hero, i) => {
    const stats = [
      { label: 'SỨC', mod: 'str', value: hero.str },
      { label: 'NHANH', mod: 'agi', value: hero.agi },
      { label: 'PHÉP', mod: 'sta', value: hero.ene },
    ].map(s =>
      el('div.ae-hero__stat', null, [
        el('span', { text: s.label }),
        el(`div.ae-meter.ae-meter--${s.mod}`, null, [
          el('div.ae-meter__fill', { style: { width: `${s.value}%` } }),
        ]),
      ])
    );

    const card = el('div.ae-hero.ae-frame.ae-frame--card.tappable', null, [
      el('div.ae-frame__body', null, [
        el('div.ae-hero__top', null, [
          el('div.ae-hero__portrait', { text: hero.glyph }),
          el('div', { style: { flex: '1', minWidth: '0' } }, [
            el('div.ae-hero__name', { text: hero.name }),
            el('div.ae-hero__role', { text: hero.role }),
            el('div.ae-hero__stats', null, stats),
          ]),
        ]),
        el('div.ae-hero__desc', { text: hero.desc }),
      ]),
    ]);

    onTap(card, () => select(i));
    return card;
  });

  function select(i) {
    picked = i;
    cards.forEach((c, k) => setClass(c, 'ae-hero--picked', k === i));
  }
  select(0);

  const root = el('div.ae-screen.ae-heroes', { hidden: true }, [
    el('div.ae-heroes__head', null, [
      el('div.ae-heroes__title', { text: 'CHỌN ANH HÙNG' }),
      el('div.ae-heroes__sub', { text: 'Chế độ chơi đơn · Độ khó Thường' }),
    ]),
    el('div.ae-heroes__list.scrollable', null, cards),
    el('div.ae-heroes__foot', null, [
      el('button.ae-btn.ae-btn--ghost', { text: 'QUAY LẠI', onclick: onBack }),
      el('button.ae-btn.ae-btn--primary', {
        text: 'VÀO THẾ GIỚI',
        onclick: () => onEnter(HEROES[picked]),
      }),
    ]),
  ]);

  return {
    root,
    get picked() {
      return HEROES[picked];
    },
    show(on) {
      root.hidden = !on;
    },
  };
}

/** Nhắc xoay dọc khi người chơi lật ngang máy. */
export function createRotatePrompt() {
  return el('div.ae-rotate', null, [
    el('div.ae-rotate__glyph', { text: '⟳' }),
    el('div.ae-rotate__text', { text: 'XOAY DỌC MÁY ĐỂ CHƠI' }),
  ]);
}
