import { InventoryConstants } from '../common/inventoryConstants';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';
import type { Item } from '../ecs/world';
import { itemRow, requiredLevel, SOCKET_KINDS } from './itemStats';

/**
 * Bốn thao tác với đồ ở chế độ chơi đơn: mặc, cởi, cường hoá, khảm ngọc.
 *
 * Bản chơi mạng gửi gói lên server và chờ kết quả; chơi đơn không có server nên
 * phần này thay chỗ đó. Mọi thay đổi đều ghi thẳng vào Store.playerData.items
 * rồi đánh dấu charAppearance.changed để mô hình 3D vẽ lại — hiệu ứng phát sáng
 * theo cấp cường hoá đã có sẵn trong shader (src/common/itemMaterial.ts), nên
 * cường hoá xong là thấy ngay trên người.
 */

const BAG_FIRST = InventoryConstants.LastEquippableItemSlotIndex + 1;
const BAG_SIZE = InventoryConstants.InventoryRows * InventoryConstants.RowSize;

/** Ô trang bị hợp lệ cho một món, hoặc null nếu món đó không mặc được. */
export function equipSlotsFor(it: Item | null | undefined): number[] {
  const r = itemRow(it);
  if (!r) return [];
  const s = (r as { ItemSlot?: number }).ItemSlot;
  if (s === undefined || s < 0) return [];
  // Nhẫn có hai ô; bảng chỉ ghi ô đầu.
  if (s === InventoryConstants.Ring1Slot) {
    return [InventoryConstants.Ring1Slot, InventoryConstants.Ring2Slot];
  }
  return [s];
}

function inBag(slot: number) {
  return slot >= BAG_FIRST && slot < BAG_FIRST + BAG_SIZE;
}

function isEquipSlot(slot: number) {
  return (
    slot >= InventoryConstants.FirstEquippableItemSlotIndex &&
    slot <= InventoryConstants.LastEquippableItemSlotIndex
  );
}

/** Ô túi trống đầu tiên. */
function freeBagSlot(): number {
  const p = Store.playerData;
  for (let i = 0; i < BAG_SIZE; i++) if (!p.items[BAG_FIRST + i]) return BAG_FIRST + i;
  return -1;
}

/** Báo cho hệ thống hình ảnh biết phải vẽ lại nhân vật. */
function refreshAppearance() {
  const e = Store.world?.playerEntity;
  if (e?.charAppearance) {
    const p = Store.playerData;
    e.charAppearance.helm = p.items[InventoryConstants.HelmSlot] ?? null;
    e.charAppearance.armor = p.items[InventoryConstants.ArmorSlot] ?? null;
    e.charAppearance.pants = p.items[InventoryConstants.PantsSlot] ?? null;
    e.charAppearance.gloves = p.items[InventoryConstants.GlovesSlot] ?? null;
    e.charAppearance.boots = p.items[InventoryConstants.BootsSlot] ?? null;
    e.charAppearance.leftHand = p.items[InventoryConstants.LeftHandSlot] ?? null;
    e.charAppearance.rightHand = p.items[InventoryConstants.RightHandSlot] ?? null;
    e.charAppearance.wings = p.items[InventoryConstants.WingsSlot] ?? null;
    e.charAppearance.changed = true;
  }
  /* leftHandSlot / rightHandSlot là computed đọc thẳng từ items, không gán
     được mà cũng không cần: sửa items xong là chúng tự đổi theo. */
}

/**
 * Chuyển một món từ ô này sang ô kia. Dùng cho cả mặc, cởi và dời trong túi.
 * Trả về lý do hỏng, hoặc null nếu xong.
 */
export function moveItem(from: number, to: number): string | null {
  const p = Store.playerData;
  const it = p.items[from] as Item | undefined;
  if (!it) return 'Ô nguồn trống';
  if (from === to) return null;

  if (isEquipSlot(to)) {
    const ok = equipSlotsFor(it);
    if (!ok.includes(to)) return 'Món này không mặc vào ô đó được';
    const rq = requiredLevel(it);
    if (p.level < rq) return `Cần cấp ${rq}`;
  } else if (!inBag(to)) {
    return 'Ô đích không hợp lệ';
  }

  const cu = p.items[to] as Item | undefined;
  p.items[to] = it;
  p.items[from] = cu ?? null;

  refreshAppearance();
  EventBus.emit('offlineItemMoved', { from, to });
  return null;
}

/** Mặc một món trong túi vào ô hợp lệ đầu tiên còn trống. */
export function equipItem(bagSlot: number): string | null {
  const p = Store.playerData;
  const it = p.items[bagSlot] as Item | undefined;
  if (!it) return 'Ô trống';
  const oks = equipSlotsFor(it);
  if (oks.length === 0) return 'Món này không mặc được';
  const trong = oks.find(s => !p.items[s]);
  return moveItem(bagSlot, trong ?? oks[0]);
}

/** Cởi một món đang mặc, bỏ vào ô túi trống đầu tiên. */
export function unequipItem(equipSlot: number): string | null {
  const trong = freeBagSlot();
  if (trong < 0) return 'Túi đã đầy';
  return moveItem(equipSlot, trong);
}

