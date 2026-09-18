# Bảng kê đường dẫn asset

Nguồn: `afrokick/muonlinejs@master` — **11.996 file · 573.7 MB · 82 thư mục**.

Bảng kê đầy đủ kèm kích thước từng file:

- `js/asset-manifest.js` — module ES, gom theo thư mục, có `listAssets()` và `assetSize()`
- `img/asset-manifest.json` — JSON phẳng cho công cụ ngoài

Sinh lại: `node tools/gen-manifest.mjs <đường-dẫn-public>`

## Quy tắc đường dẫn

Mỗi asset có một **đường dẫn logic** duy nhất, khớp cây `public/` của repo gốc.
Từ đó suy ra hai nguồn nạp:

```
logic   game-assets/World1/EncTerrain1.map
CDN     https://raw.githubusercontent.com/afrokick/muonlinejs/master/public/game-assets/World1/EncTerrain1.map
PHẲNG   img/game-assets_World1_EncTerrain1.map
```

Đường dẫn phẳng = đường dẫn logic thay mọi `/` bằng `_`.
Đã kiểm chứng **không có va chạm tên nào** trên cả 11.996 file — `tools/gen-manifest.mjs`
ném lỗi nếu về sau xuất hiện va chạm.

`js/asset-paths.js` dò CDN một lần khi khởi động rồi chốt nguồn cho cả phiên.
Ép tay bằng `?assets=cdn` hoặc `?assets=flat`.

## Nguồn thứ ba: `img/assets.zip`

Dành cho JSAnywhere trên iOS — app chỉ cho nạp **từng file** vào `img/`, không nạp
cả thư mục, mà bộ asset có 11.996 file. Nén cả cây `public/` thành **một** file zip
rồi nạp đúng file đó vào `img/assets.zip` là xong.

Nạp thêm vào `img/` ngoài `assets.zip`: `mu.js` (bản dựng) và `index.html`. Ba file
phông `fonts_segoeuib.*` **không cần nữa** — chế độ zip tự lấy phông trong zip ra.

Không cần nén đúng kiểu nào: `js/zip-store.js` tự dò tiền tố bên trong zip
(`public/`, `muonlinejs/public/` hay không tiền tố đều nhận), tự bỏ `__MACOSX/`
và `.DS_Store`.

Ba điều làm cho nó chạy được mà không nuốt hết bộ nhớ:

| | cách làm |
|---|---|
| tải | `fetch()` rồi lấy `.blob()`, **không** `.arrayBuffer()` — Safari đẩy Blob lớn xuống đĩa |
| tra | đọc bảng mục lục ở cuối zip một lần, sau đó `blob.slice()` đúng khúc cần |
| bung | `DecompressionStream('deflate-raw')` — API sẵn của trình duyệt, không thêm thư viện |

### URL giả `__muzip/`

Engine hỏi đường dẫn **đồng bộ** (`resolveUrlToDataFolder` phải trả về chuỗi ngay),
mà bung một mục trong zip thì **bất đồng bộ**. Không thể bung sẵn hết: 532 MB.

Nên chế độ zip trả về một URL giả cùng nguồn

```
http://<trang>/__muzip/game-assets/Player/ArmorMale01.glb
```

rồi `js/zip-net.js` chặn ba chỗ trình duyệt đi lấy dữ liệu — `fetch()`,
`XMLHttpRequest`, và thuộc tính `.src` của `<img>` (kèm `setAttribute('src')`,
vì React của engine gắn ảnh bằng đường đó) — để đọc thẳng từ zip. URL giả không
bao giờ ra tới mạng.

Hai điều đã học được khi làm:

- **Không đệm blob URL, đệm Blob.** Blob URL không mang phần mở rộng, mà
  `SceneLoader` của Babylon chọn trình đọc **theo đuôi file** — đệm URL là mọi
  `.glb` báo *“Unable to find a plugin to load … files”*. URL giả giữ nguyên đuôi
  nên không dính.
- **`url()` trong CSS thì không chặn được** — trình duyệt tự đi lấy, không qua
  fetch/XHR/Image. Ba chỗ cần ảnh trong CSS (nền radar, bản đồ to, `@font-face`)
  phải xin blob URL thật bằng `MU_ASSETS.blobUrl()`.

### Đã kiểm chứng

Zip dựng từ đúng cây `public/` — **295.208.707 byte, 12.081 mục, 11.996 file sau khi
lọc**, gần như y hệt file 288,6 MB của bạn. Chạy Chromium 430×932 DPR 2:

