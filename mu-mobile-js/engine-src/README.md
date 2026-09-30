# Nguồn engine

`muonlinejs/` là nguồn đầy đủ của `afrokick/muonlinejs`, **đã vá sẵn**. Không
phải clone từ đâu nữa — sửa ở đây rồi dựng lại là xong.

## Dựng lại `js/engine.js` và `js/babylon.js`

```bash
cd engine-src/muonlinejs && bun install
cd ../.. && node tools/dung-engine.mjs
```

`bun install` là bước duy nhất cần mạng: 137 gói npm. Dựng xong thì không.

`tools/dung-engine.mjs` dựng với `minify: false`, đổi tên chunk, thay các chuỗi
CDN mà Babylon nhúng sẵn trong gói npm, rồi **tự kiểm**: còn địa chỉ mạng hay
còn `new WebSocket` trong mã chạy là nó báo lỗi và dừng.

## Đã sửa gì so với bản gốc

**Gỡ hẳn lớp kết nối máy chủ.**

| File | Sửa |
|---|---|
| `src/libs/sockets/createSocket.ts` | `createSocket()` ném lỗi thay vì mở WebSocket tới `ws://localhost:3000` |
| `src/store.ts` | bỏ `playOnline()` |
| `src/ui/pages/preloaderPage/index.tsx` | bỏ nút "Play Online" |
| `src/libs/babylon/utils.ts` | bỏ phím tắt nạp Babylon Inspector từ CDN |
| `src/common/resolveUrlToDataFolder.ts` | bỏ nhánh cho URL tuyệt đối đi qua |

**Nối vào lớp giao diện.**

| Chỗ | File |
|---|---|
| Đường dẫn asset | `src/common/resolveUrlToDataFolder.ts` |
| Tiền tố decoder Babylon | `src/libs/babylon/exports.ts` |
| Đường dẫn icon vật phẩm | `src/ui/components/itemIcon/index.tsx` |
| `__store`, `__eventBus` | `src/main.tsx` |

**Thêm mới.**

- `src/offline/` — chiến đấu, đẻ quái, kinh nghiệm, chỉ số vật phẩm, tuỳ chọn Ngọc
- `src/gfx/` — bóng đổ, ánh lửa, bụi, quầng sáng vật phẩm, hào quang bộ đồ

**Sửa lỗi engine.**

- `src/common/modelObject.ts` — `Unload()` không thả mesh, tháo đồ ra vẫn treo trong cảnh
- `src/common/itemMaterial.ts` — hiệu ứng Ngọc/Thần: đỏ tươi, ánh thuỷ tinh, dải tím hồng
- `src/ecs/systems/appearanceSystem.ts` — thay đồ không nháy

## Số liệu lấy từ đâu

- Chỉ số quái: `src/common/monsters.json` — 321 quái
- Sát thương vũ khí, bảng rơi đồ: `src/common/items.json` — 663 món
- Mesh quái: `src/common/modelFactoryPerId.ts` — mới có 4 con. Thêm mesh vào
  bảng đó là con quái tương ứng dùng được ngay.
- Công thức sát thương/phòng thủ/tỉ lệ trúng của người chơi: không có trong
  client, viết theo công thức MU cổ điển — xem `src/offline/combatFormulas.ts`.
