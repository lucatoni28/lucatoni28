import items from '../common/items.json';
import { Store } from '../store';
import type { Item } from '../ecs/world';

/**
 * Công thức chiến đấu cho chế độ chơi đơn.
 *
 * NÓI RÕ NGUỒN: client này KHÔNG có bảng sát thương của người chơi — chỗ duy
 * nhất nhắc tới sát thương trong giao diện gốc là một dòng chữ cứng
 * ("Skill Damage: 201%"). Trong bản chơi mạng, mọi phép tính đánh nhau nằm ở
 * server và client chỉ nhận gói kết quả. Nên phần dưới đây là công thức MU cổ
 * điển tôi viết lại phía máy người chơi, không phải số lấy ra từ engine:
 *
 *   sát thương  = Sức mạnh/8 … Sức mạnh/4, cộng thêm theo cấp, cộng vũ khí
 *   phòng thủ   = Nhanh nhẹn/3, cộng toàn bộ đồ đang mặc
 *   tỉ lệ trúng = cấp×3 + nhanh nhẹn×1,5, cộng ngọc khảm
 *
 * Phần đóng góp của từng món đồ (cường hoá, Xuất sắc, đồ Thần, ngọc) tính ở
 * src/offline/itemStats.ts — một chỗ duy nhất, để bảng thông tin trong giao
 * diện và lúc đánh nhau không bao giờ lệch nhau.
 *
 * Chỉ số quái thì ngược lại: lấy nguyên từ monsters.json, không đụng vào.
 * Muốn chỉnh độ khó thì sửa đúng bốn hàm ở file này.
 */

import { InventoryConstants } from '../common/inventoryConstants';
import {
  ARMOR_GROUPS,
  itemAttackRate,
  itemDamage,
  itemDefense,
  itemHp,
  setInfo,
} from './itemStats';
import { excTotals, type ExcTotals } from './excellent';

/** Hai tay cầm vũ khí. */
function handItems(): (Item | null)[] {
  const p = Store.playerData;
  return [p.leftHandSlot ?? null, p.rightHandSlot ?? null];
}

/**
 * Sáu ô giáp: mũ, giáp, quần, găng, giày, khiên (khiên nằm ở tay trái nên đọc
 * riêng bên dưới), cộng dây chuyền và hai nhẫn.
 */
const ARMOR_SLOTS = [
  InventoryConstants.HelmSlot,
  InventoryConstants.ArmorSlot,
  InventoryConstants.PantsSlot,
  InventoryConstants.GlovesSlot,
  InventoryConstants.BootsSlot,
  InventoryConstants.WingsSlot,
  InventoryConstants.PendantSlot,
  InventoryConstants.Ring1Slot,
  InventoryConstants.Ring2Slot,
];

function armorItems(): (Item | null)[] {
  const p = Store.playerData;
  const ra = ARMOR_SLOTS.map(i => (p.items?.[i] as Item | undefined) ?? null);
  // Khiên cầm tay trái cũng cộng phòng thủ.
  ra.push(p.leftHandSlot ?? null);
  return ra;
}

/** Tổng sát thương của hai tay. */
function weaponDamage(): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const it of handItems()) {
    const d = itemDamage(it);
    min += d.min;
    max += d.max;
  }
  return { min, max };
}

/** Năm ô giáp dùng để xét bộ trang phục. */
export function armorSetPieces(): (Item | null)[] {
  const p = Store.playerData;
  return [
    InventoryConstants.HelmSlot,
    InventoryConstants.ArmorSlot,
    InventoryConstants.PantsSlot,
    InventoryConstants.GlovesSlot,
    InventoryConstants.BootsSlot,
  ].map(i => (p.items?.[i] as Item | undefined) ?? null);
}

/** Bộ trang phục đang mặc và mức thưởng của nó. */
export function gearSet() {
  return setInfo(armorSetPieces());
}

/** Tổng phòng thủ của đồ đang mặc, đã cộng phần thưởng bộ. */
export function gearDefense(): number {
  let def = 0;
  for (const it of armorItems()) def += itemDefense(it);
  return Math.round(def * (1 + gearSet().defPct));
}

/** Tỉ lệ đánh trúng cộng thêm từ ngọc trên đồ. */
export function gearAttackRate(): number {
  let n = 0;
  for (const it of handItems()) n += itemAttackRate(it);
  for (const it of armorItems()) n += itemAttackRate(it);
  return n + gearSet().atkRate;
}

