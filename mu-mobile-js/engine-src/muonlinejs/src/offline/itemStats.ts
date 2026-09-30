import items from '../common/items.json';
import type { Item } from '../ecs/world';
import { excLines } from './excellent';

/**
 * Chỉ số THẬT của một món đồ: phòng thủ, sát thương, và phần cộng thêm của
 * cường hoá, Xuất sắc, đồ Thần, ngọc khảm.
 *
 * Đây là CHỖ DUY NHẤT tính những con số đó. combatFormulas.ts gọi sang, giao
 * diện cũng gọi sang qua window.__itemStats, nên bảng thông tin và lúc đánh
 * nhau không bao giờ lệch nhau.
 */

type Row = {
  Group: number;
  Index: number;
  ItemName: string;
  ItemLvl?: number;
  DmgMin?: number;
  DmgMax?: number;
  Speed?: number;
  Def?: number;
  DefRate?: number;
  X?: number;
  Y?: number;
  ReqLvl?: number;
  RequiredLvl?: number;
  Str?: number;
  Strength?: number;
  Agi?: number;
  Ene?: number;
  Vit?: number;
  Durability?: number;
  Dur?: number;
  MagicDur?: number;
  MagicPwr?: number;
  Lvl?: number;
  Valor?: number;
  Energy?: number;
  Zen?: number;
  // Sáu cột lớp nhân vật. 0 = không dùng được; số > 0 = dùng được (con số là
  // số tay cầm / bậc, không phải cờ đúng-sai).
  'DW/SM'?: number;
  'DK/BK'?: number;
  'Elf/ME'?: number;
  MG?: number;
  DL?: number;
  SUM?: number;
};

/** Tên lớp nhân vật đúng thứ tự cột trong Item.txt. */
export const CLASS_COLS: { key: keyof Row; vi: string }[] = [
  { key: 'DW/SM', vi: 'Pháp Sư' },
  { key: 'DK/BK', vi: 'Hắc Kiếm Sĩ' },
  { key: 'Elf/ME', vi: 'Tiên Nữ' },
  { key: 'MG', vi: 'Đấu Sĩ' },
  { key: 'DL', vi: 'Chúa Tể' },
  { key: 'SUM', vi: 'Triệu Hồi' },
];

const rows = items as unknown as Row[];

const byKey = new Map<number, Row>();
for (const r of rows) byKey.set(r.Group * 1000 + r.Index, r);

/** Tra một dòng trong items.json. */
export function itemRow(it: Item | null | undefined): Row | undefined {
  if (!it) return undefined;
  return byKey.get(it.group * 1000 + it.num);
}

export function itemName(it: Item | null | undefined): string {
  return itemRow(it)?.ItemName ?? '';
}

/**
 * Cộng thêm của cấp cường hoá. Quy ước MU cổ điển: mỗi cấp +3 cho tới +9, từ
 * +10 trở lên mỗi cấp +4. Dùng chung cho cả sát thương lẫn phòng thủ.
 */
export function lvlBonus(lvl: number | undefined): number {
  const n = lvl ?? 0;
  if (n <= 0) return 0;
  return n <= 9 ? n * 3 : 27 + (n - 9) * 4;
}

/**
 * Phòng thủ gốc của một món giáp.
 *
 * MỘT CHỖ PHẢI SUY LUẬN, ghi rõ ra đây: bảng items.json điền hai cột không
 * nhất quán.
 *
 * ĐÃ SỬA: trước đây ở đây có luật "lấy Def, bằng 0 thì lấy DefRate". Luật ấy
 * sinh ra để chữa cháy cho một bộ dữ liệu HỎNG — items.json trong repo bị lệch
 * 2 cột so với bảng gốc tools/Item.txt, nên cột Def của giáp toàn số 0 và số
 * phòng thủ thật rơi sang DefRate. Sau khi sinh lại items.json cho đúng
 * (tools/fix-items-json.mjs bên dự án mu-mobile) thì Def luôn đúng, còn
 * DefRate là TỈ LỆ ĐỠ ĐÒN riêng — chỉ khiên mới có cả hai. Lấy nhầm là cộng
 * tỉ lệ đỡ vào phòng thủ.
 */
export function baseDefense(r: Row | undefined): number {
  if (!r) return 0;
  return r.Def ?? 0;
}

/* ------------------------------------------------------------------ ngọc
   Năm loại ngọc khảm của MU. Con số là mức cộng cho MỘT lỗ; bản gốc chia theo
   bậc ngọc 1–5, ở đây gộp về một bậc để chưa cần bảng ngọc riêng. */
