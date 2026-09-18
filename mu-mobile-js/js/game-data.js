// Bảng dữ liệu tĩnh của game — trích đúng từ engine, không bịa số.
// Nguồn: src/common/types.ts, src/common/inventoryConstants.ts,
//        src/ui/pages/worldPage/components/mapsList/index.tsx

import { assetSize } from './asset-manifest.js';

/** CharacterClassNumber — src/common/types.ts */
export const CHAR_CLASS = {
  DarkWizard: 0,
  SoulMaster: 2,
  GrandMaster: 3,
  DarkKnight: 4,
  BladeKnight: 6,
  BladeMaster: 7,
  FairyElf: 8,
  MuseElf: 10,
  HighElf: 11,
  MagicGladiator: 12,
  DuelMaster: 13,
  DarkLord: 16,
  LordEmperor: 17,
  Summoner: 20,
  BloodySummoner: 22,
  DimensionMaster: 23,
  RageFighter: 24,
  FistMaster: 25,
};

/** ENUM_WORLD — src/common/types.ts */
export const WORLD = {
  LORENCIA: 0,
  DUNGEON: 1,
  DEVIAS: 2,
  NORIA: 3,
  LOSTTOWER: 4,
  ATLANS: 7,
  TARKAN: 8,
  ICARUS: 10,
};

/**
 * Ba lớp nhân vật cho màn chọn anh hùng.
 * Tên và mô tả lấy từ bản thiết kế Aetherfall; giá trị cls là lớp thật của
 * engine nên nhân vật dựng ra đúng model tương ứng.
 */
export const HEROES = [
  {
    cls: CHAR_CLASS.DarkKnight,
    glyph: '⚔',
    name: 'Hắc Kiếm Sĩ',
    role: 'CẬN CHIẾN · CHỊU ĐÒN',
    str: 88,
    agi: 52,
    ene: 24,
    desc:
      'Kiếm sĩ của Hắc Long, đánh gần và chịu sát thương thay cả đội. ' +
      'Kỹ năng xoáy quét diện rộng.',
  },
  {
    cls: CHAR_CLASS.DarkWizard,
    glyph: '✷',
    name: 'Pháp Sư Bóng',
    role: 'PHÉP · SÁT THƯƠNG DIỆN',
    str: 34,
    agi: 46,
    ene: 92,
    desc:
      'Triệu hồi băng và sấm từ tàn tích Kregar. Yếu khi bị áp sát, ' +
      'mạnh nhất ở khoảng cách xa.',
  },
  {
    cls: CHAR_CLASS.FairyElf,
    glyph: '✦',
    name: 'Cung Tinh Linh',
    role: 'TẦM XA · HỖ TRỢ',
    str: 56,
    agi: 90,
    ene: 58,
    desc:
      'Bắn nhanh, di chuyển linh hoạt, có thể triệu thú và tiếp máu ' +
      'cho bản thân giữa trận.',
  },
];

/**
 * Điểm dịch chuyển — đúng danh sách warp của engine, kèm cấp tối thiểu và
 * giá Zen thật. Tên bản đồ giữ nguyên gốc MU.
 */
export const WARP_POINTS = [
  { id: WORLD.LORENCIA, name: 'Lorencia', vi: 'Đồng bằng Lorencia', minLvl: 10, cost: 2000 },
  { id: WORLD.NORIA, name: 'Noria', vi: 'Rừng Noria', minLvl: 10, cost: 2000 },
  { id: WORLD.DEVIAS, name: 'Devias', vi: 'Băng nguyên Devias', minLvl: 20, cost: 2000 },
  { id: WORLD.DUNGEON, name: 'Dungeon', vi: 'Hầm ngục', minLvl: 30, cost: 3000 },
  { id: WORLD.LOSTTOWER, name: 'Lost Tower', vi: 'Tháp Mất Tích', minLvl: 50, cost: 5000 },
  { id: WORLD.ATLANS, name: 'Atlans', vi: 'Thủy cung Atlans', minLvl: 70, cost: 4000 },
  { id: WORLD.TARKAN, name: 'Tarkan', vi: 'Sa mạc Tarkan', minLvl: 140, cost: 8000 },
  { id: WORLD.ICARUS, name: 'Icarus', vi: 'Không đảo Icarus', minLvl: 170, cost: 10000 },
];

/**
 * Ảnh nền radar: dùng TerrainLight.jpg của chính bản đồ — bản đồ sáng 256×256
 * mà engine vẽ địa hình bằng, tức là ảnh CHỤP TỪ TRÊN XUỐNG thật của map chứ
 * không phải hình vẽ tay. Trục ảnh trùng lưới địa hình 0…255 nên chấm người
 * chơi đặt theo x/255, y/255 là khớp.
 *
 * MU còn có mini_map.tga trong mỗi thư mục World nhưng nặng 4 MB và trình
 * duyệt không giải mã được TGA, nên không dùng.
 */
export function terrainMapPath(worldIndex) {
  return `game-assets/World${(worldIndex ?? 0) + 1}/TerrainLight.jpg`;
}

