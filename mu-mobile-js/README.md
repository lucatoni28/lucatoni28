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
| `engine-src/` | nguồn engine đã sửa, để dựng lại `js/engine.js` |
| `tools/` | script sinh bảng kê, cắt icon, tải phông |

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

## Dựng lại engine

`js/engine.js` và `js/babylon.js` là bản dựng từ `afrokick/muonlinejs` đã vá.
Cách dựng lại nằm ở `engine-src/README.md`. Dựng với `minify: false` — bản
trong repo này là bản không nén.