export const SOCKET_KINDS = [
  { id: 0, name: 'Hoả', vi: 'Ngọc Hoả', color: '#ff6a2a', dmg: 10, atkRate: 0, def: 0, hp: 0 },
  { id: 1, name: 'Thuỷ', vi: 'Ngọc Thuỷ', color: '#3f8cff', dmg: 0, atkRate: 0, def: 12, hp: 0 },
  { id: 2, name: 'Băng', vi: 'Ngọc Băng', color: '#6fe3f5', dmg: 6, atkRate: 30, def: 0, hp: 0 },
  { id: 3, name: 'Phong', vi: 'Ngọc Phong', color: '#5fd67a', dmg: 0, atkRate: 0, def: 5, hp: 40 },
  { id: 4, name: 'Lôi', vi: 'Ngọc Lôi', color: '#b07dff', dmg: 14, atkRate: 20, def: 0, hp: 0 },
] as const;

export function socketKind(id: number | null | undefined) {
  if (id === null || id === undefined) return null;
  return SOCKET_KINDS[id] ?? null;
}

/** Tổng cộng thêm của mọi viên ngọc đang khảm trên một món. */
export function socketBonus(it: Item | null | undefined) {
  const out = { dmg: 0, atkRate: 0, def: 0, hp: 0 };
  if (!it?.sockets) return out;
  for (const s of it.sockets) {
    const k = socketKind(s);
    if (!k) continue;
    out.dmg += k.dmg;
    out.atkRate += k.atkRate;
    out.def += k.def;
    out.hp += k.hp;
  }
  return out;
}

/* Hệ số nhân của Xuất sắc và đồ Thần.
   Bản gốc MU cho đồ Xuất sắc một bộ tuỳ chọn ngẫu nhiên (tăng sát thương 2%,
   hồi máu khi đánh…) và đồ Thần một bộ chỉ số cộng thêm. Ở đây gom về một hệ
   số nhân cho gọn — GHI RÕ đây là rút gọn, không phải bảng gốc. */
const EXC_MUL = 1.1;
const DIV_MUL = 1.2;

function mul(it: Item): number {
  let m = 1;
  if (it.isExcellent) m *= EXC_MUL;
  if (it.isDivine) m *= DIV_MUL;
  return m;
}

/** Phòng thủ thật của một món đang mặc. */
export function itemDefense(it: Item | null | undefined): number {
  if (!it) return 0;
  const r = itemRow(it);
  const b = baseDefense(r);
  if (!b) return socketBonus(it).def;
  return Math.round((b + lvlBonus(it.lvl)) * mul(it)) + socketBonus(it).def;
}

/** Sát thương thật của một món vũ khí đang cầm. */
export function itemDamage(it: Item | null | undefined): { min: number; max: number } {
  if (!it) return { min: 0, max: 0 };
  const r = itemRow(it);
  if (!r || r.DmgMax === undefined) return { min: 0, max: 0 };

  const bonus = lvlBonus(it.lvl);
  const sk = socketBonus(it);
  /* Bảng gốc để DmgMin = 0 ở 76 vũ khí đời đầu — MU lưu cận dưới theo tỉ lệ
     chứ không ghi thẳng. Chỗ đó lấy 60% của DmgMax làm cận dưới. */
  const rawMin = r.DmgMin && r.DmgMin > 0 ? r.DmgMin : Math.round(r.DmgMax * 0.6);
  const m = mul(it);
  return {
    min: Math.round((rawMin + bonus) * m) + sk.dmg,
    max: Math.round((r.DmgMax + bonus) * m) + sk.dmg,
  };
}

/** Tỉ lệ đánh trúng cộng thêm từ ngọc. */
export function itemAttackRate(it: Item | null | undefined): number {
  return socketBonus(it).atkRate;
}

/** Máu tối đa cộng thêm từ ngọc. */
export function itemHp(it: Item | null | undefined): number {
  return socketBonus(it).hp;
}

/* ------------------------------------------------- về mấy cột KHÔNG TIN ĐƯỢC
   Đã đối chiếu items.json với bảng gốc MU và chỉ hai nhóm cột khớp:

     ĐÚNG   DmgMin/DmgMax (Kris 0–6 = MU 3–6 sau khi bù cận dưới) và phòng thủ
            (Bronze Armor 18, Legendary Armor 56 — đúng số MU).
     SAI    Speed: Kris 6, Bill of Balrog 102, trong khi tốc độ đánh thật của
            hai món là 20 và 30. Cột này tăng dần theo bậc món trong từng nhóm,
            tức nó là một cột khác bị đặt nhầm tên.
     SAI    Str/Agi/Ene/Vit: Kris ghi Ene 40 / Vit 40, mà MU thì Kris đòi 40
            SỨC MẠNH. Các cột yêu cầu bị lệch chỗ.

   Nên KHÔNG hiển thị tốc độ đánh và yêu cầu chỉ số — thà thiếu còn hơn ghi số
   sai. Riêng cấp yêu cầu thì giữ: Legendary 42 đúng bằng cấp 42 của MU, và đó
   là cái chặn duy nhất đang có. */

