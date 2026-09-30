import { ENUM_WORLD } from '../../common';
import { ENABLE_BG_MUSIC } from '../../consts';
import { EventBus } from '../../libs/eventBus';
import { Sounds, SoundsManager } from '../../libs/soundsManager';
import type { ISystemFactory } from '../world';

const MUSIC_DELAY = 1;

/**
 * Bản đồ → nhạc nền.
 *
 * Mười hai bản đồ dưới đây là toàn bộ số map có asset trong repo
 * (World1,2,3,4,5,7,8,9,10,11,34,52 — chỉ số map = số thư mục trừ 1).
 * Tên nhạc lấy đúng tên file trong assets/game-assets/Music.
 */
const NHAC_THEO_MAP: Partial<Record<number, Sounds>> = {
  [ENUM_WORLD.WD_0LORENCIA]: 'Music/main_theme',
  [ENUM_WORLD.WD_1DUNGEON]: 'Music/Dungeon',
  [ENUM_WORLD.WD_2DEVIAS]: 'Music/Devias',
  [ENUM_WORLD.WD_3NORIA]: 'Music/Noria',
  [ENUM_WORLD.WD_4LOSTTOWER]: 'Music/lost_tower_a',
  [ENUM_WORLD.WD_6STADIUM]: 'Music/DuelArena',
  [ENUM_WORLD.WD_7ATLANSE]: 'Music/atlans',
  [ENUM_WORLD.WD_8TARKAN]: 'Music/tarkan',
  [ENUM_WORLD.WD_9DEVILSQUARE]: 'Music/devil_square_intro',
  [ENUM_WORLD.WD_10ICARUS]: 'Music/icarus',
  [ENUM_WORLD.WD_33AIDA]: 'Music/Aida',
  [ENUM_WORLD.WD_51ELBELAND]: 'Music/elbeland',
};


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

      /* Nhạc nền theo bản đồ. Chỉ khai những map CÓ thư mục asset trong
         assets/game-assets, và chỉ dùng file nhạc CÓ trong assets/game-assets/Music. */
      const sound: Sounds = NHAC_THEO_MAP[map] ?? 'Music/MuTheme';

      SoundsManager.loadAndPlaySoundEffect(sound);

      SoundsManager.musicTrack!.setVolume(
        ENABLE_BG_MUSIC ? SoundsManager.musicVolume : 0
      );
      SoundsManager.effectsTrack!.setVolume(SoundsManager.effectsVolume);
    },
  };
};
