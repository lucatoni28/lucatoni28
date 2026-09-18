/**
 * Bản dựng cho điện thoại nạp asset từ CDN GitHub hoặc từ thư mục phẳng img/,
 * chứ không phải từ ./game-assets/ cạnh trang. Lớp giao diện đặt sẵn
 * window.MU_ASSETS trước khi engine khởi động; có thì hỏi nó, không có thì giữ
 * nguyên nếp cũ nên bản chạy trên máy tính không đổi gì.
 *
 * Trước đây chỗ này được vá bằng cách tìm-thay chuỗi trong file đã minify. Cách
 * đó gãy ngay lần dựng lại engine đầu tiên vì minifier đổi tên hàm, nên giờ vá
 * thẳng vào nguồn.
 */
export type MuAssets = {
  game(relPath: string): string;
  resolve(logicalPath: string): string;
  readonly itemsBase: string;
  readonly decoderBase: string;
};

declare global {
  interface Window {
    MU_ASSETS?: MuAssets;
  }
}

export function muAssets(): MuAssets | undefined {
  return typeof window !== 'undefined' ? window.MU_ASSETS : undefined;
}

export function resolveUrlToDataFolder(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('base64:')) return url;

  // Remove the leading slash if it exists
  if (url.startsWith('/') || url.startsWith('.')) {
    url = url.substring(1);
  }

  const mu = muAssets();
  if (mu) return mu.game(url);

  return `./game-assets/${url}`;
}