/** Cấp nhân vật mà món đồ đòi hỏi. */
/**
 * Cấp nhân vật tối thiểu để dùng món.
 *
 * Mỗi nhóm để con số này ở một cột khác nhau, đã đối chiếu từng nhóm với bảng
 * gốc Item.txt chứ không suy đoán:
 *   vũ khí, giáp, cánh  → ReqLvl / RequiredLvl
 *   thú cưỡi (nhóm 13)  → Lvl   (Thiên Sứ 23 · Ngựa 218 · Fenrir 300 — khớp MU)
 *   thuốc    (nhóm 14)  → ItemLvl (Táo 1 · nhỏ 10 · vừa 25 · lớn 40 — khớp MU)
 *   cuộn     (nhóm 15)  → Lvl
 */
export function requiredLevel(it: Item | null | undefined): number {
  const r = itemRow(it);
  if (!r) return 0;
  if (r.ReqLvl) return r.ReqLvl;
  if (r.RequiredLvl) return r.RequiredLvl;
  if (it?.group === 13 || it?.group === 15) return r.Lvl ?? 0;
  if (it?.group === 14) return r.ItemLvl ?? 0;
  return 0;
}

/** Thuốc hồi bao nhiêu (cột Valor). 0 nghĩa là món không phải thuốc. */
export function itemHeal(it: Item | null | undefined): number {
  return it?.group === 14 ? (itemRow(it)?.Valor ?? 0) : 0;
}

/** Giá bán ở cửa hàng, hiện có trong bảng cho nhóm cuộn phép. */
export function itemPrice(it: Item | null | undefined): number {
  return itemRow(it)?.Zen ?? 0;
}

/** Tốc độ đánh ghi trong bảng. 0 nghĩa là món không phải vũ khí. */
export function itemSpeed(it: Item | null | undefined): number {
  return itemRow(it)?.Speed ?? 0;
}

/**
 * Độ bền. Mỗi loại món để ở một cột khác:
 *   vũ khí thường → Durability   (95/95 món có số, MagicDur đều 0)
 *   gậy phép      → MagicDur     (29/29 gậy có Durability = 0, số thật ở MagicDur)
 *   giáp, cánh, thú → Dur
 * Đã đếm cả bảng để chắc, không phải suy từ một hai món.
 */
export function itemDurability(it: Item | null | undefined): number {
  const r = itemRow(it);
  if (!r) return 0;
  return r.Durability || r.MagicDur || r.Dur || 0;
}

/** Yêu cầu chỉ số để dùng được món. */
export function itemRequires(it: Item | null | undefined) {
  const r = itemRow(it);
  return {
    str: r?.Strength ?? r?.Str ?? 0,
    agi: r?.Agi ?? 0,
    // Cuộn phép để yêu cầu năng lượng ở cột tên khác.
    ene: r?.Ene || r?.Energy || 0,
    vit: r?.Vit ?? 0,
  };
}

/** Tên các lớp nhân vật dùng được món này. Rỗng = mọi lớp. */
export function itemClasses(it: Item | null | undefined): string[] {
  const r = itemRow(it);
  if (!r) return [];
  const co = CLASS_COLS.filter(c => ((r[c.key] as number) ?? 0) > 0);
  // Cả sáu lớp đều dùng được thì thôi khỏi liệt kê, đúng nếp MU.
  return co.length === 0 || co.length === CLASS_COLS.length
    ? []
    : co.map(c => c.vi);
}

/** Số ô món đồ chiếm trong túi. */
export function itemSize(it: Item | null | undefined): { x: number; y: number } {
  const r = itemRow(it);
  return { x: r?.X ?? 1, y: r?.Y ?? 1 };
}

/**
 * Hạng của món đồ, quyết định MÀU CHỮ tên món trong bảng — đúng nếp MU:
 *   wing    cánh, chữ vàng
 *   divine  đồ Thần, chữ tím
 *   excellent  chữ xanh lá
 *   socket  có lỗ khảm, chữ lam ngọc
 *   normal  chữ ngà
 */
export type ItemRank = 'wing' | 'divine' | 'excellent' | 'socket' | 'normal';

