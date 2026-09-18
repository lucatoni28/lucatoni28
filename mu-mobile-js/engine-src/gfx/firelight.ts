import {
  Color4,
  Constants,
  CreatePlane,
  Matrix,
  ParticleSystem,
  StandardMaterial,
  Vector3,
  type Mesh,
} from '../libs/babylon/exports';
import type { World } from '../ecs/world';
import { softDot } from './dot';

/**
 * Vật thể có lửa trong Lorencia, tra theo modelId của ô bản đồ.
 *
 * Bốn lớp này trong nguồn gốc đều có dòng `// LightEnabled = true;` bị chú
 * thích lại — bản gốc MU có đánh dấu chúng là nguồn sáng nhưng bản web chưa
 * làm. Số hiệu lấy đúng từ src/maps/lorencia/index.ts:
 *   50–51 FireLightObject · 52 BonfireObject · 90 StreetLightObject
 *   130–132 LightObject   · 150 CandleObject
 *
 * cao  — ngọn lửa cách gốc vật bao nhiêu ô
 * xa   — bề rộng vũng sáng dưới đất
 * to   — cỡ ngọn lửa
 */
const LUA: Record<number, { cao: number; xa: number; to: number }> = {
  50: { cao: 1.75, xa: 3.4, to: 0.5 },
  51: { cao: 1.75, xa: 3.4, to: 0.5 },
  52: { cao: 0.55, xa: 4.6, to: 0.95 },
  90: { cao: 2.55, xa: 3.8, to: 0.42 },
  130: { cao: 1.2, xa: 2.8, to: 0.34 },
  131: { cao: 1.2, xa: 2.8, to: 0.34 },
  132: { cao: 1.2, xa: 2.8, to: 0.34 },
  150: { cao: 0.62, xa: 1.9, to: 0.2 },
};

/** Bao nhiêu ngọn lửa gần nhất được vẽ. */
const SO_LUA = 6;

/** Bao xa thì thôi không tính tới (ô). */
const TAM = 26;

/** Quét lại danh sách mỗi bấy nhiêu giây. */
const QUET = 0.7;

type Ngon = {
  x: number;
  y: number;
  z: number;
  cf: { cao: number; xa: number; to: number };
  pha: number;
};

/**
 * Ánh lửa nhấp nháy từ đuốc, đèn đường, đống lửa, nến.
 *
 * KHÔNG DÙNG ĐÈN CỦA BABYLON. Bản đầu có dùng PointLight và hỏng nặng: thêm
 * hay bớt một đèn là Babylon đánh dấu BẨN toàn bộ vật liệu trong cảnh để dựng
 * lại shader, mà vật liệu nhân vật lại đang bị freeze() (xem getMaterial()
 * trong src/common/modelLoader.ts) — kết quả là texture không bao giờ gắn lại
 * được và cả nhân vật lẫn quái trắng bệch. Đã dựng thử và chụp ảnh đối chứng:
 * ba hiệu ứng kia giữ nguyên màu, riêng bản dùng đèn thì trắng hết.
 *
 * Cách làm thay thế: một vũng sáng ấm trộn kiểu CỘNG hắt xuống đất dưới mỗi
 * ngọn lửa, cộng với chùm hạt lửa. Nhìn ra đúng thứ cần thấy, lại chỉ tốn thêm
 * MỘT lượt vẽ cho tất cả các vũng sáng nhờ thin instance, và không đụng gì tới
 * vật liệu của cảnh.
 */
