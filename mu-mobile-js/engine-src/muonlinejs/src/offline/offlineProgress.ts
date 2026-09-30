import items from '../common/items.json';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';
import { InventoryConstants } from '../common/inventoryConstants';
import type { Entity } from '../ecs/world';
import { expForLevel, gearExc, playerMaxHp, playerMaxMp } from './combatFormulas';
import { rollExcOptions } from './excellent';

type ItemRow = {
  Group: number;
  Index: number;
  ItemName: string;
  Drop: number;
  RequiredLvl: number;
};

const rows = items as unknown as ItemRow[];

/**
 * Bảng rơi đồ dựng từ chính src/common/items.json: chỉ lấy những món có cờ
 * Drop = 1, rồi lọc theo RequiredLvl so với cấp quái. Không có danh sách nào
 * do tôi bịa ra.
 */
const droppable = rows.filter(r => r.Drop === 1);

/** Tỉ lệ rơi đồ mỗi con — ItemR trong monsters.json là 2 với hầu hết quái đầu. */
const ITEM_DROP_CHANCE = 0.14;

function pickDrop(monsterLevel: number): ItemRow | null {
  const pool = droppable.filter(
    r => r.RequiredLvl <= monsterLevel + 10 && r.RequiredLvl >= monsterLevel - 20
  );
  const from = pool.length > 0 ? pool : droppable.filter(r => r.RequiredLvl <= 10);
  if (from.length === 0) return null;
  return from[(Math.random() * from.length) | 0];
}

/** Ô trống đầu tiên trong túi, hoặc -1 nếu đầy. */
function firstFreeBagSlot(): number {
  const p = Store.playerData;
  const base = InventoryConstants.LastEquippableItemSlotIndex + 1;
  const size = InventoryConstants.InventoryRows * InventoryConstants.RowSize;
  for (let i = 0; i < size; i++) {
    if (!p.items[base + i]) return base + i;
  }
  return -1;
}

/**
 * Ăn công một con quái: cộng kinh nghiệm, tiền, có thể rơi đồ, và lên cấp nếu
 * đủ. Gọi từ OfflineCombatSystem lúc quái tụt máu về 0.
 */
/** Tỉ lệ một món rơi ra là Xuất sắc. MU cổ điển để rất thấp; 3% cho chơi đơn
    là đủ hiếm để đáng mừng mà không phải săn cả buổi mới thấy một món. */
const EXC_DROP_CHANCE = 0.03;

export function grantKill(m: NonNullable<Entity['monster']>) {
  const e = gearExc();

  // Dòng Xuất sắc "Tăng Zen kiếm được khi săn +40%" cộng vào đây.
  const zen = Math.round(
    m.moneyR * (0.7 + Math.random() * 0.6) * (1 + e.zenPct)
  );

  Store.gainExpOffline(m.exp);
  Store.gainZenOffline(zen);

  /* Hai dòng Xuất sắc hồi máu/mana khi giết quái. Bản gốc ghi "+HP/8" nghĩa
     là một phần tám MÁU TỐI ĐA, không phải 8 điểm. Mỗi món mang dòng này cộng
     thêm một phần như vậy. */
  const p = Store.playerData;
  if (e.hpPerKill > 0) {
    Store.setPlayerHp(p.currentHP + Math.ceil((p.maxHP / 8) * e.hpPerKill));
  }
  if (e.mpPerKill > 0) {
    Store.setPlayerMp(p.currentMP + Math.ceil((p.maxMP / 8) * e.mpPerKill));
  }

  EventBus.emit('offlineKill', { name: m.name, exp: m.exp, zen });

  if (Math.random() < ITEM_DROP_CHANCE) {
    const row = pickDrop(m.level);

    // Tắt tự nhặt thì món đồ vẫn rơi, chỉ là không vào túi — báo ra để lớp
    // giao diện biết. Việc rơi xuống đất rồi nhặt tay là phần sau.
    if (row && !Store.autoLoot) {
      EventBus.emit('offlineLoot', { name: `${row.ItemName} (chưa nhặt)`, zen });
      return;
    }

    const slot = firstFreeBagSlot();

    if (row && slot >= 0) {
      // Cấp cường hoá theo cấp quái, tối đa +4 ở vùng quái đầu — quy ước MU là
      // quái càng cao càng rơi đồ cường hoá cao.
      const lvl = Math.min(4, (Math.random() * (m.level / 6 + 1)) | 0);
      /* Món Xuất sắc: bốc dòng ngay lúc rơi, không để trống rồi gán sau —
         gán sau là có lúc món hiện chữ "Xuất sắc" mà không dòng nào. */
      const exc = Math.random() < EXC_DROP_CHANCE;
      Store.putItemOffline(slot, {
        group: row.Group,
        num: row.Index,
        lvl,
        isExcellent: exc,
        ...(exc ? { excOptions: rollExcOptions(row.Group) } : {}),
      });
      EventBus.emit('offlineLoot', {
        name: exc ? `${row.ItemName} (Xuất sắc)` : row.ItemName,
        zen,
      });
    } else if (row && slot < 0) {
      EventBus.emit('offlineLoot', { name: 'TÚI ĐẦY', zen });
    }
  }
}

/** Cộng kinh nghiệm và xử lý lên cấp. Trả về số cấp vừa lên. */
export function applyExp(amount: number): number {
  const p = Store.playerData;
  let gained = 0;

  p.exp += amount;

  while (p.exp >= p.expToNextLvl) {
    p.level += 1;
    gained += 1;

    p.points += 5;
    p.currentLvlExp = p.expToNextLvl;
    p.expToNextLvl = p.currentLvlExp + expForLevel(p.level);

    p.maxHP = playerMaxHp();
    p.maxMP = playerMaxMp();
    p.currentHP = p.maxHP;
    p.currentMP = p.maxMP;
  }

  if (gained > 0) {
    EventBus.emit('offlineLevelUp', { level: p.level, points: p.points });
  }
  return gained;
}

/**
 * Cộng một điểm vào chỉ số. Trả về true nếu cộng được.
 *
 * Giống bản gốc MU: mỗi cấp được 5 điểm (xem applyExp ở trên), cộng vào đâu là
 * chỉ số đó tăng vĩnh viễn. Sinh lực và năng lượng phép tính lại ngay theo đúng
 * công thức có sẵn chứ không cộng tay, nên không lệch với chỗ khác.
 */
export function spendPoint(stat: 'str' | 'agi' | 'sta' | 'eng'): boolean {
  const p = Store.playerData;
  if (!p.points || p.points <= 0) return false;
  if (stat !== 'str' && stat !== 'agi' && stat !== 'sta' && stat !== 'eng') {
    return false;
  }

  p.points -= 1;
  p[stat] += 1;

  if (stat === 'sta') {
    const them = playerMaxHp() - p.maxHP;
    p.maxHP = playerMaxHp();
    p.currentHP = Math.min(p.maxHP, p.currentHP + Math.max(0, them));
  }
  if (stat === 'eng') {
    const them = playerMaxMp() - p.maxMP;
    p.maxMP = playerMaxMp();
    p.currentMP = Math.min(p.maxMP, p.currentMP + Math.max(0, them));
  }

  EventBus.emit('offlineStatSpent', { stat, points: p.points });
  return true;
}
