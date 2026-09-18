# Quy tắc bắt buộc

Lệnh của chủ dự án. Vi phạm thì dừng lại sửa, đừng biện minh.

## 1. Không tự quyết thay người dùng

Không lấy kết quả một phép thử để kết luận môi trường rồi chặn chương trình.
Dò để **chọn** cách làm thì được, dò để **chặn** thì không. Dò không ra thì ghi
một dòng nhật ký rồi chạy tiếp.

Không tự sáng tác. Có ảnh mẫu thì làm nguyên như ảnh mẫu. Muốn thêm bớt gì thì
hỏi trước.

## 2. Một nơi duy nhất

Tất cả nằm trong `mu-mobile-js/` của repo này. Không để gì ngoài repo. Commit và
push thẳng vào nhánh `claude/3d-project-smooth-animation-crxqgn`.

## 3. Không giấu, không nén, không khoá

Không mã hoá, không obfuscate, không minify. Không key, không cờ ẩn tính năng.
Không cắt bớt tính năng đã làm. Mọi file phải đọc được và sửa được.

## 4. Không kết nối ra ngoài

Không một địa chỉ mạng nào trong mã chạy. Không CDN, không zip từ xa, không
blob, không `data:` URI thay cho file thật. Xoá hẳn chứ không chặn.

## 5. Hiệu năng

Không tự ý bớt, bỏ hay thay thông số nào. Muốn đổi thì hỏi trước.

## 6. Trình bày

Tiếng Việt ở mọi nơi. Màn dọc iOS 430 × 932, DPR 3. Sửa đến đâu chụp ảnh gửi
đến đó. Không ASCII art.

**Chú thích trong mã viết ngắn.** Nói code làm gì, không kể lịch sử từng sửa gì.

## 7. Báo cáo trung thực

Đo rồi hãy nói, dán số thật. Phép đo của mình sai thì nói rõ là mình sai. Chưa
kiểm thì nói là chưa kiểm.
