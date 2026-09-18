/**
 * Tuỳ chọn Xuất sắc (Excellent) cho chế độ chơi đơn.
 *
 * NÓI RÕ NGUỒN: client này không có bảng tuỳ chọn Excellent — trong bản chơi
 * mạng chúng nằm ở server và về client dưới dạng vài bit trong gói vật phẩm
 * (xem ReadWingOption/itemSerializer.ts, chỉ đọc chứ không có bảng nghĩa).
 * Mười hai dòng dưới đây là bộ Excellent MU cổ điển, tôi viết lại phía máy
 * người chơi. Số liệu theo bản gốc: vũ khí 6 dòng, giáp 6 dòng, mỗi món tối đa
 * 6 dòng nhưng thực tế rơi ra 1–2 là thường.
 *
 * CÁCH LƯU: một số nguyên làm mặt nạ bit trong Item.excOptions. Sáu bit thấp
 * là sáu dòng của đúng loại món đó (vũ khí hay giáp) — cùng một bit mang nghĩa
 * khác nhau tuỳ loại, y như bản gốc.
 *
 * MỌI DÒNG ĐỀU CÓ TÁC ĐỘNG THẬT, không có dòng nào chỉ để trưng bày:
 *   – phần cộng vào sát thương/phòng thủ/máu/mana  → combatFormulas.ts
 *   – phần hồi máu, hồi mana, thêm Zen khi giết quái → offlineProgress.ts
 *   – phần phản đòn và giảm sát thương nhận vào    → offlineCombatSystem.ts
 *   – phần tăng tốc đánh                            → offlineCombatSystem.ts
 */

import type { Item } from '../ecs/world';
import { ARMOR_GROUPS } from './itemStats';

/** Số dòng tối đa một món có thể mang. */
export const MAX_EXC_OPTIONS = 6;

/** Món này tính theo bảng giáp hay bảng vũ khí. */
export function isArmorLike(group: number): boolean {
  // Khiên (6) và cánh (12) ăn theo bảng giáp, đúng như MU.
  return ARMOR_GROUPS.includes(group) || group === 6 || group === 12;
}

export interface ExcOption {
  /** Bit trong mặt nạ. */
  bit: number;
  /** Dòng chữ hiện trong bảng thông tin, đúng lối MU tiếng Việt. */
  text: string;
}

/** Sáu dòng của VŨ KHÍ. */
export const EXC_WEAPON: ExcOption[] = [
  { bit: 1, text: 'Tăng lượng HP khi giết quái vật +HP/8' },
  { bit: 2, text: 'Phục hồi Mana khi giết quái vật +Mana/8' },
  { bit: 4, text: 'Tăng tỉ lệ sát thương hoàn hảo +10%' },
  { bit: 8, text: 'Gia tăng sức sát thương +2%' },
  { bit: 16, text: 'Gia tăng tốc độ tấn công +7' },
  { bit: 32, text: 'Gia tăng sát thương +cấp độ/20' },
];

/** Sáu dòng của GIÁP, KHIÊN và CÁNH. */
export const EXC_ARMOR: ExcOption[] = [
  { bit: 1, text: 'Tăng Zen kiếm được khi săn +40%' },
  { bit: 2, text: 'Tăng tỉ lệ phòng thủ thành công +10%' },
  { bit: 4, text: 'Phản lại sát thương +5%' },
  { bit: 8, text: 'Giảm sát thương nhận vào +4%' },
  { bit: 16, text: 'Gia tăng Mana tối đa +4%' },
  { bit: 32, text: 'Gia tăng HP tối đa +4%' },
];

/** Bảng dòng đúng cho một nhóm món. */
export function excTable(group: number): ExcOption[] {
  return isArmorLike(group) ? EXC_ARMOR : EXC_WEAPON;
}

/** Các dòng Excellent của một món, đã đổi sang chữ. */
export function excLines(it: Item | null | undefined): string[] {
  if (!it?.isExcellent) return [];
  const mask = it.excOptions ?? 0;
  if (!mask) return [];
  return excTable(it.group)
    .filter(o => (mask & o.bit) !== 0)
    .map(o => o.text);
}

/** Đếm số dòng đang có. */
export function excCount(it: Item | null | undefined): number {
  if (!it?.isExcellent) return 0;
  let n = 0;
  let m = it.excOptions ?? 0;
  while (m) {
    n += m & 1;
    m >>= 1;
  }
  return n;
}