- tự dò ra tiền tố `public/`, đọc được cả `game-assets/`, `items/`, `js/`, `fonts/`
- vào Lorencia: 880 mesh, 261 texture, **0 texture chưa sẵn sàng**, địa hình dựng đủ
- **không một request asset nào ra khỏi máy** (chỉ còn Google Fonts, xem README)
- hình chụp trùng khít với bản chạy chế độ `flat`

## Toàn bộ thư mục

| Thư mục logic | Số file | Dung lượng |
|---|---:|---:|
| `fonts` | 3 | 1.0 MB |
| `game-assets/Item` | 407 | 19.1 MB |
| `game-assets/Item/Ingameshop` | 27 | 1.4 MB |
| `game-assets/Item/LuckyItem` | 4 | 0.1 MB |
| `game-assets/Item/PartCharge5` | 2 | 0.2 MB |
| `game-assets/Item/PartCharge6` | 15 | 0.9 MB |
| `game-assets/Item/cherryblossom` | 7 | 0.2 MB |
| `game-assets/Item/partCharge1` | 13 | 0.7 MB |
| `game-assets/Item/partCharge2` | 22 | 1.0 MB |
| `game-assets/Item/partCharge3` | 2 | 0.0 MB |
| `game-assets/Item/partCharge8` | 9 | 0.1 MB |
| `game-assets/Item/partcharge4` | 7 | 0.8 MB |
| `game-assets/Item/partcharge7` | 6 | 0.8 MB |
| `game-assets/Item/xmas` | 7 | 1.5 MB |
| `game-assets/Monster` | 344 | 142.7 MB |
| `game-assets/Music` | 44 | 74.7 MB |
| `game-assets/NPC` | 100 | 24.7 MB |
| `game-assets/NPC/LuckyItem` | 1 | 0.6 MB |
| `game-assets/NPC/cherryblossom` | 2 | 0.7 MB |
| `game-assets/Object1` | 115 | 5.1 MB |
| `game-assets/Object10` | 7 | 0.5 MB |
| `game-assets/Object11` | 16 | 0.4 MB |
| `game-assets/Object2` | 63 | 2.4 MB |
| `game-assets/Object3` | 120 | 3.9 MB |
| `game-assets/Object34` | 83 | 4.9 MB |
| `game-assets/Object4` | 43 | 2.6 MB |
| `game-assets/Object5` | 41 | 2.7 MB |
| `game-assets/Object52` | 165 | 10.3 MB |
| `game-assets/Object7` | 42 | 2.6 MB |
| `game-assets/Object8` | 49 | 3.1 MB |
| `game-assets/Object9` | 81 | 3.4 MB |
| `game-assets/Player` | 423 | 54.0 MB |
| `game-assets/Player/LuckyItem/62` | 6 | 0.4 MB |
| `game-assets/Player/LuckyItem/63` | 5 | 0.3 MB |
| `game-assets/Player/LuckyItem/64` | 5 | 0.3 MB |
| `game-assets/Player/LuckyItem/65` | 5 | 0.5 MB |
| `game-assets/Player/LuckyItem/66` | 5 | 0.4 MB |
| `game-assets/Player/LuckyItem/67` | 5 | 0.3 MB |
| `game-assets/Player/LuckyItem/68` | 5 | 0.3 MB |
| `game-assets/Player/LuckyItem/69` | 5 | 0.3 MB |
| `game-assets/Player/LuckyItem/70` | 5 | 0.5 MB |
| `game-assets/Player/LuckyItem/71` | 4 | 0.2 MB |
| `game-assets/Player/LuckyItem/72` | 7 | 1.0 MB |
| `game-assets/Skill` | 164 | 13.1 MB |
| `game-assets/Sound` | 464 | 11.5 MB |
| `game-assets/Sound/Doppelganger` | 8 | 0.2 MB |
| `game-assets/Sound/Karutan` | 31 | 1.2 MB |
| `game-assets/Sound/Ragefighter` | 14 | 0.2 MB |
| `game-assets/Sound/battlecastle` | 29 | 1.1 MB |
| `game-assets/Sound/cherryblossom` | 2 | 0.1 MB |
| `game-assets/Sound/w31` | 32 | 0.7 MB |
| `game-assets/Sound/w34` | 32 | 0.8 MB |
| `game-assets/Sound/w35` | 55 | 1.6 MB |
| `game-assets/Sound/w37` | 44 | 1.4 MB |
| `game-assets/Sound/w38` | 19 | 0.8 MB |
| `game-assets/Sound/w39` | 20 | 1.2 MB |
| `game-assets/Sound/w42` | 4 | 0.1 MB |
| `game-assets/Sound/w47` | 13 | 0.5 MB |
| `game-assets/Sound/w52` | 30 | 1.0 MB |
| `game-assets/Sound/w57` | 12 | 0.2 MB |
| `game-assets/Sound/w58w59` | 19 | 0.6 MB |
| `game-assets/Sound/w64` | 32 | 0.4 MB |
| `game-assets/Sound/w69w70w71w72` | 36 | 1.0 MB |
| `game-assets/Sound/xmas` | 13 | 0.2 MB |
| `game-assets/World1` | 37 | 9.7 MB |
| `game-assets/World10` | 28 | 1.3 MB |
| `game-assets/World11` | 17 | 8.7 MB |
| `game-assets/World2` | 27 | 9.4 MB |
| `game-assets/World3` | 53 | 10.8 MB |
| `game-assets/World34` | 58 | 20.6 MB |
| `game-assets/World4` | 33 | 10.2 MB |
| `game-assets/World5` | 33 | 10.0 MB |
| `game-assets/World52` | 45 | 12.9 MB |
| `game-assets/World7` | 32 | 2.1 MB |
| `game-assets/World8` | 31 | 9.9 MB |
| `game-assets/World9` | 35 | 10.6 MB |
| `items` | 8.144 | 45.0 MB |
| `js` | 5 | 0.8 MB |
| `js/basisTranscoder` | 2 | 0.3 MB |
| `js/basisTranscoder/1` | 2 | 0.5 MB |
| `js/ktx2Transcoders` | 6 | 0.6 MB |
| `js/ktx2Transcoders/1` | 8 | 0.6 MB |

