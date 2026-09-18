# Quy tắc bắt buộc — đọc trước khi làm bất cứ việc gì

Đây là lệnh của chủ dự án, không phải gợi ý. Vi phạm một điều nào dưới đây thì
dừng lại và sửa, đừng biện minh.

---

## 1. KHÔNG TỰ Ý QUYẾT THAY NGƯỜI DÙNG

**Đây là điều quan trọng nhất, và là điều đã vi phạm nhiều lần nhất.**

Người dùng chạy mã này bằng một ứng dụng riêng của họ (không phải trình duyệt
thường, không hẳn là JSAnywhere). **Không được suy đoán môi trường của họ.**

Cụ thể những việc **CẤM**:

- Cấm lấy kết quả một phép thử (`fetch` hỏng, file không đọc được, giao thức là
  `file:`, v.v.) để **kết luận** môi trường người dùng rồi **chặn chương trình**.
  `fetch` hỏng KHÔNG có nghĩa là asset không đọc được — ứng dụng bọc trang có
  thể cấp file cho engine bằng đường mà `fetch` không nhìn thấy.
- Cấm thêm bất kỳ bước kiểm tra nào `return` sớm / dựng bảng báo lỗi chặn khởi
  động. Dò để **CHỌN** cách làm thì được; dò để **CHẶN** thì không.
- Cấm đọc `location.protocol`, `navigator.*`, `userAgent` để đổi hành vi.
- Dò không ra thì **ghi một dòng vào nhật ký rồi chạy tiếp**. Để engine tự xoay
  xở. Nó nạp được hay không là việc của nó.

> Lỗi đã phạm: thêm bước "kiểm kho" dùng `fetch()`, thấy hỏng thì dựng bảng
> "KHÔNG TÌM THẤY KHO DỮ LIỆU" và `return`. Kết quả: người dùng mở kiểu nào
> cũng chỉ thấy bảng báo lỗi, không vào được game. Lời họ nói:
> *"có bị cors hay không kệ mẹ tao không khiến mày lo hộ xong sửa code để coi
> như là chắc chắn tao bị lỗi cors như vậy"*.

Rộng hơn: **trong quá trình build không tự ý quyết định sáng tạo gì, phải hỏi ý
kiến trước.** Không tự ý lan man thêm bớt. Không tự sáng tác — có ảnh mẫu thì
làm nguyên như ảnh mẫu.

---

## 2. MỘT NƠI DUY NHẤT: repo `lucatoni28`

Lệnh mới nhất của chủ dự án thay cho lệnh "không commit" trước đây:

> *"đẩy hết về repo của lucatoni28; xoá hết của claude và afrokick đi mà"*

Nghĩa là:

- **Commit và push thẳng** vào nhánh `claude/3d-project-smooth-animation-crxqgn`.
  Không hỏi lại từng lần nữa.
- Mọi thứ phải nằm trong repo này: gói ba file, cây asset `public/`, nguồn
  `mu-mobile/`, và bản sao nguồn engine đã sửa ở `mu-mobile/engine-src/`.
- **Không để thứ gì ngoài repo.** Bản `afrokick/muonlinejs` chỉ là chỗ dựng
  tạm; sửa gì trong đó phải đồng bộ về `engine-src/` NGAY, vì nó sẽ bị xoá.
- Vẫn cấm tạo repo mới, cấm đẩy sang nhánh khác khi chưa được phép.

> Lỗi đã phạm: `engine-src/` bị bỏ quên nên chỉ còn 8 file cũ, trong khi bản
> dựng đã sửa 17 file cộng hai thư mục mới `offline/` và `gfx/`. Xoá afrokick
> lúc đó là mất hiệu ứng Ngọc/Thần và bản sửa `Unload()`.

---

## 3. KHÔNG GIẤU, KHÔNG CẮT, KHÔNG KHOÁ

- Cấm mã hoá, cấm obfuscate, cấm minify phần mã tự viết.
- Cấm cài key, cấm mã kích hoạt muộn, cấm cờ ẩn tính năng.
- Cấm cắt bớt tính năng đã làm, cấm làm thay đổi tính năng đã có mà không báo.
- Cấm tạo khoá hay trạng thái nhớ ngầm trong trình duyệt (`localStorage`…) làm
  đổi hành vi mà người dùng không biết.
- Toàn bộ mã phải đọc được, sửa được.

---

## 4. TUYỆT ĐỐI KHÔNG KẾT NỐI RA NGOÀI

- Không một địa chỉ mạng nào trong mã xuất bản. Không CDN, không `github`,
  không `afrokick`, không src gốc, không `data:` URI.
- **Xoá hẳn**, không phải chỉ chặn. `tools/build-ios.mjs` có bước cắt địa chỉ
  kèm một khẳng định **làm hỏng build** nếu còn sót — giữ nguyên bước đó.
- Ngoại lệ duy nhất được giữ: `http://www.w3.org/…` (không gian tên XML/SVG,
  không ai tải) và `localhost` / `127.0.0.1` trong câu hướng dẫn.

---

## 5. HIỆU NĂNG

Khi tinh chỉnh hiệu năng: **không tự ý bớt, bỏ, hay thay thông số nào.** Muốn
đổi thì hỏi trước.

Ví dụ đã phạm: tự hạ `intensity` của `GlowLayer` và thêm
`customEmissiveTextureSelector`. Người dùng cắt ngang: *"ban đầu đúng rồi đừng
tự ý lan man"*. Đã hoàn nguyên cả ba chỗ sửa.

---

## 6. TRÌNH BÀY

- **Tiếng Việt** ở mọi nơi: giao diện, nhật ký, chú thích mã, câu trả lời.
- Thiết kế cho **màn dọc iOS Retina Pro Max**: 430 × 932, DPR 3.
- Sửa đến đâu **chụp ảnh gửi** đến đó.
- Cấm ASCII art trong nhật ký hay giao diện.

---

## 7. CẤU TRÚC

- Xuất ra ba file: `index.html` + `style.css` + `img/mu.js`.
- Không viết lại vài nghìn dòng chỉ để sửa một tính năng nhỏ. Module hoá.
- Đường dẫn asset khai ở hai thẻ meta đầu `index.html`
  (`mu-source`, `mu-folder`), sửa xong chỉ cần tải lại trang.
- Thư mục asset (599 MB, 11.996 file) nằm ở `public/` ngay gốc repo và đã được
  commit — không phải chép tay nữa. `index.html` trỏ tới đó bằng
  `<meta name="mu-folder" content="public/">`, còn `mu-zip-url` để rỗng.

---

## 8. BÁO CÁO TRUNG THỰC

- Đo rồi hãy nói. Dán số thật, không khẳng định suông.
- Kiểm thử sai thì nói rõ là **phép đo của mình sai**, đừng đổ cho mã.
- Chưa kiểm thì nói là chưa kiểm.
