import {
  Color4,
  ParticleSystem,
  Vector3,
  type Scene,
} from '../libs/babylon/exports';
import { softDot } from './dot';

/** Số hạt giữ trong không trung. */
const COUNT = 110;

/** Nửa cạnh khối không gian quanh người chơi mà hạt được rải vào (ô). */
const BOX = 11;

/**
 * Bụi mịn lơ lửng trong không trung.
 *
 * Rẻ vì chỉ MỘT lượt vẽ cho cả 110 hạt: Babylon gom hết vào một bộ đệm đỉnh,
 * GPU vẽ một phát. Không có đèn, không có bóng, trộn màu kiểu cộng.
 *
 * Khối hạt bám theo người chơi thay vì rải khắp bản đồ — rải khắp thì phải
 * nuôi hàng vạn hạt mà mắt vẫn chỉ thấy chừng này.
 */
export function createDust(scene: Scene) {
  let ps: ParticleSystem | null = null;

  return {
    bat() {
      if (ps) return true;

      ps = new ParticleSystem('gfxDust', COUNT, scene);
      ps.particleTexture = softDot(scene);
      ps.emitter = new Vector3(0, 0, 0);
      ps.minEmitBox = new Vector3(-BOX, 0.4, -BOX);
      ps.maxEmitBox = new Vector3(BOX, 7.5, BOX);

      ps.color1 = new Color4(1, 0.95, 0.82, 0.5);
      ps.color2 = new Color4(0.86, 0.9, 1, 0.34);
      ps.colorDead = new Color4(1, 1, 1, 0);

      ps.minSize = 0.035;
      ps.maxSize = 0.085;
      ps.minLifeTime = 6;
      ps.maxLifeTime = 13;
      ps.emitRate = COUNT / 8;

      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.gravity = new Vector3(0, -0.035, 0);
      ps.direction1 = new Vector3(-0.09, 0.05, -0.09);
      ps.direction2 = new Vector3(0.09, 0.16, 0.09);
      ps.minAngularSpeed = 0;
      ps.maxAngularSpeed = 0.7;
      ps.minEmitPower = 0.05;
      ps.maxEmitPower = 0.22;
      ps.updateSpeed = 0.012;

      ps.start();
      return true;
    },

    tat() {
      ps?.dispose();
      ps = null;
    },

    get on() {
      return !!ps;
    },

    /** Dời khối hạt theo người chơi. */
    follow(x: number, y: number, z: number) {
      if (ps) (ps.emitter as Vector3).set(x, y, z);
    },
  };
}