export function createFirelight(world: World) {
  let vung: Mesh | null = null;
  let ps: ParticleSystem[] = [];
  let dsNgon: Ngon[] = [];
  const buf = new Float32Array(SO_LUA * 16);
  const m = Matrix.Identity();
  let hen = 0;
  let t = 0;

  function moiVung() {
    const scene = world.scene;
    const p = CreatePlane('gfxFireGlow', { size: 1 }, scene);
    p.rotation.x = Math.PI / 2;
    p.bakeCurrentTransformIntoVertices();

    const vl = new StandardMaterial('gfxFireGlowMat', scene);
    vl.disableLighting = true;
    vl.diffuseColor.set(0, 0, 0);
    vl.specularColor.set(0, 0, 0);
    vl.emissiveColor.set(1, 0.55, 0.18);
    vl.emissiveTexture = softDot(scene);
    vl.opacityTexture = softDot(scene);
    vl.alpha = 0.55;
    vl.alphaMode = Constants.ALPHA_ADD;
    vl.backFaceCulling = false;

    p.material = vl;
    p.isPickable = false;
    p.alwaysSelectAsActiveMesh = true;
    p.material.zOffset = -3;
    p.thinInstanceSetBuffer('matrix', buf, 16, false);
    p.thinInstanceCount = 0;
    vung = p;
  }

  /** Một chùm hạt lửa. Tạo đúng SO_LUA chùm rồi dùng lại, không tạo đi tạo lại. */
  function moiHat(i: number) {
    const scene = world.scene;
    const h = new ParticleSystem('gfxFlame' + i, 26, scene);
    h.particleTexture = softDot(scene);
    h.emitter = new Vector3(0, -1000, 0);
    h.minEmitBox = new Vector3(-0.05, 0, -0.05);
    h.maxEmitBox = new Vector3(0.05, 0.05, 0.05);

    h.color1 = new Color4(1, 0.72, 0.24, 0.85);
    h.color2 = new Color4(1, 0.36, 0.06, 0.7);
    h.colorDead = new Color4(0.35, 0.07, 0, 0);

    h.minSize = 0.16;
    h.maxSize = 0.42;
    h.minLifeTime = 0.28;
    h.maxLifeTime = 0.62;
    h.emitRate = 34;
    h.blendMode = ParticleSystem.BLENDMODE_ADD;
    h.gravity = new Vector3(0, 0.9, 0);
    h.direction1 = new Vector3(-0.12, 1, -0.12);
    h.direction2 = new Vector3(0.12, 1.6, 0.12);
    h.minEmitPower = 0.25;
    h.maxEmitPower = 0.7;
    h.updateSpeed = 0.016;
    h.start();
    return h;
  }

  /** Tìm lại các vật có lửa quanh người chơi. Chỉ ĐỔI VỊ TRÍ, không tạo mới. */
  function xepLai() {
    const p = world.playerEntity?.transform.pos;
    if (!p) return;

    const gan: { e: any; d: number; cf: any }[] = [];
    for (const e of world.with('modelId', 'transform')) {
      const cf = LUA[e.modelId as number];
      if (!cf) continue;
      if (e.worldIndex !== world.mapIndex) continue;
      const d = Math.hypot(e.transform.pos.x - p.x, e.transform.pos.z - p.z);
      if (d > TAM) continue;
      gan.push({ e, d, cf });
    }
    gan.sort((a, b) => a.d - b.d);

    dsNgon = gan.slice(0, SO_LUA).map((g, i) => ({
      x: g.e.transform.pos.x,
      y: g.e.transform.pos.y,
      z: g.e.transform.pos.z,
      cf: g.cf,
      pha: i * 1.7,
    }));

    for (let i = 0; i < ps.length; i++) {
      const n = dsNgon[i];
      const e = ps[i].emitter as Vector3;
      if (n) {
        e.set(n.x, n.y + n.cf.cao, n.z);
        ps[i].minSize = 0.16 * n.cf.to;
        ps[i].maxSize = 0.42 * n.cf.to;
        ps[i].minEmitPower = 0.25 * n.cf.to;
        ps[i].maxEmitPower = 0.7 * n.cf.to;
      } else {
        // Không có ngọn nào cho chùm này thì đẩy xuống dưới bản đồ cho khuất.
        e.set(0, -1000, 0);
      }
    }
  }

  return {
    bat() {
      if (vung) return true;
      moiVung();
      ps = Array.from({ length: SO_LUA }, (_, i) => moiHat(i));
      hen = 0;
      return true;
    },

    tat() {
      for (const h of ps) h.dispose();
      ps = [];
      vung?.material?.dispose();
      vung?.dispose();
      vung = null;
      dsNgon = [];
    },

    get on() {
      return !!vung;
    },

    update(dt: number) {
      if (!vung) return;
      t += dt;

      hen -= dt;
      if (hen <= 0) {
        hen = QUET;
        xepLai();
      }

      // Nhấp nháy: hai sóng sin lệch tần số, không dùng random để khỏi giật.
      let dem = 0;
      for (const n of dsNgon) {
        const f =
          0.84 + 0.12 * Math.sin(t * 8.3 + n.pha) + 0.08 * Math.sin(t * 19.7 + n.pha * 2);
        const to = n.cf.xa * f;
        Matrix.ScalingToRef(to, 1, to, m);
        m.setTranslationFromFloats(n.x, n.y + 0.05, n.z);
        m.copyToArray(buf, dem * 16);
        dem++;
      }
      vung.thinInstanceBufferUpdated('matrix');
      vung.thinInstanceCount = dem;
    },
  };
}
