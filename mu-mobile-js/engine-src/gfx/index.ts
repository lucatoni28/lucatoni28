import { SharpenPostProcess } from '../libs/babylon/exports';
import type { World } from '../ecs/world';
import { createDust } from './dust';
import { createFirelight } from './firelight';
import { createSetAura } from './setAura';
import { createShadows } from './shadows';
import { createItemGlow } from './itemGlow';

export type GfxKey =
  | 'shadow'
  | 'sharpen'
  | 'dust'
  | 'firelight'
  | 'setAura'
  | 'itemGlow';

/** Bật sẵn cả bốn: bản dựng này nhắm chất lượng hình cao nhất. */
export const GFX_DEFAULT: Record<GfxKey, boolean> = {
  shadow: true,
  sharpen: true,
  dust: true,
  firelight: true,
  setAura: true,
  /* TẮT SẴN. Đây là lớp tán sáng hậu kỳ (bloom) tôi thêm, không có trong bản
     gốc. Nó nhoè ánh sáng TRÀN RA NGOÀI đường viền món đồ; nhân vật mặc đủ
     bộ +7 trở lên là bảy quầng chồng nhau thành một cục vàng, mất cả hình.
     Hiệu ứng Excellent thật nằm ở shader — xem src/common/itemMaterial.ts,
     phần "ánh cầu vồng chạy trên viền". Mã lớp này giữ nguyên trong
     src/gfx/itemGlow.ts, bật lại được trong HỆ THỐNG nếu muốn. */
  itemGlow: false,
};

/**
 * Bốn hiệu ứng đồ hoạ bật/tắt được, dùng chung một nhịp cập nhật.
 *
 * Lớp giao diện ngoài gọi qua window.__gfx — xem js/store-bridge.js bên
 * mu-mobile. Mỗi hiệu ứng tự dựng khi bật và tự huỷ sạch khi tắt, nên tắt hết
 * là cảnh trở về đúng như bản gốc chưa có thư mục này.
 *
 * Cả bốn đều chọn cách rẻ với GPU:
 *   bóng đổ   một bản đồ bóng 1024, chỉ nhân vật và quái đổ, chỉ đất nhận
 *   làm nét   một lượt hậu kỳ toàn màn, không đọc thêm kết cấu nào
 *   bụi bay   một hệ hạt 110 hạt = MỘT lượt vẽ
 *   ánh lửa   vũng sáng ấm + 6 chùm hạt lửa, không thêm đèn nào
 *   đủ bộ     22 đốm sáng bay quanh người, cũng chỉ MỘT lượt vẽ
 */
export function createGfx(world: World) {
  const scene = world.scene;

  const shadows = createShadows(world);
  const dust = createDust(scene);
  const fire = createFirelight(world);
  const aura = createSetAura(world);
  const glow = createItemGlow(world);

  let sharpen: SharpenPostProcess | null = null;
  let camDaGan: unknown = null;
  let nhipGlow = 0;

  function batSharpen() {
    const cam = scene.activeCamera;
    if (!cam) return false;
    if (sharpen && camDaGan === cam) return true;
    sharpen?.dispose();
    sharpen = new SharpenPostProcess('gfxSharpen', 1, cam);
    // edgeAmount là mức nhấn viền, colorAmount là phần màu gốc giữ lại.
    // 0,28 đủ làm rõ nét chữ và cạnh vật mà chưa sinh quầng trắng quanh viền.
    sharpen.edgeAmount = 0.28;
    sharpen.colorAmount = 1;
    camDaGan = cam;
    return true;
  }

  function tatSharpen() {
    sharpen?.dispose();
    sharpen = null;
    camDaGan = null;
  }

  const state: Record<GfxKey, boolean> = { ...GFX_DEFAULT };

  const api = {
    /** Bật/tắt một hiệu ứng. Trả false nếu chưa dựng được (chưa có camera…). */
    set(key: GfxKey, on: boolean): boolean {
      let ok = true;
      switch (key) {
        case 'shadow':
          ok = on ? shadows.bat() : (shadows.tat(), true);
          break;
        case 'sharpen':
          ok = on ? batSharpen() : (tatSharpen(), true);
          break;
        case 'dust':
          ok = on ? dust.bat() : (dust.tat(), true);
          break;
        case 'firelight':
          ok = on ? fire.bat() : (fire.tat(), true);
          break;
        case 'setAura':
          ok = on ? aura.bat() : (aura.tat(), true);
          break;
        case 'itemGlow':
          ok = on ? glow.bat() : (glow.tat(), true);
          if (ok && on) glow.quet();
          break;
        default:
          return false;
      }
      if (ok) state[key] = on;
      return ok;
    },

    /** Áp lại toàn bộ trạng thái đang chọn. Gọi sau mỗi lần đổi bản đồ. */
    apply() {
      for (const k of Object.keys(state) as GfxKey[]) api.set(k, state[k]);
      return { ...state };
    },

    state() {
      return { ...state };
    },

    update(dt: number) {
      const p = world.playerEntity?.transform.pos;
      if (p) dust.follow(p.x, p.y, p.z);
      shadows.update(dt);
      fire.update(dt);
      aura.update(dt);

      /* Quét lại danh sách món phát sáng mỗi 0,5 giây, không phải mỗi khung:
         thay đồ là việc hiếm, mà duyệt hết mesh trong cảnh thì tốn thật. */
      if (state.itemGlow) {
        nhipGlow += dt;
        if (nhipGlow >= 0.5) {
          nhipGlow = 0;
          glow.quet();
        }
      }
      // Camera có thể bị dựng lại; gắn lại lượt làm nét khi đó.
      if (state.sharpen && scene.activeCamera && camDaGan !== scene.activeCamera) {
        batSharpen();
      }
    },
  };

  return api;
}