/**
 * Bốc ngẫu nhiên các dòng cho một món vừa thành Xuất sắc.
 *
 * Phân bố theo nếp MU: một dòng là phổ biến nhất, càng nhiều dòng càng hiếm.
 * Không bao giờ trả về 0 dòng — món Xuất sắc mà trống dòng thì vô nghĩa.
 */
export function rollExcOptions(group: number): number {
  const r = Math.random();
  const soDong = r < 0.62 ? 1 : r < 0.87 ? 2 : r < 0.965 ? 3 : r < 0.995 ? 4 : 5;

  const bits = excTable(group).map(o => o.bit);
  // Trộn rồi lấy phần đầu — cách này không bao giờ chọn trùng một bit hai lần.
  for (let i = bits.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [bits[i], bits[j]] = [bits[j], bits[i]];
  }

  let mask = 0;
  for (let i = 0; i < soDong; i++) mask |= bits[i];
  return mask;
}

/** Tổng tác động của toàn bộ đồ đang mặc. */
export interface ExcTotals {
  /** Hồi máu mỗi lần giết quái (đơn vị: maxHP/8 × số món có dòng này). */
  hpPerKill: number;
  /** Hồi mana mỗi lần giết quái. */
  mpPerKill: number;
  /** Tỉ lệ ra đòn hoàn hảo (bỏ qua phòng thủ đối phương). 0,10 = 10%. */
  perfectRate: number;
  /** Nhân vào sát thương. 0,02 = +2%. */
  damagePct: number;
  /** Cộng vào tốc độ đánh (mỗi điểm rút ngắn nhịp đánh một chút). */
  attackSpeed: number;
  /** Cộng thẳng vào sát thương theo cấp: cấp/20 mỗi món. */
  damagePerLevel: number;
  /** Zen thêm khi giết quái. 0,40 = +40%. */
  zenPct: number;
  /** Cộng vào tỉ lệ phòng thủ thành công. 0,10 = +10%. */
  defenseRatePct: number;
  /** Phản lại sát thương về phía đánh mình. 0,05 = 5%. */
  reflectPct: number;
  /** Giảm sát thương nhận vào. 0,04 = −4%. */
  damageCutPct: number;
  /** Cộng phần trăm mana tối đa. */
  manaPct: number;
  /** Cộng phần trăm máu tối đa. */
  hpPct: number;
}

function totalsRong(): ExcTotals {
  return {
    hpPerKill: 0,
    mpPerKill: 0,
    perfectRate: 0,
    damagePct: 0,
    attackSpeed: 0,
    damagePerLevel: 0,
    zenPct: 0,
    defenseRatePct: 0,
    reflectPct: 0,
    damageCutPct: 0,
    manaPct: 0,
    hpPct: 0,
  };
}

/**
 * Cộng dồn tác động của một danh sách món.
 *
 * Cộng thẳng chứ không nhân dồn: hai món cùng có "+2% sát thương" thành +4%,
 * đúng như MU. Món không Xuất sắc hoặc không có dòng nào thì bỏ qua.
 */
export function excTotals(list: (Item | null | undefined)[]): ExcTotals {
  const t = totalsRong();

  for (const it of list) {
    if (!it?.isExcellent) continue;
    const mask = it.excOptions ?? 0;
    if (!mask) continue;

    if (isArmorLike(it.group)) {
      if (mask & 1) t.zenPct += 0.4;
      if (mask & 2) t.defenseRatePct += 0.1;
      if (mask & 4) t.reflectPct += 0.05;
      if (mask & 8) t.damageCutPct += 0.04;
      if (mask & 16) t.manaPct += 0.04;
      if (mask & 32) t.hpPct += 0.04;
    } else {
      if (mask & 1) t.hpPerKill += 1;
      if (mask & 2) t.mpPerKill += 1;
      if (mask & 4) t.perfectRate += 0.1;
      if (mask & 8) t.damagePct += 0.02;
      if (mask & 16) t.attackSpeed += 7;
      if (mask & 32) t.damagePerLevel += 1;
    }
  }

  // Chặn trên cho vài dòng cộng dồn được nhiều món: giảm sát thương và phản
  // đòn mà không chặn thì mặc đủ bộ Excellent là thành bất tử.
  t.damageCutPct = Math.min(0.4, t.damageCutPct);
  t.reflectPct = Math.min(0.5, t.reflectPct);
  t.perfectRate = Math.min(0.5, t.perfectRate);

  return t;
}
