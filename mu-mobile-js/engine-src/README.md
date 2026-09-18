# Nguồn engine đã sửa

Toàn bộ phần chơi đơn (đẻ quái, AI, chiến đấu, kinh nghiệm, rơi đồ) nằm trong
mã nguồn TypeScript của engine `afrokick/muonlinejs`, **không phải** trong lớp
giao diện `js/` của dự án này. Thư mục đây là bản sao để không mất khi máy dựng
bị dọn.

## Nội dung

- `offline/` — 8 file MỚI, chép nguyên vào `src/offline/` của muonlinejs
  (chiến đấu, đẻ quái, kinh nghiệm, chỉ số vật phẩm, tuỳ chọn Ngọc)
- `gfx/` — 7 file MỚI, chép nguyên vào `src/gfx/` (bóng đổ, ánh lửa, bụi,
  quầng sáng vật phẩm, hào quang bộ đồ, và bảng bật/tắt trong `index.ts`)
- `patched/` — 17 file CÓ SẴN đã sửa; tên file thay `/` bằng `_`
- `muonlinejs.patch` — bản vá `git diff` của 16 file trong số đó. **Không kèm
  `src/common/items.json`**: file ấy bị định dạng lại toàn bộ nên bản vá sẽ dài
  12.000 dòng vô ích — chép thẳng `patched/src_common_items.json` đè lên.

## Dựng lại

```bash
git clone https://github.com/afrokick/muonlinejs
cd muonlinejs
bun install                       # 137 gói, ~4 giây
git apply /đường/dẫn/muonlinejs.patch
cp /đường/dẫn/engine-src/patched/src_common_items.json src/common/items.json
cp -r /đường/dẫn/engine-src/offline src/offline
cp -r /đường/dẫn/engine-src/gfx     src/gfx
npx vite build                    # ~14 giây
cp dist/assets/index-*.js  <dự-án>/js/engine.js
cp dist/assets/bjs-*.js    <dự-án>/js/babylon.js   # chỉ khi Babylon đổi bản
cd <dự-án> && node tools/build-ios.mjs
```

`tools/build-ios.mjs` kiểm tra engine có đúng ba dấu `MU_ASSETS`, `__store`,
`__eventBus` không; thiếu là dừng ngay chứ không xuất ra file hỏng.

## Vì sao vá ở nguồn chứ không vá file đã minify

Bản trước vá bằng tìm-thay chuỗi trên file đã nén. Dựng lại engine một lần là
gãy: minifier đổi tên hàm `i1` thành tên khác và đổi biến giữ Store từ `v`
sang `w`. Bốn chỗ đó giờ nằm sẵn trong nguồn:

| Chỗ | File nguồn |
|---|---|
| Đường dẫn asset → CDN hoặc `img/` | `src/common/resolveUrlToDataFolder.ts` |
| Tiền tố decoder Babylon | `src/libs/babylon/exports.ts` |
| Đường dẫn icon vật phẩm | `src/ui/components/itemIcon/index.tsx` |
| `__store`, `__eventBus` | `src/main.tsx` |

## Những sửa đáng chú ý ngoài bốn chỗ trên

| Sửa gì | File nguồn |
|---|---|
| Hiệu ứng Ngọc/Thần: đỏ tươi, ánh thuỷ tinh, dải tím hồng chạy qua | `src/common/itemMaterial.ts` |
| Tháo đồ ra mà mesh vẫn còn treo trong cảnh (lỗi của engine gốc) | `src/common/modelObject.ts` — `Unload()` |
| Thay đồ mượt, không nháy | `src/ecs/systems/appearanceSystem.ts` |
| Chỉ số nhân vật, hồi máu/mana | `src/libs/attributeSystem.ts`, `src/store.ts` |
| Bật/tắt từng hiệu ứng đồ hoạ | `src/gfx/index.ts` |

## Số liệu lấy từ đâu

- Chỉ số quái: `src/common/monsters.json` — 321 quái MU thật
- Sát thương vũ khí, bảng rơi đồ: `src/common/items.json` — 663 món
- Mesh quái: `src/common/modelFactoryPerId.ts` — hiện mới có 4 con
  (1 Hound, 2 Budge Dragon, 3 Spider, 14 Skeleton Warrior). Thêm mesh vào bảng
  đó là con quái tương ứng dùng được ngay, chỉ số đã có sẵn.
- Công thức sát thương/phòng thủ/tỉ lệ trúng của NGƯỜI CHƠI: không có trong
  client, tôi viết theo công thức MU cổ điển — xem `offline/combatFormulas.ts`,
  ghi rõ ngay đầu file.