## Ảnh giao diện Aetherfall

Không thuộc bảng kê engine, luôn nạp cục bộ từ `img/`:

| File | Cỡ | Dùng cho |
|---|---|---|
| `img/ui_bar.png` | 1952 × 516 | thanh HUD dưới. Cắt từ `bar-hud.png` bằng `tools/make-bar.py`: tách nền đen thành alpha, đo tâm hai vòng cầu và bốn ô Q E 1 2 |
| `img/ui_equip.jpg` | 1024 × 1008 | khay trang bị trong Hành trang. Cắt từ `inventory-TOP.png` bằng `tools/make-inv.py`; toạ độ 14 ô nằm trong `EQUIP_BOXES` |
| `img/ui_coin.png` | 78 × 83 | chồng tiền vàng ở chân Hành trang, cắt từ `inventory-BOT.png` |
| `img/ui_title.png` | 1238 × 1206 | logo MU trên màn khởi đầu, cắt viền trong suốt bằng `tools/make-title.py` |
| `img/ui_login-bg.jpg` | 1024 × 1536 | tranh nền màn khởi đầu |
| `img/ui_panel-frame.png` | | khung đá, dùng làm `border-image` cho mọi panel |
| `img/icon_14_2.png` · `14_5` · `12_7` · `13_4` | | bốn icon đã cắt viền cho ô thanh bar (`tools/trim-icons.mjs`) |
| `img/fonts_segoeuib.woff2` · `.woff` · `.ttf` | | Segoe UI của MU |

Radar và bản đồ lớn **không dùng ảnh riêng**: nền là `TerrainLight.jpg` của
chính bản đồ đang chơi (256 × 256, nằm sẵn trong `game-assets/WorldN/`), tức là
ảnh nhìn từ trên xuống thật của engine. Xem `terrainMapPath()` trong
`js/game-data.js`.

### Ảnh còn trong `img/` nhưng KHÔNG còn mã nào gọi tới

Giữ lại vì là bản gốc bạn gửi, xoá đi tiết kiệm khoảng 1,3 MB:

`ui_bar-original.png` (791 KB · art thanh HUD đời trước) ·
`ui_orb-hp.png` (163 KB) · `ui_orb-mp.png` (257 KB) ·
`ui_orb-mask-hp.png` · `ui_orb-mask-mp.png` (mặt nạ quả cầu đời trước, giờ quả
cầu cắt bằng `border-radius` nên không cần) ·
`ui_corner-tl.png` (40 KB) · `ui_divider.png` (38 KB).

Hai ảnh bản thiết kế gọi mà bộ art không có — `art/gem.png` và `art/slot.png` —
được dựng lại **hoàn toàn bằng CSS + SVG inline** trong `css/aetherfall.css`
(mục `GEM` và `Ô CHỨA`), nên không phát sinh request ảnh nào.