/** Tên bản đồ theo chỉ số thế giới, dùng cho nhãn HUD. */
export const WORLD_NAMES = Object.fromEntries(
  WARP_POINTS.map(w => [w.id, w.vi])
);

/** InventoryConstants — src/common/inventoryConstants.ts */
export const INV = {
  FirstEquippableItemSlotIndex: 0,
  LastEquippableItemSlotIndex: 11,
  LeftHandSlot: 0,
  RightHandSlot: 1,
  HelmSlot: 2,
  ArmorSlot: 3,
  PantsSlot: 4,
  GlovesSlot: 5,
  BootsSlot: 6,
  WingsSlot: 7,
  PetSlot: 8,
  PendantSlot: 9,
  Ring1Slot: 10,
  Ring2Slot: 11,
  RowSize: 8,
  InventoryRows: 8,
};

/**
 * Khay trang bị ghép bằng ảnh: hoạ tiết chạm khắc và hình mờ trong từng ô quá
 * rối để dựng lại bằng CSS, nên dùng thẳng art. Toạ độ 14 ô do
 * tools/make-inv.py đo từ chính ảnh nguồn (1024 × 1008) — chạy lại tool khi
 * đổi art, đừng sửa tay.
 *
 * Art có 14 ô, MU chỉ dùng 12. Hai ô thừa (vai trên trái, huy hiệu dưới phải)
 * để idx null: không gắn dữ liệu, không nhận chạm, art vẽ sẵn hình mờ nên nhìn
 * vẫn liền mạch.
 */
export const EQUIP_ART = { src: 'ui/equip.jpg', ratio: 1024 / 1008 };

export const EQUIP_BOXES = [
  { idx: null, x: '3.125%', y: '3.075%', w: '18.359%', h: '18.552%' },
  { idx: INV.PendantSlot, x: '25.586%', y: '9.921%', w: '11.719%', h: '11.806%' },
  { idx: INV.HelmSlot, x: '41.797%', y: '3.075%', w: '18.359%', h: '18.651%' },
  { idx: INV.WingsSlot, x: '67.090%', y: '3.075%', w: '31.152%', h: '18.651%' },
  { idx: INV.LeftHandSlot, x: '3.125%', y: '25.298%', w: '18.457%', h: '27.877%' },
  { idx: INV.ArmorSlot, x: '41.797%', y: '25.397%', w: '18.359%', h: '27.778%' },
  { idx: INV.RightHandSlot, x: '80.176%', y: '25.298%', w: '18.164%', h: '27.877%' },
  { idx: INV.GlovesSlot, x: '3.125%', y: '56.746%', w: '18.359%', h: '18.552%' },
  { idx: INV.PantsSlot, x: '41.797%', y: '56.746%', w: '18.359%', h: '18.750%' },
  { idx: INV.BootsSlot, x: '80.176%', y: '56.845%', w: '18.066%', h: '18.552%' },
  { idx: INV.Ring1Slot, x: '25.586%', y: '63.790%', w: '11.719%', h: '11.607%' },
  { idx: INV.Ring2Slot, x: '64.258%', y: '63.790%', w: '11.719%', h: '11.706%' },
  { idx: INV.PetSlot, x: '3.125%', y: '79.464%', w: '18.457%', h: '18.353%' },
  { idx: null, x: '80.176%', y: '78.968%', w: '18.164%', h: '18.552%' },
];

/** Mười hai ô trang bị, kèm nhãn tiếng Việt. */
export const EQUIP_SLOTS = [
  { idx: INV.HelmSlot, label: 'Mũ' },
  { idx: INV.ArmorSlot, label: 'Giáp' },
  { idx: INV.PantsSlot, label: 'Quần' },
  { idx: INV.GlovesSlot, label: 'Găng' },
  { idx: INV.BootsSlot, label: 'Giày' },
  { idx: INV.WingsSlot, label: 'Cánh' },
  { idx: INV.LeftHandSlot, label: 'Tay trái' },
  { idx: INV.RightHandSlot, label: 'Tay phải' },
  { idx: INV.PendantSlot, label: 'Dây chuyền' },
  { idx: INV.Ring1Slot, label: 'Nhẫn 1' },
  { idx: INV.Ring2Slot, label: 'Nhẫn 2' },
  { idx: INV.PetSlot, label: 'Thú cưng' },
];

/**
 * Quy đổi cấp cường hoá sang bậc icon — sao chép nguyên logic normalizeLvl()
 * của engine (src/ui/components/itemIcon/index.tsx) để tên file icon khớp.
 */
export function normalizeItemLvl(lvl) {
  const n = lvl ?? 0;
  if (n < 3) return 0;
  if (n < 5) return 3;
  if (n < 7) return 5;
  if (n < 9) return 7;
  if (n < 11) return 9;
  if (n < 13) return 11;
  if (n < 15) return 13;
  return 15;
}

