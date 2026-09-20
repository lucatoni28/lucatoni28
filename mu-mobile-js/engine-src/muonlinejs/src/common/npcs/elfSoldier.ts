import type { Entity, World } from '../../ecs/world';
import { Scene, TransformNode } from '../../libs/babylon/exports';
import { getMaterial, loadGLTF } from '../modelLoader';
import { BlendState, ItemGroups, PlayerAction } from '../objects/enum';
import { PlayerObject } from '../playerObject';
import { CharacterClassNumber, PlayerClass } from '../types';

const lvl = 9;
const isExcellent = false;
const RedSpiritIndex = 24;

// [NpcInfo(257, "Elf Soldier")]
export class ElfSoldier extends PlayerObject {
  constructor(scene: Scene, parent: TransformNode) {
    super(scene, parent);

    this.playerClass = PlayerClass.FairyElf;
  }

  async init(world: World, entity: Entity) {
    this.load(await loadGLTF('Player/player.glb', world));

    this.Ready = false;

    world.addComponent(entity, 'charAppearance', {
      charClass: CharacterClassNumber.FairyElf,
      helm: {
        group: ItemGroups.Helm,
        num: RedSpiritIndex,
        lvl,
        isExcellent,
      },
      armor: {
        group: ItemGroups.Armor,
        num: RedSpiritIndex,
        lvl,
        isExcellent,
      },
      pants: {
        group: ItemGroups.Pants,
        num: RedSpiritIndex,
        lvl,
        isExcellent,
      },
      gloves: {
        group: ItemGroups.Gloves,
        num: RedSpiritIndex,
        lvl,
        isExcellent,
      },
      boots: {
        group: ItemGroups.Boots,
        num: RedSpiritIndex,
        lvl,
        isExcellent,
      },
      leftHand: null,
      rightHand: null,
      changed: true,
      wings: null,
    });

    await this.loadPartAsync('Item/', this.Wings, `Wing04.glb`);

    const wingsMesh = this.Wings.getMesh(0);
    if (wingsMesh) {
      wingsMesh.material = getMaterial(
        world.scene,
        false,
        2,
        BlendState.ALPHA_ADD
      );
    }

    // const pantsMaterial = this.Pants.getMaterial(3);
    // if (pantsMaterial) {
    //   wingsMaterial.transparencyMode = 2;
    //   wingsMaterial.alphaMode = 1;
    //   wingsMaterial.alpha = 0.99;
    // }

    this.CurrentAction = PlayerAction.PLAYER_STOP_FLY;
    world.removeComponent(entity, 'monsterAnimation');

    this.Ready = true;
  }
  // protected override void HandleClick() { }
}
