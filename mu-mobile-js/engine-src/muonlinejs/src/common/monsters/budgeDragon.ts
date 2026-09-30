import { World } from '../../ecs/world';
import { loadGLTF } from '../modelLoader';
import { MonsterObject } from '../monsterObject';
import { MonsterActionType } from '../objects/enum';

// [NpcInfo(2, "Budge Dragon")]
export class BudgeDragon extends MonsterObject {
  static {
    BudgeDragon.OverrideScale = 0.5;
  }

  async init(world: World) {
    this.load(await loadGLTF('Monster/Monster03.glb', world));

    this.setActionSpeed(MonsterActionType.Walk, 0.7);
  }
}
