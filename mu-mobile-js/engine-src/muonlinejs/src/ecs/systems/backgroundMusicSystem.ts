import { ENUM_WORLD } from '../../common';
import { ENABLE_BG_MUSIC } from '../../consts';
import { EventBus } from '../../libs/eventBus';
import { Sounds, SoundsManager } from '../../libs/soundsManager';
import type { ISystemFactory } from '../world';

const MUSIC_DELAY = 1;

export const BackgroundMusicSystem: ISystemFactory = world => {
  let delay = 0;

  // stop bg music
  EventBus.on('requestWarp', () => {
    SoundsManager.stopAllMusic();
  });

  EventBus.on('warpCompleted', () => {
    delay = MUSIC_DELAY;
  });

  return {
    update: dt => {
      delay -= dt;

      if (delay > 0) return;

      if (!SoundsManager.pageInteracted) return;
      if (!world.terrain) return;

      delay = Infinity;

      const map = world.mapIndex;

      let sound: Sounds = 'Music/MuTheme';

      switch (map) {
        case ENUM_WORLD.WD_0LORENCIA:
          sound = 'Music/main_theme';
          break;
        case ENUM_WORLD.WD_3NORIA:
          sound = 'Music/Noria';
          break;
        case ENUM_WORLD.WD_2DEVIAS:
          sound = 'Music/Devias';
          break;
        case ENUM_WORLD.WD_4LOSTTOWER:
          sound = 'Music/lost_tower_a';
          break;
        case ENUM_WORLD.WD_7ATLANSE:
          sound = 'Music/atlans';
          break;
        case ENUM_WORLD.WD_8TARKAN:
          sound = 'Music/tarkan';
          break;
        case ENUM_WORLD.WD_1DUNGEON:
          sound = 'Music/Dungeon';
          break;
      }

      SoundsManager.loadAndPlaySoundEffect(sound);

      SoundsManager.musicTrack!.setVolume(
        ENABLE_BG_MUSIC ? SoundsManager.musicVolume : 0
      );
      SoundsManager.effectsTrack!.setVolume(SoundsManager.effectsVolume);
    },
  };
};
