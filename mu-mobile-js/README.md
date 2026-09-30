# MU Mobile · Aetherfall

Game MU Online chơi đơn, màn dọc 430 × 932. Mở `index.html` là chạy.

Không có bước dựng. Mọi file đều đọc được nguyên văn: không nén, không gộp,
không sinh mã.

## Cây thư mục

| Thư mục | Nội dung |
|---|---|
| `js/` | mã chạy, module ES. `main.js` là điểm vào |
| `css/` | `aetherfall.css` giao diện · `fonts.css` khai phông |
| `fonts/` | 26 file woff2 giao diện + phông Segoe của MU |
| `ui/` | 9 ảnh giao diện |
| `icons/` | 4 icon vật phẩm đã cắt viền |
| `assets/` | 599 MB asset game — 11.996 file |
| `engine-src/` | nguồn đầy đủ của engine, đã vá sẵn |
| `tools/` | script dựng engine, sinh bảng kê, cắt icon |

## Nguồn nạp

Một đường duy nhất: thư mục `assets/` cạnh `index.html`. Khai ở
`js/asset-paths.js`, một dòng:

```js
export const GOC = 'assets/';
```

Không có chế độ nào khác. Không zip, không CDN, không blob, không thẻ meta chọn
nguồn. Đã quét cả `js/`: không còn một địa chỉ mạng nào trong mã chạy.

## Thứ tự khởi động

`js/main.js` giữ đúng ba bước:

1. `asset-paths.js` đặt `window.MU_ASSETS`
2. `engine.js` dựng cảnh, đặt `window.__store`
3. `app.js` dựng giao diện

## Không có gì nạp từ ngoài

- Không WebSocket, không EventSource, không sendBeacon, không service worker.
- Không cookie, không indexedDB. `localStorage` dùng đúng một khoá `mu.save`
  cho bản lưu game — hiện ngay trên màn khởi đầu, không gửi đi đâu.
- Không móc React DevTools, không móc MobX DevTools.
- Lớp kết nối máy chủ MU đã gỡ khỏi nguồn engine, không phải chặn.
- Nhật ký gỡ lỗi chỉ giữ trong bộ nhớ, mặc định TẮT, bật bằng `?debug=1`.

## Dựng lại engine

Nguồn engine nằm ngay trong `engine-src/muonlinejs/`, không phải clone từ đâu.

```bash
cd engine-src/muonlinejs && bun install
cd ../.. && node tools/dung-engine.mjs
```

`bun install` là bước duy nhất còn cần mạng. Script dựng tự kiểm: còn địa chỉ
mạng hay còn `new WebSocket` trong mã chạy là báo lỗi và dừng.
