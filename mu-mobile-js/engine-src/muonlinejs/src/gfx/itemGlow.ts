/**
 * Quầng sáng rực của đồ cường hoá cao.
 *
 * VÌ SAO CẦN THÊM LỚP NÀY: shader trong src/common/itemMaterial.ts chỉ làm
 * SÁNG chính bề mặt món đồ. Muốn "trong suốt sáng rực" — thứ ánh sáng tràn ra
 * ngoài đường viền, phủ lên cả nền phía sau — thì phải có bước hậu kỳ tán
 * sáng, shader bề mặt không làm được. Đó đúng là việc của GlowLayer.
 *
 * CÁCH LÀM RẺ:
 *   – GlowLayer chỉ vẽ những mesh được ĐƯA VÀO danh sách, không quét cả cảnh.
 *   – Danh sách chỉ gồm mesh có mesh.metadata.itemLvl ≥ NGUONG, tức vài món
 *     trên người nhân vật, không phải hàng trăm vật thể trong cảnh.
 *   – blurKernelSize 24 là mức thấp; bản mặc định 32 nặng hơn rõ trên di động.
 *
 * MÀU quầng sáng bám đúng thang trong itemMaterial.ts để trên và ngoài món đồ
 * là một khối thống nhất — sửa một chỗ thì sửa cả hai.
 */

import { Color4, GlowLayer, type Mesh } from '../libs/babylon/exports';
import type { World } from '../ecs/world';

/** Từ cấp này trở lên mới có quầng sáng. Dưới nữa chỉ đổi màu bề mặt. */
const NGUONG = 7;

/** Màu quầng theo cấp, cùng thang với itemMaterial.ts. */
function mauTheoCap(lvl: number, exc: boolean, div: boolean): [number, number, number] {
  // Phẩm cấp thắng cấp cường hoá — giống thứ tự itemRank().
  if (div) return [0.62, 0.35, 1.0]; // tím
  if (exc) return [0.25, 1.0, 0.45]; // lục
  if (lvl >= 15) return [1.0, 0.97, 0.92]; // trắng nóng
  if (lvl >= 10) return [1.0, 0.72, 0.2]; // cam rực
  return [1.0, 0.85, 0.35]; // vàng
}

/** Cường độ theo cấp: +7 mờ, +15 rực nhất. */
function doSang(lvl: number): number {
  if (lvl >= 15) return 1;
  if (lvl >= 13) return 0.8;
  if (lvl >= 11) return 0.62;
  if (lvl >= 9) return 0.45;
  return 0.3;
}

export function createItemGlow(world: World) {
  const scene = world.scene;
  let lop: GlowLayer | null = null;

  /** Mesh nào đang nằm trong lớp sáng — để thêm/bớt cho đúng, khỏi thêm trùng. */
  const dangCo = new Set<Mesh>();

  function bat(): boolean {
    if (lop) return true;
    lop = new GlowLayer('gfxItemGlow', scene, {
      // Nửa độ phân giải là đủ: quầng sáng vốn nhoè, không ai soi từng điểm ảnh.
      mainTextureRatio: 0.5,
      blurKernelSize: 24,
    });
    lop.intensity = 1.1;

    /* Chỉ mesh trong danh sách mới phát sáng. Không đặt hàm này thì GlowLayer
       lấy emissive của MỌI vật liệu trong cảnh — cả bầu trời lẫn mặt đất. */
    lop.customEmissiveColorSelector = (mesh, _sub, _mat, ket) => {
      const md = mesh.metadata;
      const lvl = (md?.itemLvl as number) ?? 0;
      if (lvl < NGUONG) {
        ket.set(0, 0, 0, 0);
        return;
      }
      const [r, g, b] = mauTheoCap(lvl, !!md?.isExcellent, !!md?.isDivine);
      const k = doSang(lvl);
      ket.set(r * k, g * k, b * k, 1);
    };
    return true;
  }

  function tat() {
    lop?.dispose();
    lop = null;
    dangCo.clear();
  }

  /**
   * Quét lại danh sách mesh cần phát sáng.
   *
   * Gọi thưa thôi (xem nhịp bên index.ts): thay đồ là việc hiếm, mà duyệt toàn
   * bộ mesh mỗi khung thì tốn vô ích.
   */
  function quet() {
    if (!lop) return;

    const can = new Set<Mesh>();
    for (const m of scene.meshes) {
      const lvl = (m.metadata?.itemLvl as number) ?? 0;
      if (lvl >= NGUONG) can.add(m as Mesh);
    }

    for (const m of can) {
      if (!dangCo.has(m)) {
        lop.addIncludedOnlyMesh(m);
        dangCo.add(m);
      }
    }
    for (const m of [...dangCo]) {
      if (!can.has(m) || m.isDisposed()) {
        lop.removeIncludedOnlyMesh(m);
        dangCo.delete(m);
      }
    }
  }

  return {
    bat,
    tat,
    quet,
    get soMon() {
      return dangCo.size;
    },
  };
}

export type ItemGlow = ReturnType<typeof createItemGlow>;
export { Color4 };
