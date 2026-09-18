# MU Mobile · Aetherfall

MU Online chạy thẳng trên trình duyệt, giao diện Aetherfall tiếng Việt dựng cho
màn dọc iOS Retina Pro Max.

Engine là bản dựng sẵn của [afrokick/muonlinejs](https://github.com/afrokick/muonlinejs)
(Babylon.js 7 + React 18 + mobx + miniplex). Lớp giao diện là DOM/CSS thuần, không
framework, đọc thẳng dữ liệu thật từ `Store` của engine.

## Chạy

Cần một server tĩnh — trang dùng ES module nên `file://` sẽ bị CORS chặn.

```bash
cd mu-mobile
python3 -m http.server 8123
# mở http://127.0.0.1:8123/index.html
```

Mặc định asset nạp từ CDN GitHub. Ép nguồn bằng query:

| URL | Nguồn dữ liệu |
|---|---|
| `index.html` | tự dò: thử CDN, hỏng thì rơi về `img/` |
| `index.html?assets=cdn` | ép CDN GitHub |
| `index.html?assets=flat` | ép thư mục `img/` phẳng |

Muốn chơi offline hoàn toàn, tải asset về trước:

```bash
node tools/fetch-flat.mjs --list      # xem 82 nhóm
node tools/fetch-flat.mjs World1 Player Object1 js   # đủ để vào Lorencia
node tools/fetch-flat.mjs             # tải tất cả, ~574 MB
```

## Chơi trên iPhone bằng JSAnywhere

JSAnywhere chỉ cho nạp **từng file** vào `img/`, không nạp cả thư mục — mà bộ
asset có 11.996 file. Nên nén cả cây `public/` của muonlinejs thành **một** file
zip rồi nạp đúng ba thứ:

| Nạp vào | Là gì |
|---|---|
| `index.html` | trang, sinh bởi `node tools/build-ios.mjs` |
| `img/mu.js` | toàn bộ mã: giao diện + Babylon + engine |
| `img/assets.zip` | cây `public/` nén lại (~290 MB) |

Ba file phông `fonts_segoeuib.*` **không cần nạp nữa** — chế độ zip tự lấy phông
trong zip ra.

Không cần nén đúng kiểu nào: chương trình tự dò tiền tố bên trong zip
(`public/`, `muonlinejs/public/` hay không tiền tố đều nhận) và tự bỏ `__MACOSX/`.
Thấy `img/assets.zip` là nó tự chuyển sang chế độ zip, không thấy thì quay về CDN
như cũ. Cách đọc trong zip: xem `ASSETS.md`.

**Một việc còn phải quyết:** `index.html` đang có một thẻ `<link>` tới
`fonts.googleapis.com` cho ba phông Cinzel / Be Vietnam Pro / JetBrains Mono.
Chơi không mạng thì thẻ này hỏng và ba phông đó rơi về phông hệ thống — giao
diện vẫn chạy, chỉ khác nét chữ. Chưa gỡ vì gỡ là đổi hình thức giao diện.

## Cấu trúc

```
index.html              cấu trúc import + bảng kê nguồn asset
css/aetherfall.css      toàn bộ giao diện (2.050 dòng)
js/
  app.js                điều phối: boot → bridge → chuyển màn
  boot.js               vá 5 điểm trong bundle engine rồi nạp qua blob URL
  asset-paths.js        phân giải đường dẫn CDN ⇄ img/ phẳng ⇄ img/assets.zip
  asset-loader.js       nạp trước asset theo bản đồ, kèm tiến độ
  zip-store.js          đọc bảng mục lục zip, bung từng mục bằng DecompressionStream
  zip-net.js            chặn fetch/XHR/<img> để phục vụ asset thẳng từ zip
  asset-manifest.js     bảng kê 11.996 asset kèm kích thước
  store-bridge.js       đọc Store mobx mỗi khung hình, phát trạng thái
  game-data.js          bảng tĩnh trích từ engine (lớp NV, bản đồ, ô đồ)
  ui/dom.js             tiện ích DOM
  ui/screens.js         màn nạp · khởi đầu · chọn anh hùng · báo lỗi
  ui/hud.js             HUD trong game
  ui/panels.js          5 panel của cột gem
img/                    asset phẳng + ảnh giao diện + engine
tools/
  build-ios.mjs         gộp toàn bộ JS thành img/mu.js + sinh index.html
  bundle.mjs            gộp 12 module giao diện thành js/main.js (bản module)
  gen-manifest.mjs      sinh lại bảng kê từ cây public/ của muonlinejs
  gen-items.mjs         sinh js/item-data.js (kích thước ô của 652 món)
  fetch-flat.mjs        tải asset từ CDN về img/ theo tên phẳng
  trim-icons.mjs        cắt viền trong suốt cho 4 icon ô thanh bar
  make-bar.py           tách nền đen bar-hud.png, đo vòng cầu và 4 ô kỹ năng
  make-inv.py           xuất khay trang bị + đo 14 ô, cắt chồng tiền
  make-title.py         cắt viền trong suốt cho logo màn khởi đầu
```

Ba tool `.py` dùng Pillow + numpy + scipy (có sẵn), không thêm phụ thuộc npm
nào chỉ để xử lý ảnh.

## Cách engine được nạp

Safari chặn `<script type="module">` VÀ `fetch()` trên `file://`, nên bản cũ
(nạp bundle dạng text rồi vá lúc chạy) mở trên iOS là trắng màn.
`tools/build-ios.mjs` vá sẵn LÚC DỰNG và xuất ra **script cổ điển**, gộp tất cả
vào một file `img/mu.js` mà `index.html` nạp bằng đúng một thẻ `<script src>`.

Thứ tự trong file là bắt buộc:

1. **lớp giao diện** — phải đứng đầu vì định nghĩa `MU_ASSETS` mà engine cần
   ngay lúc khởi động
2. **Babylon.js 7** — dòng `export{…}` cuối file đổi thành `window.__BJS = {…}`;
   85 chỗ `import.meta.url` đổi thành `document.baseURI` (cú pháp ấy chỉ hợp lệ
   trong module)
3. **engine muonlinejs** — dòng `import{…}from"./bjs…"` đầu file đổi thành
   `const{…} = window.__BJS`, cộng bốn điểm vá đường dẫn asset
4. `MU_START()`

Hai phần 2 và 3 được minify RIÊNG nên cùng đặt tên biến cấp cao ngắn (`lr`,
`oe`…). Là module thì mỗi file một phạm vi, thành script cổ điển thì đổ chung
vào phạm vi toàn cục và đụng nhau ngay — nên mỗi phần được bọc trong một IIFE.

Bốn điểm vá đường dẫn trong engine:

1. `resolveUrlToDataFolder()` → `MU_ASSETS.game()` — model, địa hình, âm thanh
2. 13 đường dẫn decoder Babylon → `MU_ASSETS.resolve()` — draco / ktx2 / basis
3. `/items/item_…` → `MU_ASSETS.itemsBase` — icon vật phẩm
4. nối thêm `window.__store` và `window.__eventBus` cho lớp giao diện

Mỗi mỏ neo được kiểm tra là duy nhất; thiếu một cái là ném lỗi rõ ràng thay vì
nạp im lặng một bản vá dở dang. Cuối cùng `new vm.Script(...)` kiểm tra kết quả
có đúng là script cổ điển hợp lệ không — chính bước này bắt được lỗi
`import.meta` trước khi đóng gói.

## Dữ liệu thật lấy từ đâu

| Chỗ hiển thị | Nguồn |
|---|---|
| Máu, mana, khiên (SD), giáp (AG) | `Store.playerData.currentHP/MP/SD/AG` |
| Cấp, kinh nghiệm, điểm cộng | `Store.playerData.level / exp / points` |
| Sức mạnh, nhanh nhẹn, thể lực, năng lượng | `Store.playerData.str / agi / sta / eng` |
| Zen | `Store.playerData.money` |
| Toạ độ | `Store.playerData.x / y` |
| Trang bị + túi đồ 8×8 | `Store.playerData.items[]`, icon từ `items/` |
| Bốn ô Q/W/E/R | `Store.playerData.actionBar` |
| Lớp nhân vật | `world.playerEntity.charAppearance.charClass` |
| Bản đồ đang đứng | `world.playerEntity.worldIndex` |
| Dịch chuyển | `EventBus.emit('requestWarp')` |
| Nhật ký chiến đấu | `Store.notifications` |

## Giới hạn đã biết

- Bản chơi đơn của muonlinejs **không có hệ chiến đấu**: không sát thương, không
  hồi chiêu, không quái tấn công. Bốn ô Q/W/E/R vì vậy hiển thị đúng thanh hành
  động thật nhưng không có cooldown để đếm. Nút "TỰ ĐỘNG" chỉ ghi trạng thái.
- Panel thứ tư của bản vẽ là "NHIỆM VỤ"; engine không có hệ nhiệm vụ nên panel
  này dùng làm "DỊCH CHUYỂN" với danh sách warp thật.
- `Store.playerData.points` hiển thị đúng nhưng chưa cộng được — engine offline
  không có lệnh tăng chỉ số.
