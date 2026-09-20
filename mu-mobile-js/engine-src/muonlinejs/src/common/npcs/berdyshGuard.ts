import type { Entity, World } from '../../ecs/world';
import { loadGLTF } from '../modelLoader';
import { PlayerAction } from '../objects/enum';
import { PlayerObject } from '../playerObject';

// [NpcInfo(249, "Berdysh Guard")]
export class BerdyshGuard extends PlayerObject {
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

    // Weapon1.Type = (int)ModelType.Spear + 6 + MODEL_ITEM; // Berdysh

    this.CurrentAction = PlayerAction.PLAYER_STOP_MALE;
    world.removeComponent(entity, 'monsterAnimation');
  }
  // protected override void HandleClick() { }
}
