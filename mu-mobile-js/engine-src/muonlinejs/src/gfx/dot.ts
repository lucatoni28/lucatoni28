import { RawTexture, type Scene } from '../libs/babylon/exports';

/**
 * Chấm tròn mềm sinh bằng mã, dùng chung cho hạt bụi và ngọn lửa.
 *
 * Sinh tại chỗ chứ không nạp file: một là khỏi thêm asset vào bộ 11.996 file,
 * hai là chế độ zip không phải bung thêm gì. 32×32 RGBA là 4 KB.
 */
let cache: RawTexture | null = null;

export function softDot(scene: Scene): RawTexture {
  if (cache) return cache;

  const N = 32;
  const data = new Uint8Array(N * N * 4);
  const c = (N - 1) / 2;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const d = Math.hypot(x - c, y - c) / c;
      // Tắt dần theo bình phương: giữa đặc, mép tan hẳn, không viền răng cưa.
      const a = d >= 1 ? 0 : Math.round(255 * (1 - d) * (1 - d));
      const i = (y * N + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = a;
    }
  }

  cache = RawTexture.CreateRGBATexture(data, N, N, scene, true, false);
  cache.name = 'gfxSoftDot';
  return cache;
}
