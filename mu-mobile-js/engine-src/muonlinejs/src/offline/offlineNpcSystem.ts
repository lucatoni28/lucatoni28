import { Vector3 } from '../libs/babylon/exports';
import { EventBus } from '../libs/eventBus';
import { Store } from '../store';
import { ModelFactoryPerId } from '../common/modelFactoryPerId';
import { MonsterActionType } from '../common/objects/enum';
import { TERRAIN_SIZE, TWFlags } from '../common/terrain/consts';
import { isFlagInBinaryMask } from '../common/utils';
import type { ISystemFactory, World } from '../ecs/world';
import { monsterById } from './monsterData';

/**
 * Thả NPC vào vùng an toàn của thị trấn.
 *
 * Mười một id dưới đây là toàn bộ NPC đã có mesh đúng trong
 * src/common/modelFactoryPerId.ts. Tên lấy từ monsters.json.
 *
 * Vị trí KHÔNG phải toạ độ gốc của MU — bảng đó nằm ở server, không có trong
 * repo. Ở đây bốc ô ngẫu nhiên trong vùng có cờ SafeZone của chính địa hình,
 * nên NPC luôn đứng trong làng dù là bản đồ nào.
 */
const NPC_IDS = [226, 236, 240, 247, 249, 251, 254, 255, 257, 371, 375];

const MAX_TRIES = 200;

/** Đứng cách nhau ít nhất bấy nhiêu ô cho khỏi chồng người. */
const MIN_CACH_NHAU = 4;

/** Không đứng đè lên chỗ người chơi vừa vào. */
const MIN_CACH_NGUOI = 5;

function spotTrongLang(
  world: World,
  daDung: { x: number; y: number }[]
): { x: number; y: number } | null {
  const p0 = world.playerEntity?.transform.pos;

  for (let i = 0; i < MAX_TRIES; i++) {
    const x = 1 + ((Math.random() * (TERRAIN_SIZE - 2)) | 0);
    const y = 1 + ((Math.random() * (TERRAIN_SIZE - 2)) | 0);

    if (!world.isWalkable(x, y)) continue;
    if (!isFlagInBinaryMask(world.getTerrainFlag(x, y), TWFlags.SafeZone)) continue;
    if (p0 && Math.hypot(p0.x - x, p0.z - y) < MIN_CACH_NGUOI) continue;
    if (daDung.some(p => Math.hypot(p.x - x, p.y - y) < MIN_CACH_NHAU)) continue;

    return { x, y };
  }
  return null;
}

export const OfflineNpcSystem: ISystemFactory = world => {
  const query = world.with('npcMark', 'transform');
  let daDat = false;

  EventBus.on('warpCompleted', () => {
    for (const e of [...query]) world.remove(e);
    daDat = false;
  });

  return {
    update: () => {
      if (!Store.isOffline) return;
      if (!world.terrain) return;
      if (daDat) return;

      daDat = true;
      const cho: { x: number; y: number }[] = [];

      for (const id of NPC_IDS) {
        const modelFactory = ModelFactoryPerId[id];
        if (!modelFactory) continue;

        const spot = spotTrongLang(world, cho);
        if (!spot) continue;
        cho.push(spot);

        world.add({
          worldIndex: world.mapIndex,
          npcMark: true as const,
          transform: {
            pos: new Vector3(
              spot.x,
              world.getTerrainHeight(spot.x, spot.y),
              spot.y
            ),
            rot: new Vector3(0, Math.random() * Math.PI * 2, 0),
            scale:
              modelFactory.OverrideScale >= 0 ? modelFactory.OverrideScale : 1,
            posOffset: new Vector3(0.5, 0, 0.5),
          },
          modelFactory,
          monsterAnimation: { action: MonsterActionType.Stop1 },
          visibility: { lastChecked: 0, state: 'hidden' as const },
          screenPosition: { worldOffsetZ: 2.5, x: 0, y: 0 },
          objectNameInWorld: monsterById(id)?.Name ?? `NPC ${id}`,
          interactable: true as const,
        });
      }
    },
  };
};
