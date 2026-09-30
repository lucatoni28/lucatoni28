import { ENUM_WORLD } from '../../common';
import { PlayerAction } from '../../common/objects/enum';
import { Rand } from '../../common/rand';
import { Sounds, SoundsManager } from '../../libs/soundsManager';
import type { World } from '../world';
import type { ISystemFactory } from '../world';

function PlayWalkSound(world: World) {
  const hero = world.playerEntity;
  const heroTile = world.getTerrainTile(
    ~~hero.transform.pos.x,
    ~~hero.transform.pos.z
  );
  const inHellas = false;

  const attSystem = hero.attributeSystem;
  const isFlying = attSystem.isAboveZero('isFlying');
  const map = hero.worldIndex ?? ENUM_WORLD.WD_0LORENCIA;

  if (isFlying) return;

  let sfx: Sounds = 'Sound/pWalk(Soil)';

  if (map === ENUM_WORLD.WD_2DEVIAS && heroTile !== 3 && heroTile < 10) {
    sfx = 'Sound/pWalk(Snow)';
  } else if (map === ENUM_WORLD.WD_0LORENCIA && heroTile === 0) {
    sfx = 'Sound/pWalk(Grass)';
  } else if (map === ENUM_WORLD.WD_3NORIA && heroTile === 0) {
    sfx = 'Sound/pWalk(Grass)';
  } else if (
    (map === ENUM_WORLD.WD_7ATLANSE ||
      inHellas ||
      map === ENUM_WORLD.WD_67DOPPLEGANGER3) &&
    !attSystem.isAboveZero('inSafeZone')
  ) {
    sfx = 'Sound/pSwim';
  }
  // else if (isIceCity)
  // {
  //     PlayBuffer(SOUND_HUMAN_WALK_SNOW);
  // }
  // else if (isSantaTown)
  // {
  //     PlayBuffer(SOUND_HUMAN_WALK_SNOW);
  // }

  const sound = SoundsManager.loadAndPlaySoundEffect(sfx);
  if (sound) {
    sound.setPlaybackRate(Rand.nextFloat(0.95, 1.05));
  }
}

export const WalkSfxSystem: ISystemFactory = world => {
  let foot0 = false;
  let foot1 = false;

  let lastCurrentFrame = 0;

  return {
    update: () => {
      const playerEntity = world.playerEntity;
      if (!playerEntity) return;

      const modelObject = playerEntity.modelObject;
      if (!modelObject) return;

      const animationGroups = modelObject.gltf?.animationGroups;
      if (!animationGroups) return;

      const playerAction = playerEntity.playerAnimation.action;

      const animationGroup = animationGroups[playerAction];
      if (!animationGroup) return;

      const animatable = animationGroup.animatables[0];
      if (!animatable) return;

      const anim = animatable.getAnimations()[0];
      if (!anim) return;

      const currentFrame = anim.currentFrame;

      if (
        (playerAction >= PlayerAction.PLAYER_WALK_MALE &&
          playerAction <= PlayerAction.PLAYER_RUN_RIDE_WEAPON) ||
        playerAction == PlayerAction.PLAYER_WALK_TWO_HAND_SWORD_TWO ||
        playerAction == PlayerAction.PLAYER_RUN_TWO_HAND_SWORD_TWO ||
        playerAction == PlayerAction.PLAYER_RUN_RIDE_HORSE ||
        playerAction == PlayerAction.PLAYER_RAGE_UNI_RUN ||
        playerAction == PlayerAction.PLAYER_RAGE_UNI_RUN_ONE_RIGHT
      ) {
        if (currentFrame < lastCurrentFrame) {
          foot0 = false;
          foot1 = false;
        }

        lastCurrentFrame = currentFrame;
        if (currentFrame >= 1.0 && !foot0) {
          foot0 = true;
          PlayWalkSound(world);
        }
        if (currentFrame >= 9.0 && !foot1) {
          foot1 = true;
          PlayWalkSound(world);
        }
      } else {
        foot0 = false;
        foot1 = false;
        lastCurrentFrame = 0;
      }
    },
  };
};