/** Nhóm 12 là Cánh trong bảng vật phẩm MU. */
const WING_GROUP = 12;

export function itemRank(it: Item | null | undefined): ItemRank {
  if (!it) return 'normal';
  if (it.group === WING_GROUP) return 'wing';
  if (it.isDivine) return 'divine';
  if (it.isExcellent) return 'excellent';
  if (it.sockets && it.sockets.length > 0) return 'socket';
  return 'normal';
}

/** Mọi thông tin cần cho bảng chú giải khi chạm giữ một món. */
export function describeItem(it: Item | null | undefined) {
  if (!it) return null;
  const r = itemRow(it);
  const dmg = itemDamage(it);
  const def = itemDefense(it);
  const sk = socketBonus(it);
  return {
    name: r?.ItemName ?? `nhóm ${it.group}/${it.num}`,
    rank: itemRank(it),
    lvl: it.lvl ?? 0,
    isExcellent: !!it.isExcellent,
    isDivine: !!it.isDivine,
    dmgMin: dmg.min,
    dmgMax: dmg.max,
    def,
    atkRate: sk.atkRate,
    hp: sk.hp,
    reqLvl: requiredLevel(it),
    /* Bốn dòng dưới đây lấy từ bảng gốc Item.txt, đọc bằng ĐÚNG lược đồ cột
       của từng loại món. Trước đây tôi bỏ không hiện vì tưởng dữ liệu không
       tin được — hoá ra dữ liệu đúng, chỉ là items.json bị sinh lệch cột. */
    speed: itemSpeed(it),
    dur: itemDurability(it),
    req: itemRequires(it),
    classes: itemClasses(it),
    defRate: itemRow(it)?.DefRate ?? 0,
    magicPwr: itemRow(it)?.MagicPwr ?? 0,
    num: it.num,
    group: it.group,
    heal: itemHeal(it),
    price: itemPrice(it),
    size: itemSize(it),
    /* Các dòng Xuất sắc, đã đổi sang chữ. Lấy từ src/offline/excellent.ts để
       bảng thông tin và lúc đánh nhau dùng chung MỘT nguồn — sửa một chỗ là
       cả hai theo, không bao giờ lệch. */
    excLines: excLines(it),
    sockets: (it.sockets ?? []).map(s => {
      const k = socketKind(s);
      return k
        ? { id: k.id, vi: k.vi, color: k.color, dmg: k.dmg, def: k.def, atkRate: k.atkRate, hp: k.hp }
        : null;
    }),
  };
}

/* ------------------------------------------------------------ bộ trang phục
   MU định nghĩa một BỘ bằng cách năm món giáp cùng mang một số thứ tự: Dragon
   Helm (7,1), Dragon Armor (8,1), Dragon Pants (9,1), Dragon Gloves (10,1),
   Dragon Boots (11,1). Nên chỉ cần đếm xem năm ô giáp có bao nhiêu món trùng
   Index là ra số mảnh của bộ — không phải bảng tôi tự đặt.

   Mức thưởng thì LÀ RÚT GỌN: bản gốc mỗi bộ một bảng tuỳ chọn riêng, ở đây quy
   về cộng phần trăm phòng thủ theo số mảnh. */
export const ARMOR_GROUPS = [7, 8, 9, 10, 11];

const SET_DEF_PCT: Record<number, number> = { 3: 0.05, 4: 0.1, 5: 0.15 };
const SET_ATK_RATE: Record<number, number> = { 5: 10 };

/** Bộ đang mặc: số thứ tự bộ, tên, số mảnh, mức thưởng. */
export function setInfo(pieces: (Item | null | undefined)[]) {
  const dem = new Map<number, number>();
  for (const it of pieces) {
    if (!it) continue;
    if (!ARMOR_GROUPS.includes(it.group)) continue;
    dem.set(it.num, (dem.get(it.num) ?? 0) + 1);
  }

  let num = -1;
  let count = 0;
  for (const [k, v] of dem) {
    if (v > count) {
      count = v;
      num = k;
    }
  }
  if (count < 2) return { num: -1, name: '', count, defPct: 0, atkRate: 0 };

  const mau = pieces.find(it => it && ARMOR_GROUPS.includes(it.group) && it.num === num);
  const ten = (itemName(mau) || '').replace(/\s+(Helm|Armor|Pants|Gloves|Boots)$/i, '');

  return {
    num,
    name: ten,
    count,
    defPct: SET_DEF_PCT[count] ?? 0,
    atkRate: SET_ATK_RATE[count] ?? 0,
  };
}
