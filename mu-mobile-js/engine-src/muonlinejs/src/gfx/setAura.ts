import {
  Constants,
  CreatePlane,
  Matrix,
  StandardMaterial,
  type Mesh,
} from '../libs/babylon/exports';
import type { World } from '../ecs/world';
import { gearSet } from '../offline/combatFormulas';
import { softDot } from './dot';

/** Số đom đóm bay quanh người. */
const COUNT = 22;

/** Bán kính vòng bay, tính bằng ô. */
const R_MIN = 0.7;
const R_MAX = 1.15;

/** Cao thấp của vòng bay so với chân nhân vật. */
const Y_MIN = 0.15;
const Y_MAX = 1.75;

/** Vòng/giây. */
const SPEED = 0.42;

/**
 * Vòng sáng đom đóm bay quanh người khi mặc ĐỦ BỘ (5/5).
 *
 * Điều kiện lấy từ chính gearSet() — cùng hàm mà phòng thủ dùng để cộng thưởng
 * bộ, nên thấy vòng sáng là chắc chắn đang thật sự được thưởng, không phải hiệu
 * ứng trang trí rời.
 *
 * Rẻ: toàn bộ 22 đốm nằm trên MỘT mặt phẳng dùng thin instance nên chỉ một
 * lượt vẽ; vị trí tính bằng lượng giác chứ không nuôi hệ hạt.
 */
export function createSetAura(world: World) {
  let mesh: Mesh | null = null;
  const buf = new Float32Array(COUNT * 16);
  const m = Matrix.Identity();
  const co = Matrix.Identity();   // ma trận tỉ lệ tạm
  const quay = Matrix.Identity(); // phần quay của camera
  let t = 0;

  /* Mỗi đốm một pha, một bán kính, một độ cao, một nhịp nhấp nháy riêng — đặt
     cố định lúc dựng để vòng sáng không giật mỗi khung. */
  const dot = Array.from({ length: COUNT }, (_, i) => ({
    pha: (i / COUNT) * Math.PI * 2 + Math.random() * 0.5,
    r: R_MIN + Math.random() * (R_MAX - R_MIN),
    y: Y_MIN + Math.random() * (Y_MAX - Y_MIN),
    nhip: 1.6 + Math.random() * 2.4,
    // Một phần bay ngược chiều cho vòng sáng có chiều sâu.
    chieu: Math.random() < 0.3 ? -1 : 1,
    caoDao: 0.1 + Math.random() * 0.28,
  }));

  function bat() {
    if (mesh) return true;
    const scene = world.scene;

    const p = CreatePlane('gfxSetAura', { size: 1 }, scene);
    /* KHÔNG dùng p.billboardMode. Đã thử và đốm sáng không hiện lên hình: thin
       instance mang ma trận riêng, ghi đè luôn ma trận thế giới của mesh, nên
       phép quay billboard của Babylon bị bỏ qua và tấm phẳng nằm nghiêng cạnh
       về phía camera — nhìn từ trên xuống thì mỏng như tờ giấy, coi như vô
       hình. Phần quay được nhân tay vào từng ma trận ở update(). */

    const vl = new StandardMaterial('gfxSetAuraMat', scene);
    vl.disableLighting = true;
    vl.diffuseColor.set(0, 0, 0);
    vl.specularColor.set(0, 0, 0);
    vl.emissiveColor.set(1, 0.88, 0.52);
    vl.emissiveTexture = softDot(scene);
    vl.opacityTexture = softDot(scene);
    vl.alpha = 0.9;
    vl.alphaMode = Constants.ALPHA_ADD;
    vl.backFaceCulling = false;

    p.material = vl;
    p.isPickable = false;
    p.alwaysSelectAsActiveMesh = true;
    p.thinInstanceSetBuffer('matrix', buf, 16, false);
    p.thinInstanceCount = 0;

    mesh = p;
    return true;
  }

  function tat() {
    mesh?.material?.dispose();
    mesh?.dispose();
    mesh = null;
  }

  return {
    bat,
    tat,
    get on() {
      return !!mesh;
    },
    update(dt: number) {
      if (!mesh) return;
      t += dt;

      const p = world.playerEntity?.transform.pos;
      // Chỉ hiện khi đủ 5/5 mảnh bộ.
      const du = !!p && gearSet().count >= 5;
      if (!du) {
        mesh.thinInstanceCount = 0;
        return;
      }

      /* Lấy phần quay của camera một lần cho cả vòng: nhân vào từng đốm là
         mỗi tấm phẳng quay đúng mặt về ống kính. */
      const cam = world.scene.activeCamera;
      if (cam) cam.getWorldMatrix().getRotationMatrixToRef(quay);

      for (let i = 0; i < COUNT; i++) {
        const d = dot[i];
        const a = d.pha + t * SPEED * Math.PI * 2 * d.chieu;
        // Nhấp nháy bằng cỡ hạt, không đổi alpha: alpha chung cho cả mặt phẳng
        // nên đổi là cả vòng sáng cùng nháy một nhịp, nhìn giả.
        /* Cỡ đốm. Bản đầu để 0,055–0,09 ô và ĐO ĐƯỢC là không thấy gì: một ô
           bằng chiều ngang nhân vật, nên đốm cỡ ấy chỉ còn ba điểm ảnh trên
           màn. 0,13–0,25 ô mới ra đúng cỡ con đom đóm. */
        const to = 0.13 + 0.12 * (0.5 + 0.5 * Math.sin(t * d.nhip + d.pha));
        Matrix.ScalingToRef(to, to, to, co);
        co.multiplyToRef(quay, m);
        m.setTranslationFromFloats(
          p!.x + Math.cos(a) * d.r,
          p!.y + d.y + Math.sin(t * d.nhip * 0.6 + d.pha) * d.caoDao,
          p!.z + Math.sin(a) * d.r
        );
        m.copyToArray(buf, i * 16);
      }

      mesh.thinInstanceBufferUpdated('matrix');
      mesh.thinInstanceCount = COUNT;
    },
  };
}
