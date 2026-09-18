import { Vector3 } from '../libs/babylon/exports';
import { createAttributeSystem } from '../libs/attributeSystem';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';
import { ModelFactoryPerId } from '../common/modelFactoryPerId';
import { MonsterActionType } from '../common/objects/enum';
import { TERRAIN_SIZE, TWFlags } from '../common/terrain/consts';
import { isFlagInBinaryMask } from '../common/utils';
import type { Entity, ISystemFactory, World } from '../ecs/world';
import { monsterById, pickSpawnId, SPAWN_TABLE } from './monsterData';

/** Số quái giữ trên bản đồ cùng lúc. */
const POPULATION = 24;

/** Giây chờ trước khi đẻ lại con đã chết. */
const RESPAWN_DELAY = 8;

/* Quái không đẻ ngay dưới chân người chơi, nhưng cũng không đẻ quá xa: camera
   MU nhìn xa khoảng 10–15 ô, đẻ cách 12 ô trở lên là ra khỏi khung hình và
   người chơi tưởng bản đồ trống trơn. 7 ô là vừa ngoài tầm mắt một chút. */
const MIN_DIST_FROM_PLAYER = 7;
const MAX_DIST_FROM_PLAYER = 45;

/** Số lần bốc ô ngẫu nhiên trước khi bỏ cuộc trong một lần đẻ. */
const MAX_TRIES = 120;

/**
 * Đẻ quái cho chế độ chơi đơn.
 *
 * Chỗ đẻ KHÔNG đặt tay theo toạ độ: bốc ô ngẫu nhiên rồi loại những ô không đi
 * được và những ô nằm trong vùng an toàn (cờ SafeZone của chính địa hình), nên
 * quái không bao giờ mọc trong làng dù bản đồ nào. Cách này cũng tự đúng khi
 * đổi map mà không phải chép lại toạ độ.
 */
export const OfflineSpawnSystem: ISystemFactory = world => {
  // KHÔNG kiểm Store.isOffline ở đây: createWorld() chạy trước playOffline()
  // nên lúc này cờ vẫn còn false, kiểm ở đây là hệ thống chết hẳn cả phiên.
  // Kiểm trong update mới đúng.
  const query = world.with('monster', 'transform');

  let elapsed = 0;
  let readyAt = 0;

  EventBus.on('warpCompleted', () => {
    for (const e of [...query]) world.remove(e);
    // Địa hình vừa nạp xong nhưng lưới đi đường phải chờ PathfindingSystem
    // dựng lại ở khung sau, nên hoãn một nhịp rồi mới đẻ.
    readyAt = elapsed + 1.5;
  });

  return {
    update: dt => {
      elapsed += dt;
      if (!Store.isOffline) return;
      if (!world.terrain) return;
      if (elapsed < readyAt) return;

      const table = SPAWN_TABLE[world.mapIndex];
      if (!table) return;

      let alive = 0;
      for (const e of query) {
        if (e.monster.state !== 'dead') {
          alive++;
          continue;
        }
        if (elapsed - e.monster.diedAt >= RESPAWN_DELAY) world.remove(e);
      }

      if (alive >= POPULATION) return;

      // Mỗi khung chỉ đẻ một con: nạp model là việc nặng, đẻ hai chục con cùng
      // lúc là khựng hình thấy rõ.
      const id = pickSpawnId(table);
      if (id !== null) spawnMonster(world, id, elapsed);
    },
  };
};

function randomSpot(world: World): { x: number; y: number } | null {
  const p = world.playerEntity?.transform.pos;
  const px = p ? p.x : TERRAIN_SIZE / 2;
  const pz = p ? p.z : TERRAIN_SIZE / 2;

  for (let i = 0; i < MAX_TRIES; i++) {
    const x = 1 + ((Math.random() * (TERRAIN_SIZE - 2)) | 0);
    const y = 1 + ((Math.random() * (TERRAIN_SIZE - 2)) | 0);

    if (!world.isWalkable(x, y)) continue;
    if (isFlagInBinaryMask(world.getTerrainFlag(x, y), TWFlags.SafeZone)) continue;

    const d = Math.hypot(x - px, y - pz);
    if (d < MIN_DIST_FROM_PLAYER || d > MAX_DIST_FROM_PLAYER) continue;

    return { x, y };
  }
  return null;
}

export function spawnMonster(
  world: World,
  id: number,
  now: number
): Entity | null {
  const row = monsterById(id);
  const modelFactory = ModelFactoryPerId[id];
  if (!row || !modelFactory) return null;

  const spot = randomSpot(world);
  if (!spot) return null;

  const e = world.add({
    worldIndex: world.mapIndex,
    transform: {
      pos: new Vector3(spot.x, world.getTerrainHeight(spot.x, spot.y), spot.y),
      rot: new Vector3(0, Math.random() * Math.PI * 2, 0),
      scale: modelFactory.OverrideScale >= 0 ? modelFactory.OverrideScale : 1,
      posOffset: new Vector3(0.5, 0, 0.5),
    },
    modelFactory,
    pathfinding: {
      from: { x: spot.x, y: spot.y },
      to: { x: spot.x, y: spot.y },
      path: [],
      calculated: true,
    },
    playerMoveTo: { point: { x: spot.x, y: spot.y }, handled: true as boolean },
    movement: { velocity: { x: 0, y: 0 } },
    monsterAnimation: { action: MonsterActionType.Stop1 },
    attributeSystem: createAttributeSystem(),
    visibility: { lastChecked: 0, state: 'hidden' as const },
    screenPosition: { worldOffsetZ: 2.5, x: 0, y: 0 },
    objectNameInWorld: row.Name,
    interactable: true as const,
    monster: {
      id,
      name: row.Name,
      level: row.Level,
      hp: row.HP,
      maxHp: row.HP,
      minDmg: row.MinDmg,
      maxDmg: row.MaxDmg,
      def: row.Def,
      attackSuccess: row.AttackSuccess,
      // Kinh nghiệm: MU tính theo cấp quái, đây là công thức gốc của server
      // (level+10) * level / 4, không phải số tôi tự đặt.
      exp: Math.max(1, Math.round(((row.Level + 10) * row.Level) / 4)),
      moneyR: row.MoneyR,
      itemR: row.ItemR,
      // AttSpeed trong bảng tính bằng mili-giây một đòn.
      attackSpeed: Math.max(0.35, row.AttSpeed / 1000),
      home: { x: spot.x, y: spot.y },
      state: 'idle' as const,
      thinkAt: now,
      attackAt: now,
      diedAt: 0,
      // View là tầm nhìn theo ô của chính bảng quái; Range là tầm đánh, 0
      // nghĩa là đánh giáp lá cà nên quy về 1 ô.
      aggroRange: Math.max(6, row.View * 4),
      attackRange: Math.max(1.6, row.Range || 1.2),
    },
  });

  e.attributeSystem!.setValue('isFemale', 0);
  e.attributeSystem!.setValue('isFlying', 0);
  e.attributeSystem!.setValue('totalMovementSpeed', Math.max(2, row.MoveSpeed));

  return e;
}
