import { World } from '../../ecs/world';
import { loadGLTF } from '../modelLoader';
import { MonsterObject } from '../monsterObject';
import { MonsterActionType } from '../objects/enum';

// [NpcInfo(3, "Spider")]
export class Spider extends MonsterObject {
  static {
    Spider.OverrideScale = 0.4;
  }

  async init(world: World) {
    const bmd = await loadGLTF('Monster/Monster10.glb', world);

    super.load(bmd);

    this.setActionSpeed(MonsterActionType.Walk, 1.2);
    this.setActionSpeed(MonsterActionType.Attack1, 1.2);
  }
}
