STAR ARENA — Aduka vs Bot
=========================

CÁCH CHẠY
  Mở index.html bằng trình duyệt. Nếu ảnh không hiện (do trình duyệt
  chặn file://), chạy một máy chủ tĩnh trong thư mục này:
      python3 -m http.server 8000
  rồi mở http://localhost:8000

CẤU TRÚC
  index.html      — toàn bộ game (~50 KB, KHÔNG nhúng base64)
  assets/         — 22 ảnh dùng chung, tải theo đường dẫn tương đối

ĐỔI ĐƯỜNG DẪN ẢNH
  Mở index.html, tìm dòng:
      const ASSET = "assets/";
  Đổi thành URL hoặc thư mục khác, ví dụ:
      const ASSET = "https://cdn.cua-ban.com/star-arena/";

TRANG BỊ AVATAR
  Ảnh trang bị KHÔNG nằm trong assets/ mà tải theo URL kho mã nguồn mở:
      const AV_CDN = "https://raw.githubusercontent.com/Wilter/DragonBound/
                      master/client/static/images/ava/";
  Muốn chạy offline hoàn toàn: tải các file .png theo mã món trong biến
  RAWITEMS về một thư mục rồi trỏ AV_CDN vào thư mục đó.

ĐIỀU KHIỂN
  Vuốt DỌC trên sân        chỉnh góc bắn
  Vuốt NGANG trên sân      xem bản đồ
  Chụm 2 ngón              phóng to / thu nhỏ
  Kéo THANH LỰC rồi NHẢ    bắn (kéo vọt lên trên 70px để huỷ)
  Hai nút mũi tên          di chuyển trái / phải
  Ô đạn                    đổi ĐẠN 1 / ĐẠN 2 / SS
  Chạm khung avatar trái   mở tủ trang bị

ĐẠN
  ĐẠN 1   quả cầu năng lượng, sát thương ~19
  ĐẠN 2   bắn ra chính chiếc xe Aduka đang xoay, nặng hơn, sát thương ~27
  SS      chỉ bật khi vệ tinh THOR đạt cấp 5. Thor hút sát thương của cả
          hai bên và lớn dần theo lượt. Khi bắn, Thor phóng tia xuống
          điểm nổ gây SÁT THƯƠNG GẤP ĐÔI (~44) rồi tụt về cấp 1.

NGUỒN
  Sprite Aduka, Thor, map STAR, atlas HUD Gunbound Season 1: do người dùng
  cung cấp. Toạ độ khung trang bị trích từ dự án mã nguồn mở
  Wilter/DragonBound. Gunbound là sản phẩm của Softnyx — bản này chỉ dùng
  cho mục đích học tập.
