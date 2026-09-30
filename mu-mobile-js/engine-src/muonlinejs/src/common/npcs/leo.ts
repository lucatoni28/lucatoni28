import type { Entity, World } from '../../ecs/world';
import { loadGLTF } from '../modelLoader';
import { PlayerAction } from '../objects/enum';
import { PlayerObject } from '../playerObject';

// [NpcInfo(371, "Leo the Helper")]
export class Leo extends PlayerObject {
  async init(world: World, entity: Entity) {
    this.load(await loadGLTF('Player/player.glb', world));

    this.setBodyPartsAsync(
      'Player/',
      'HelmMale',
      'ArmorMale',
      'PantMale',
      'GloveMale',
      'BootMale',
      10
    );

    this.CurrentAction = PlayerAction.PLAYER_STOP_MALE;
    world.removeComponent(entity, 'monsterAnimation');
  }
  // protected override void HandleClick() { }
}