/* ------------------------------------------------------------ cường hoá
   MU gốc dùng Ngọc Phúc Lành tới +6 và Ngọc Tâm Linh từ +7, hỏng là mất cấp
   hoặc mất đồ. Chơi đơn chưa có hệ ngọc nên ở đây trả bằng Zen, và HỎNG THÌ
   CHỈ MẤT TIỀN, không tụt cấp cũng không mất đồ — ghi rõ đây là chỗ tôi làm
   nhẹ đi so với bản gốc, không phải số của MU. */

/** Cấp cường hoá cao nhất. */
export const MAX_UPGRADE = 15;

/** Tiền cần để thử lên cấp kế tiếp. */
export function upgradeCost(lvl: number): number {
  return 5000 * (lvl + 1) * (lvl + 1);
}

/** Tỉ lệ thành công khi thử lên cấp kế tiếp. */
export function upgradeChance(lvl: number): number {
  if (lvl < 6) return 1;
  return Math.max(0.2, 1 - (lvl - 5) * 0.1);
}

export function upgradeItem(slot: number): { ok: boolean; reason: string } {
  const p = Store.playerData;
  const it = p.items[slot] as Item | undefined;
  if (!it) return { ok: false, reason: 'Ô trống' };

  const lvl = it.lvl ?? 0;
  if (lvl >= MAX_UPGRADE) return { ok: false, reason: `Đã đạt +${MAX_UPGRADE}` };

  const gia = upgradeCost(lvl);
  if ((p.money ?? 0) < gia) return { ok: false, reason: `Cần ${gia.toLocaleString('vi')} Zen` };

  p.money -= gia;

  if (Math.random() > upgradeChance(lvl)) {
    EventBus.emit('offlineUpgrade', { slot, ok: false, lvl, cost: gia });
    return { ok: false, reason: 'Cường hoá thất bại' };
  }

  it.lvl = lvl + 1;
  // Gán lại chính đối tượng để mobx thấy mảng đổi.
  p.items[slot] = { ...it };
  refreshAppearance();
  EventBus.emit('offlineUpgrade', { slot, ok: true, lvl: lvl + 1, cost: gia });
  return { ok: true, reason: `+${lvl + 1}` };
}

/* -------------------------------------------------------------- ngọc khảm */

/** Số lỗ tối đa, đúng bản gốc MU. */
export const MAX_SOCKETS = 5;

export function openSocketCost(count: number): number {
  return 20000 * (count + 1);
}

/** Mở thêm một lỗ khảm trên món đồ. */
export function openSocket(slot: number): { ok: boolean; reason: string } {
  const p = Store.playerData;
  const it = p.items[slot] as Item | undefined;
  if (!it) return { ok: false, reason: 'Ô trống' };

  const r = itemRow(it);
  const co = (r as { ItemSlot?: number })?.ItemSlot;
  if (co === undefined || co < 0) return { ok: false, reason: 'Món này không khảm được' };

  const ds = it.sockets ?? [];
  if (ds.length >= MAX_SOCKETS) return { ok: false, reason: `Đã đủ ${MAX_SOCKETS} lỗ` };

  const gia = openSocketCost(ds.length);
  if ((p.money ?? 0) < gia) return { ok: false, reason: `Cần ${gia.toLocaleString('vi')} Zen` };

  p.money -= gia;
  p.items[slot] = { ...it, sockets: [...ds, null] };
  EventBus.emit('offlineSocket', { slot, action: 'open', index: ds.length });
  return { ok: true, reason: `Mở lỗ thứ ${ds.length + 1}` };
}

export const MOUNT_COST = 30000;

/** Khảm một viên ngọc vào lỗ. Lỗ đang có ngọc thì thay. */
export function mountSocket(
  slot: number,
  index: number,
  kind: number
): { ok: boolean; reason: string } {
  const p = Store.playerData;
  const it = p.items[slot] as Item | undefined;
  if (!it?.sockets || index < 0 || index >= it.sockets.length) {
    return { ok: false, reason: 'Không có lỗ đó' };
  }
  if (!SOCKET_KINDS[kind]) return { ok: false, reason: 'Không có loại ngọc đó' };
  if ((p.money ?? 0) < MOUNT_COST) {
    return { ok: false, reason: `Cần ${MOUNT_COST.toLocaleString('vi')} Zen` };
  }

  p.money -= MOUNT_COST;
  const ds = [...it.sockets];
  ds[index] = kind;
  p.items[slot] = { ...it, sockets: ds };
  refreshAppearance();
  EventBus.emit('offlineSocket', { slot, action: 'mount', index, kind });
  return { ok: true, reason: `Khảm ${SOCKET_KINDS[kind].vi}` };
}

/** Gỡ ngọc khỏi lỗ. Ngọc mất, không trả lại — đúng nếp MU. */
export function clearSocket(slot: number, index: number): { ok: boolean; reason: string } {
  const p = Store.playerData;
  const it = p.items[slot] as Item | undefined;
  if (!it?.sockets || index < 0 || index >= it.sockets.length) {
    return { ok: false, reason: 'Không có lỗ đó' };
  }
  const ds = [...it.sockets];
  ds[index] = null;
  p.items[slot] = { ...it, sockets: ds };
  refreshAppearance();
  EventBus.emit('offlineSocket', { slot, action: 'clear', index });
  return { ok: true, reason: 'Đã gỡ ngọc' };
}