/** Máu tối đa cộng thêm từ ngọc trên đồ. */
export function gearHp(): number {
  let n = 0;
  for (const it of armorItems()) n += itemHp(it);
  return n;
}

/** Tổng tác động Xuất sắc của TOÀN BỘ đồ đang mặc — hai tay và chín ô giáp. */
export function gearExc(): ExcTotals {
  return excTotals([...handItems(), ...armorItems()]);
}

export function playerMinDamage(): number {
  const p = Store.playerData;
  const w = weaponDamage();
  const e = gearExc();
  const goc =
    Math.floor(p.str / 8 + p.level / 10) +
    w.min +
    Math.floor((p.level / 20) * e.damagePerLevel);
  return Math.max(1, Math.round(goc * (1 + e.damagePct)));
}

export function playerMaxDamage(): number {
  const p = Store.playerData;
  const w = weaponDamage();
  const e = gearExc();
  const goc =
    Math.floor(p.str / 4 + p.level / 5) +
    w.max +
    Math.floor((p.level / 20) * e.damagePerLevel);
  return Math.max(
    playerMinDamage() + 1,
    Math.round(goc * (1 + e.damagePct))
  );
}

/** Phòng thủ = nhanh nhẹn/3 CỘNG phòng thủ của toàn bộ đồ đang mặc. */
export function playerDefense(): number {
  return Math.floor(Store.playerData.agi / 3) + gearDefense();
}

export function playerAttackRate(): number {
  const p = Store.playerData;
  return p.level * 3 + Math.floor(p.agi * 1.5) + gearAttackRate();
}

/**
 * Tỉ lệ ĐỠ ĐÒN của người chơi, dùng làm defRate khi quái đánh mình.
 * Dòng Xuất sắc "tăng tỉ lệ phòng thủ thành công" cộng vào đây.
 */
export function playerDefenseRate(): number {
  const p = Store.playerData;
  const base = p.level * 2 + Math.floor(p.agi * 1.2);
  return Math.round(base * (1 + gearExc().defenseRatePct));
}

/** Máu tối đa theo cấp và thể lực — công thức MU: mỗi cấp +2, mỗi điểm thể lực +1. */
export function playerMaxHp(): number {
  const p = Store.playerData;
  const goc = 40 + (p.level - 1) * 2 + (p.sta - 10) + gearHp();
  return Math.round(goc * (1 + gearExc().hpPct));
}

export function playerMaxMp(): number {
  const p = Store.playerData;
  const goc = 100 + (p.level - 1) * 2 + (p.eng - 10) * 2;
  return Math.round(goc * (1 + gearExc().manaPct));
}

/**
 * Kinh nghiệm cần cho cấp kế tiếp. MU cổ điển: (cấp+9)² × cấp × 10 / 8 cho
 * khoảng cấp đầu; giữ nguyên dạng đó để đường lên cấp cong giống bản gốc.
 */
export function expForLevel(level: number): number {
  return Math.round((((level + 9) * (level + 9) * level) / 8) * 10);
}

/**
 * Một đòn đánh: trả về số sát thương, hoặc 0 nếu trượt.
 * `atkRate` của bên đánh so với `defRate` của bên đỡ cho ra tỉ lệ trúng, kẹp
 * trong khoảng 20–95% để không bao giờ trượt sạch hay trúng tuyệt đối.
 */
export function rollHit(
  atkRate: number,
  defRate: number,
  minDmg: number,
  maxDmg: number,
  targetDefense: number,
  /** Tỉ lệ ra đòn HOÀN HẢO — bỏ qua toàn bộ phòng thủ đối phương.
      Đây là nghĩa của dòng Xuất sắc "tăng tỉ lệ sát thương hoàn hảo". */
  perfectRate = 0
): number {
  const chance = Math.min(0.95, Math.max(0.2, atkRate / (atkRate + defRate + 1)));
  if (Math.random() > chance) return 0;

  const raw = minDmg + Math.random() * (maxDmg - minDmg);
  const boQuaGiap = perfectRate > 0 && Math.random() < perfectRate;
  return Math.max(1, Math.round(raw - (boQuaGiap ? 0 : targetDefense)));
}
