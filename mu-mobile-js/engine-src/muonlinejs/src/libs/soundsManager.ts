import '@babylonjs/core/Audio/audioSceneComponent';
import { Sound } from '@babylonjs/core/Audio/sound';
import { SoundTrack } from '@babylonjs/core/Audio/soundTrack';
import { Engine, PointerEventTypes, type Scene } from './babylon/exports';
import soundsJson from '../common/sounds.json';
import { resolveUrlToDataFolder } from '../common/resolveUrlToDataFolder';
import { wait } from './utils';

type Sounds = keyof typeof soundsJson;

const getSoundUrls = (key: Sounds) => {
  return resolveUrlToDataFolder(soundsJson[key]);
};

export const MUSIC_TRACK_ID = 1000;
export const SOUND_TRACK_ID = 1001;

const sounds = new Map<Sounds, Sound>();

const createSound = (
  key: Sounds,
  scene: Scene,
  track: SoundTrack,
  opts: {
    loop?: boolean;
    volume?: number;
    playbackRate?: number;
    autoplay?: boolean;
  } = {}
) => {
  const s = new Sound(key, getSoundUrls(key), scene, () => {}, {});
  const { loop = false, volume = 1, playbackRate = 1, autoplay = false } = opts;
  s.loop = loop;
  s.autoplay = autoplay;
  s.setVolume(volume);
  s.setPlaybackRate(playbackRate);

  track.addSound(s);

  sounds.set(key, s);

  return s;
};

export { Sounds };

export class SoundsManager {
  static readonly musicVolume = 0.5;
  static readonly effectsVolume = 0.6;

  static musicTrack: SoundTrack | null = null;
  static effectsTrack: SoundTrack | null = null;

  static scene: Scene | null = null;

  static pageInteracted = false;

  static {
    //@ts-ignore
    typeof window !== 'undefined' && (window.__soundsManager = SoundsManager);
  }

  static initializeSounds(scene: Scene) {
    this.scene = scene;

    if (this.musicTrack) {
      this.musicTrack.dispose();
    }
    this.musicTrack = new SoundTrack(scene, {
      volume: 0,
    });
    this.musicTrack.id = MUSIC_TRACK_ID;

    if (this.effectsTrack) {
      this.effectsTrack.dispose();
    }
    this.effectsTrack = new SoundTrack(scene, {
      volume: 0,
    });
    this.effectsTrack.id = SOUND_TRACK_ID;

    if (
      Engine.audioEngine &&
      Engine.audioEngine.onAudioUnlockedObservable &&
      !this.pageInteracted
    ) {
      Engine.audioEngine.onAudioUnlockedObservable.addOnce(() => {
        console.log(`sounds inited`);

        this.pageInteracted = true;
      });
    }

    const sub = scene.onPointerObservable.add(ev => {
      if (this.pageInteracted) return;
      if (ev.type !== PointerEventTypes.POINTERUP) return;

      try {
        Engine.audioEngine && Engine.audioEngine.unlock();
      } catch (e) {
        console.error(e);
      }

      sub && sub.remove();
    });
  }

  static async loadSounds() {
    while (
      !this.pageInteracted ||
      !this.scene ||
      !this.effectsTrack ||
      !this.musicTrack
    ) {
      await wait(1000);
    }

    Object.keys(soundsJson).forEach(key => {
      const s = key as Sounds;
      createSound(
        s,
        this.scene!,
        s.startsWith('Music/') ? this.musicTrack! : this.effectsTrack!
      );
    });
  }

  static dispose() {
    if (this.musicTrack) {
      this.musicTrack.dispose();
      this.musicTrack = null;
    }
    if (this.effectsTrack) {
      this.effectsTrack.dispose();
      this.effectsTrack = null;
    }

    [...sounds.values()].forEach(s => {
      s.pause();
      s.dispose();
    });

    sounds.clear();

    this.scene = null;
  }

  static isLoaded(key: Sounds) {
    return sounds.has(key);
  }

  static loadSound(key: Sounds) {
    const s = sounds.get(key);
    if (s) return s;
    return createSound(
      key,
      this.scene!,
      key.startsWith('Music/') ? this.musicTrack! : this.effectsTrack!
    );
  }

  static playSoundEffect(key: Sounds) {
    if (!this.pageInteracted) return;

    const s = sounds.get(key);

    if (s) {
      s.play(0, 0);
    }

    return s;
  }

  static loadAndPlaySoundEffect(key: Sounds) {
    if (!this.pageInteracted) return;

    const s = this.loadSound(key);
    s.autoplay = true;
    s.play();
    return s;
  }

  static stopSoundEffect(key: Sounds) {
    const s = sounds.get(key);

    if (s) {
      s.pause();
    }

    return s;
  }

  static isPlaying(key: Sounds): boolean {
    const s = sounds.get(key);
    if (!s) return false;
    return s.isPlaying;
  }

  static getSound(key: Sounds) {
    return sounds.get(key);
  }

  static stopAllMusic() {
    this.musicTrack?.soundCollection.forEach(s => {
      s.stop();
    });
  }

  static stopAllEffects() {
    this.effectsTrack?.soundCollection.forEach(s => {
      s.stop();
    });
  }

  static stopAll() {
    this.stopAllMusic();
    this.stopAllEffects();
  }
}
