import {
  Constants,
  CreatePlane,
  Matrix,
  StandardMaterial,
  type Mesh,
} from '../libs/babylon/exports';
import type { World } from '../ecs/world';
import { softDot } from './dot';

/** Bao nhiêu bóng vẽ cùng lúc. Người chơi + quái quanh đó. */
const MAX = 40;

/** Xa hơn bấy nhiêu ô thì thôi vẽ bóng (ngoài khung hình rồi). */
const TAM = 22;

/** Nhấc bóng khỏi mặt đất bấy nhiêu để không tranh chấp chiều sâu. */
const NHAC = 0.035;

/** Cập nhật vị trí bóng mỗi bấy nhiêu giây. */
const NHIP = 0.05;

/** Bóng lệch khỏi chân bao nhiêu ô, theo hướng đèn. */
const LECH = 0.3;

/**
 * Bóng đổ của nhân vật và quái xuống mặt đất.
 *
 * VÌ SAO KHÔNG DÙNG ShadowGenerator: mặt đất MU không phải vật liệu tiêu chuẩn
 * mà là một ShaderMaterial với GLSL viết tay (xem src/libs/mu/terrainMaterial.ts)
 * — trong đó không có một dòng nào tính ánh sáng hay lấy mẫu bản đồ bóng. Đặt
 * receiveShadows = true lên nó không có tác dụng gì cả; đã dựng thử bằng
 * ShadowGenerator và mặt đất không hề tối đi. Muốn bóng thật thì phải viết lại
 * chính shader địa hình, việc đó đụng tới cách vẽ toàn bộ mặt đất.
 *
 * CÁCH LÀM Ở ĐÂY: một vệt tròn mềm dưới chân, lệch theo hướng đèn định hướng
 * của cảnh — đúng kiểu bóng bản MU gốc dùng. Toàn bộ bóng nằm trên MỘT mặt
 * phẳng dùng thin instance, nên dù có bốn chục cái vẫn chỉ là MỘT lượt vẽ.
 */
export function createShadows(world: World) {
  let mat: Mesh | null = null;
  let dem = 0;
  const buf = new Float32Array(MAX * 16);
  const m = Matrix.Identity();

  /* Bóng lệch về phía đèn chiếu tới. Hướng lấy từ chính đèn định hướng của
     cảnh chứ không đặt bừa: đổi đèn thì bóng tự đổi theo. */
  let lechX = 0;
  let lechZ = 0;

  function bat() {
    if (mat) return true;
    const scene = world.scene;

    const p = CreatePlane('gfxBlob', { size: 1 }, scene);
    // Nướng phép quay vào luôn đỉnh: thin instance ghi đè ma trận của mesh gốc,
    // để phép quay ở transform thì mỗi bóng lại dựng đứng lên.
    p.rotation.x = Math.PI / 2;
    p.bakeCurrentTransformIntoVertices();

    const vl = new StandardMaterial('gfxBlobMat', scene);
    vl.diffuseColor.set(0, 0, 0);
    vl.specularColor.set(0, 0, 0);
    vl.emissiveColor.set(0, 0, 0);
    vl.ambientColor.set(0, 0, 0);
    vl.disableLighting = true;
    vl.opacityTexture = softDot(scene);
    vl.alpha = 0.5;
    vl.alphaMode = Constants.ALPHA_COMBINE;
    vl.backFaceCulling = false;
    /* KHÔNG freeze() vật liệu này. Đã thử và bóng biến mất hẳn: freeze khoá
       luôn bộ shader đang có, mà lúc đó mesh chưa hề được vẽ nên chưa có định
       nghĩa THIN_INSTANCES — khoá xong là mọi bóng đều dựng bằng ma trận của
       mesh gốc, tức chồng hết lên nhau ở gốc toạ độ. */

    p.material = vl;
    p.isPickable = false;
    p.alwaysSelectAsActiveMesh = true;
    // Không ghi chiều sâu: bóng nằm sát đất, ghi vào là nhân vật đứng trên nó
    // bị cắt mất chân.
    p.material.zOffset = -2;
    p.thinInstanceSetBuffer('matrix', buf, 16, false);
    p.thinInstanceCount = 0;

    const den: any = scene.lights.find(
      (l: any) => l.getClassName?.() === 'DirectionalLight'
    );
    const d = den?.direction;
    const ngang = d ? Math.hypot(d.x, d.z) : 0;
    if (ngang > 1e-4) {
      lechX = (d.x / ngang) * LECH;
      lechZ = (d.z / ngang) * LECH;
    }

    mat = p;
    return true;
  }

  function tat() {
    mat?.material?.dispose();
    mat?.dispose();
    mat = null;
    dem = 0;
  }

  /** Đặt một bóng vào bộ đệm: to bằng `to`, nằm ở (x, y, z). */
  function datBong(x: number, y: number, z: number, to: number) {
    if (dem >= MAX) return;
    Matrix.ScalingToRef(to, 1, to, m);
    m.setTranslationFromFloats(x + lechX, y + NHAC, z + lechZ);
    m.copyToArray(buf, dem * 16);
    dem++;
  }

  let hen = 0;

  return {
    bat,
    tat,
    get on() {
      return !!mat;
    },
    update(dt: number) {
      if (!mat) return;
      hen -= dt;
      if (hen > 0) return;
      hen = NHIP;

      dem = 0;

      const p = world.playerEntity;
      const pos = p?.transform.pos;
      if (pos) datBong(pos.x, pos.y, pos.z, 1.15);

      if (pos) {
        for (const e of world.with('monster', 'transform')) {
          if (e.monster.state === 'dead') continue;
          const q = e.transform.pos;
          if (Math.hypot(q.x - pos.x, q.z - pos.z) > TAM) continue;
          // Quái to nhỏ khác nhau; lấy theo tỉ lệ model đã đặt lúc đẻ.
          datBong(q.x, q.y, q.z, 0.95 * (e.transform.scale || 1));
        }
        for (const e of world.with('npcType', 'transform')) {
          const q = e.transform.pos;
          if (Math.hypot(q.x - pos.x, q.z - pos.z) > TAM) continue;
          datBong(q.x, q.y, q.z, 1.1);
        }
      }

      mat.thinInstanceBufferUpdated('matrix');
      mat.thinInstanceCount = dem;
    },
  };
}