/** Đường dẫn logic của icon vật phẩm, khớp cây items/ nội bộ. */
export function itemIconPath(item) {
  const exc = item.isExcellent ? '_e' : '';
  const duong = l => `items/item_${item.group}_${item.num}_${l}${exc}.png`;

  /* KHÔNG phải món nào cũng có icon cho từng cấp cường hoá — cánh chẳng hạn
     chỉ có bản +0. Trước đây cứ dựng đường dẫn theo cấp rồi để trình duyệt
     đâm vào 404 và mới lùi về bản gốc trong onerror; đo được đúng một yêu cầu
     404 cho cánh +9 mỗi lần mở hòm đồ. Bảng kê đã có sẵn tên mọi file, tra
     trước thì không bắn đi yêu cầu nào biết chắc là hỏng. */
  const theoCap = duong(normalizeItemLvl(item.lvl));
  return assetSize(theoCap) >= 0 ? theoCap : duong(0);
}

/** Bốn phím hành động của thanh dưới — khớp Store.actionBar. */
export const ACTION_KEYS = ['q', 'w', 'e', 'r'];

/* ---------------------------------------------------------------------------
   HÌNH HỌC THANH HUD

   Mọi số dưới đây do tools/make-bar.py đo thẳng từ ảnh nguồn bar-hud.png rồi
   quy về % của ảnh ĐÃ CẮT (1952 × 516). Chạy lại tool khi đổi art, đừng sửa
   tay. Khung .ae-bar__frame ôm đúng ảnh nên % ở đây là % của khung.
   --------------------------------------------------------------------------- */

/**
 * Hai vòng cầu. Art vẽ vòng trái bán kính 201,5px và vòng phải 206,7px — lệch
 * nhau 2,5%. Tool lấy bán kính chung 195,5px (vòng nhỏ hơn trừ 6px lề an toàn)
 * cho cả hai, nên hai quả cầu BẰNG NHAU mà không quả nào tràn khỏi viền.
 * Hộp là hình vuông thật: 20,035% bề ngang ảnh = 75,793% bề cao ảnh = 391px.
 */
export const BAR_ORBS = {
  hp: { left: '2.005%', top: '4.467%', w: '20.035%', h: '75.793%' },
  mp: { left: '75.094%', top: '4.474%', w: '20.035%', h: '75.793%' },
};

/**
 * Bốn ô kỹ năng — hộp khung ngoài. Icon thu vào 9% mỗi chiều bằng padding
 * trong CSS, ra vừa đúng mặt tấm nền trong của ô.
 */
export const BAR_SLOTS = [
  { index: 0, left: '26.639%', top: '34.690%', w: '9.170%', h: '41.667%' },
  { index: 1, left: '36.783%', top: '34.690%', w: '9.324%', h: '41.667%' },
  { index: 2, left: '53.023%', top: '34.302%', w: '9.170%', h: '42.636%' },
  { index: 3, left: '63.217%', top: '34.302%', w: '9.068%', h: '42.248%' },
];

/**
 * Nội dung bốn ô, theo đúng nhãn in sẵn trên art: Q · E · 1 · 2.
 * Q và E là hai bình thuốc (đúng nếp MU), 1 là kỹ năng chính, 2 là ngựa.
 * group/num là mã vật phẩm THẬT của engine (src/common/items.json), nên icon
 * lấy thẳng từ kho items/ chứ không vẽ lại.
 */
export const BAR_DEFAULT_SLOTS = [
  { key: 'Q', group: 14, num: 2, name: 'Bình Máu', en: 'Healing Potion' },
  { key: 'E', group: 14, num: 5, name: 'Bình Mana', en: 'Mana Potion' },
  { key: '1', group: 12, num: 7, name: 'Xoay Kiếm', en: 'Orb of Twisting Slash' },
  { key: '2', group: 13, num: 4, name: 'Ngựa', en: 'Dark Horse' },
];

/**
 * Icon cho ô thanh bar — bản ĐÃ CẮT viền trong suốt (tools/trim-icons.mjs).
 * Ô bar là ô vuông nên cần hình lấp đầy; hòm đồ thì ngược lại, dùng canvas gốc
 * vì tỉ lệ canvas mới khớp số ô món đồ chiếm.
 */
export function barIconPath(def) {
  return `icons/${def.group}_${def.num}.png`;
}

/**
 * Bảy bậc màu nền ô theo cấp cường hoá, dùng chung thang với normalizeItemLvl()
 * ở trên (gộp +13 và +15 thành một bậc). Trả về 1..7.
 */
export function itemTier(lvl) {
  const n = lvl ?? 0;
  if (n < 3) return 1;
  if (n < 5) return 2;
  if (n < 7) return 3;
  if (n < 9) return 4;
  if (n < 11) return 5;
  if (n < 13) return 6;
  return 7;
}

/** Năm mục của cột gem bên trái. */
export const MENU_ITEMS = [
  { id: 'hero', glyph: '✚', label: 'NHÂN VẬT', title: 'NHÂN VẬT' },
  { id: 'inv', glyph: '▣', label: 'HÀNH TRANG', title: 'HÀNH TRANG' },
  { id: 'skill', glyph: '✵', label: 'KỸ NĂNG', title: 'KỸ NĂNG' },
  { id: 'warp', glyph: '❢', label: 'DỊCH CHUYỂN', title: 'DỊCH CHUYỂN' },
  { id: 'set', glyph: '⚙', label: 'HỆ THỐNG', title: 'HỆ THỐNG' },
];
