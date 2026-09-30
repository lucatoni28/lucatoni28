# Quyền tác giả và nguồn gốc các thành phần

Kho này gồm ba nhóm tài sản có chủ khác nhau. Ghi rõ ra đây để không ai —
kể cả chính tác giả — nhầm phần nào là của ai.

---

## 1. Phần do chủ kho tự làm

Bản quyền © lucatoni28. Giữ mọi quyền.

Đây là phần có tính sáng tạo riêng, không sao chép từ đâu:

| Đường dẫn | Nội dung |
|---|---|
| `mu-mobile-js/css/aetherfall.css` | Toàn bộ bố cục HUD màn dọc 430 × 932: vị trí, tỉ lệ, hệ màu, khung panel, lưới hòm đồ theo footprint món đồ, hai quả cầu máu/mana vẽ bằng CSS (gradient + sóng nước, không dùng ảnh) |
| `mu-mobile-js/js/ui/` | Cách dựng và bài trí HUD, panel, màn khởi đầu, màn chọn nhân vật |
| `mu-mobile-js/js/game-data.js` | Cấu hình thanh bar 5 ô, danh sách điểm dịch chuyển, tên tiếng Việt |
| `mu-mobile-js/ui/` | Ảnh giao diện đã xử lý: tách nền, ghép, chỉnh tỉ lệ |
| `mu-mobile-js/icons/` | Icon vật phẩm đã cắt viền trong suốt |
| Toàn bộ chữ tiếng Việt | Tên bản đồ, tên vật phẩm, nhãn giao diện, câu thông báo |

Không được sao chép, phân phối lại hay dùng cho mục đích thương mại nếu chưa
được chủ kho cho phép bằng văn bản.

---

## 2. Tài sản của MU Online — KHÔNG thuộc chủ kho

Thư mục `mu-mobile-js/assets/` (599 MB, 11.996 file) gồm mô hình, kết cấu,
địa hình, nhạc và âm thanh của **MU Online**, bản quyền thuộc **Webzen Inc.**

Chủ kho **không sở hữu** và **không nhận** bất kỳ quyền nào với phần này.
Chúng có mặt ở đây chỉ để chạy thử và nghiên cứu kỹ thuật.

Phân phối lại phần này công khai là vi phạm bản quyền của Webzen. Kho này để
chế độ riêng tư vì lý do đó.

---

## 3. Phần mềm mã nguồn mở của bên thứ ba

| Thành phần | Tác giả | Đường dẫn |
|---|---|---|
| muonlinejs | afrokick | `mu-mobile-js/engine-src/muonlinejs/` |
| Babylon.js | Babylon.js Team | trong `js/babylon.js` |
| React, React DOM | Meta | trong `js/engine.js` |
| MobX | MobX contributors | trong `js/engine.js` |
| miniplex | Hendrik Mans | trong `js/engine.js` |
| Be Vietnam Pro, Cinzel, JetBrains Mono | các tác giả phông tương ứng | `mu-mobile-js/fonts/` |

Giấy phép của từng thành phần theo đúng giấy phép gốc của nó. Bản
`engine-src/muonlinejs/` đã được sửa; những chỗ sửa liệt kê ở
`mu-mobile-js/engine-src/README.md`.

---

## Ghi chú về cách bảo vệ

Mã chạy trên trình duyệt thì **không giấu được**. Ai mở công cụ phát triển
cũng đọc được CSS và JavaScript. Mã hoá hay làm rối mã không đổi được điều đó,
chỉ làm chính chủ kho khó sửa hơn — nên kho này cố ý **không** làm việc đó.

Cách bảo vệ thật sự có tác dụng, theo thứ tự:

1. Để kho ở chế độ riêng tư
2. Đặt mật khẩu cho bản dựng thử, không để địa chỉ công khai
3. Giữ file này làm mốc thời gian và mốc quyền tác giả
