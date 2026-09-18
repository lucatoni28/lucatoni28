import monsters from '../common/monsters.json';
import { ModelFactoryPerId } from '../common/modelFactoryPerId';

/**
 * Chỉ số quái, đọc thẳng từ src/common/monsters.json — bảng 321 quái thật của
 * MU (Level, HP, MinDmg, MaxDmg, Def, AttackSuccess, MoveSpeed, AttSpeed,
 * ItemR, MoneyR, kháng hệ). Không có con số nào đặt tay ở đây.
 */
export type MonsterRow = {
  Numb: number;
  Name: string;
  Level: number;
  HP: number;
  MinDmg: number;
  MaxDmg: number;
  Def: number;
  AttackSuccess: number;
  Move: number;
  MoveSpeed: number;
  AttSpeed: number;
  ItemR: number;
  MoneyR: number;
  View: number;
  Range: number;
};

const rows = monsters as unknown as MonsterRow[];

const byId = new Map<number, MonsterRow>();
for (const r of rows) byId.set(r.Numb, r);

export function monsterById(id: number): MonsterRow | undefined {
  return byId.get(id);
}

/**
 * Quái có mesh dùng được: ModelFactoryPerId chỉ đăng ký bốn con
 * (1 Hound · 2 Budge Dragon · 3 Spider · 14 Skeleton Warrior). Ba trăm con còn
 * lại trong monsters.json vẫn có đủ chỉ số nhưng CHƯA có model, thả ra thì
 * thành bóng ma vô hình — nên chỉ đẻ những con có mặt trong danh sách này.
 * Thêm mesh vào ModelFactoryPerId là con đó tự dùng được ngay.
 */
export const SPAWNABLE_MONSTER_IDS = [1, 2, 3, 14].filter(
  id => byId.has(id) && !!ModelFactoryPerId[id]
);

/**
 * Bảng đẻ quái cho Lorencia.
 *
 * MU thật thả ở Lorencia các id 0, 1, 2, 3, 4, 6, 7; trong đó mới có 1, 2, 3
 * là có mesh. Skeleton Warrior (14) vốn là quái Hầm ngục, để dành cho map đó.
 *
 * `weight` là tỉ lệ xuất hiện tương đối, không phải số con.
 */
export const LORENCIA_SPAWNS = [
  { id: 3, weight: 5 }, // Spider — cấp 2, yếu nhất, đứng gần làng
  { id: 2, weight: 4 }, // Budge Dragon — cấp 4
  { id: 1, weight: 3 }, // Hound — cấp 9
];

export const DUNGEON_SPAWNS = [{ id: 14, weight: 6 }];

/** Bảng đẻ theo chỉ số bản đồ; map chưa khai báo thì không đẻ con nào. */
export const SPAWN_TABLE: Record<number, { id: number; weight: number }[]> = {
  0: LORENCIA_SPAWNS,
  1: DUNGEON_SPAWNS,
};

/** Bốc một id theo trọng số. */
export function pickSpawnId(
  table: { id: number; weight: number }[]
): number | null {
  if (table.length === 0) return null;
  let total = 0;
  for (const t of table) total += t.weight;
  let r = Math.random() * total;
  for (const t of table) {
    r -= t.weight;
    if (r <= 0) return t.id;
  }
  return table[table.length - 1].id;
}
