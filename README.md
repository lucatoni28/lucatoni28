# Ani — Companion 3D (một file HTML5 duy nhất)

Bạn đồng hành 3D thời gian thực: model skinned mesh 442 xương, nền Paris đêm vẽ
bằng Canvas 2D, nhép miệng theo âm tiết tiếng Việt, vật lý tóc/váy, chat + TTS.

**Toàn bộ nằm trong `Ani.html` (~4,6 MB).** Không server, không mạng, không build
step. Tải về, mở bằng trình duyệt là chạy — kể cả `file://` và kể cả offline.

> Trên iPhone: mở bằng Safari → nút Chia sẻ → **Thêm vào MH chính** để dùng như
> app toàn màn hình. Giao diện thiết kế cho màn dọc Retina Pro Max, có tính cả
> safe-area tai thỏ / Dynamic Island.

---

## Cách dùng

| | |
|---|---|
| Chạy | Mở `Ani.html` |
| Xoay nhân vật | Kéo ngang · nghiêng: kéo dọc · về giữa: nháy đúp |
| Đổi khung hình | Nút **Bán thân** → Cận mặt → Toàn thân |
| Đổi trang phục | Nút **Váy gothic** ↔ **Đầm ren** |
| Đổi cảm xúc | Dãy chip phía trên ô nhập |
| Đo hiệu năng | Nút biểu đồ trên thanh trên cùng |
| Nói chuyện | Gõ, hoặc bấm micro (Web Speech API) |

Mặc định Ani trả lời offline bằng câu mẫu. Muốn nối AI thật thì vào **Cài đặt →
Bộ não trả lời**, điền endpoint + API key (định dạng OpenAI chat-completions,
tự nhận cả kiểu trả về của Anthropic). Khoá chỉ nằm trong `localStorage` của máy.

---

## ANI-2 — lớp chuyển động

Đây là phần được viết lại để đạt yêu cầu "mượt". Sáu thay đổi so với bản cũ:

**1 · Bộ lập lịch bước thời gian cố định + nội suy trạng thái.**
Mô phỏng chạy ở nhịp cố định (mặc định 120 Hz), khung hình nội suy giữa hai bước
gần nhất. rAF dao động bao nhiêu cũng không sinh giật — 60 / 90 / 120 Hz
ProMotion đều mượt như nhau.

**2 · Lò xo tới hạn giải bằng Euler ẩn.**
`springStep()` dùng nghiệm implicit thay cho `v += (t-x)*k*dt` kiểu Euler hiện.
Ổn định vô điều kiện: không vọt lố, không nổ khi fps tụt.

**3 · Spring-bone PBD kiểu VRM cho tóc / váy / ruy-băng.**
206 khớp mô phỏng trong toạ độ thế giới: quán tính Verlet, lực hồi vị về tư thế
nghỉ, trọng lực, gió, rồi hai ràng buộc — **giữ nguyên chiều dài xương** và
**nón giới hạn góc** quanh tư thế nghỉ. Thay hẳn cách xoay euler của bản cũ.

**4 · Nhiễu value-noise nhiều tầng thay chồng hàm sin.**
Thở, dồn trọng tâm, lắc người, vi cử động tay đều lấy từ fbm — không còn lặp mẫu
nghe thấy được.

**5 · Mô hình mắt–đầu sinh học.**
Saccade đạn đạo (thời lượng theo biên độ), thời gian dwell, microsaccade khi cố
định, đầu chạy theo mắt có trễ, mắt đối xoay bù chuyển động đầu (VOR), chớp mắt
gắn với đảo mắt, chớp kép. Chớp mắt theo đúng biên dạng 62/22/108 ms.

**6 · Bộ điều tiết ngân sách.**
Đo thời gian lớp motion mỗi khung. Vượt ngân sách (mặc định **2,5 ms**) thì tự
hạ substep rồi hạ LOD chuỗi lò xo; dư thì tự nâng lại. Chỉnh trong Cài đặt.

Nhép miệng dùng **trộn đồng phát âm**: mỗi thời điểm là tổng có trọng số của các
âm tiết lân cận trong cửa sổ ±120 ms, cộng nguyên âm đôi và phụ âm môi (b/p/m)
đóng miệng — thay cho con trỏ nhảy từng từ. Có tái đồng bộ theo `onboundary`
của SpeechSynthesis, và đường lui khi iOS không bắn sự kiện nào.

Đo trên trình kết xuất phần mềm (chậm hơn máy thật nhiều): **1,2 – 2,3 ms/khung**
cho 206 khớp lò xo + 67k tam giác, không có quaternion suy biến sau khi xoay
mạnh liên tục.

---

## Những lỗi đã sửa so với bản gốc

Bản cũ render ra nhân vật hồng bệt, nhoè vệt và không có nền. Nguyên nhân cụ thể:

1. **Dải toon sai định dạng — thủ phạm chính làm da đỏ.**
   three r128 đọc gradient map bằng `texture2D(gradientMap, coord).rgb` (bản mới
   hơn mới dùng `.r`). Bản cũ nạp dải bằng `RedFormat`, nên độ rọi trả về là
   `(ramp, 0, 0)` — tức **ánh sáng đỏ thuần** nhân lên toàn bộ nhân vật. Nay nạp
   RGBA.

2. **Sai chế độ lặp texture — thủ phạm chính làm nhoè vệt.**
   Model dùng UV lát, `u`/`v` chạy tới ~1,98 (riêng mesh thân nằm trọn trong ô
   thứ hai). Bản cũ đặt `ClampToEdgeWrapping` nên mọi toạ độ > 1 bị kẹp vào cột
   texel cuối cùng, kéo lê vệt ngang khắp cổ, ngực và váy. Nay `RepeatWrapping`.

3. **Thiếu `texture.encoding = sRGBEncoding`** trên các map màu, trong khi
   renderer vẫn xuất sRGB → nhân đôi gamma, ảnh bạc màu.

4. **Tổng cường độ đèn quá cao** với vật liệu toon: mỗi đèn định hướng cộng
   "sàn" của dải chuyển lên toàn bề mặt, cộng dồn quá 1.0 là kênh đỏ của da bão
   hoà trước. Đã hạ và hạ luôn sàn của dải.

5. **Vòng cổ ren bị ẩn.** Hai mesh `+necklace` bị xếp nhầm vào bộ trang phục B,
   trong khi ảnh gốc cho thấy nó có ở cả hai bộ → cổ trần, lộ hẳn da.

6. **Nền không tồn tại.** Bản cũ trỏ `img/bg.jpg` — file không có trong dự án.
   Nay nền Paris đêm (tháp Eiffel có dàn giáo và đèn nhấp nháy, mái nhà
   Haussmann, lan can sắt uốn, sàn kẻ ô, bụi hoa hồng, bokeh) được **vẽ hoàn
   toàn bằng Canvas 2D** — không ảnh ngoài, không base64.

7. **three.js chỉ tải từ CDN.** Không mạng là hỏng hẳn. Nay nhúng thẳng r128
   (MIT) vào file.

8. **Lò xo bị nổ.** `Quaternion.invert()` của three thực chất chỉ là
   `conjugate()` — đúng nghịch đảo khi và chỉ khi quaternion đơn vị. Sai số nhỏ
   bị khuếch đại mỗi khung: `compose()` sinh ma trận trượt → `decompose()` trả
   về scale không đều → vòng lặp tự khuếch đại đến khi quaternion sụp về
   `(0,0,0,0)`, tóc và váy văng ra khỏi người. Nay chuẩn hoá ở mọi bước bàn giao,
   cộng nón giới hạn góc và lưới an toàn.

9. **Vá atlas.** `o-a_base.png` có ba đảo vàng kim; UV gấu váy và mặt trước thắt
   lưng trỏ vào hai trong số đó, làm cả vạt váy loé vàng — trong khi ảnh render
   chính chủ của model lẫn ảnh tham chiếu đều cho thấy chỗ đó xanh than. Hai đảo
   đó được chép đè bằng vải xanh than lấy từ chính atlas; đảo khoá thắt lưng
   (vàng thật) giữ nguyên. Xem `TEX_PATCH` trong `src/app.js`.

10. **Mống mắt.** Đảo texture mà UV mắt trỏ vào có màu nâu hổ phách, còn ảnh
    tham chiếu là mắt xanh dương. Mống được đổi tông trong shader, chỉ tác động
    lên điểm ảnh có màu — đồng tử đen và đốm sáng trắng giữ nguyên.

Điểm 9 và 10 là chỉnh sửa **thẩm mỹ có chủ đích** để khớp ảnh tham chiếu, không
phải sửa lỗi kỹ thuật. Muốn thấy dữ liệu gốc y nguyên thì bỏ `TEX_PATCH` và khối
`IRIS_GLSL`.

---

## Cấu trúc

```
Ani.html              ← bản giao hàng, một file, mở là chạy
src/
  index.html          bộ khung, thẻ script trỏ tới các phần rời
  style.css           giao diện dọc iOS, safe-area, kính mờ
  app.js              ANI-2: model, shader, chuyển động, nền, chat, TTS
  data/ani-data.js    dữ liệu gốc: 442 xương, 14 mesh, 6 texture
  vendor/three.min.js three.js r128 (MIT)
tools/build.mjs       gộp src/ thành Ani.html
```

Sửa trong `src/` rồi chạy `node tools/build.mjs` để dựng lại `Ani.html`.
Bản trong `src/` cũng mở trực tiếp được, nhưng cần server tĩnh
(`npx http-server`) vì trình duyệt chặn `file://` nạp script cạnh nhau ở vài
cấu hình.

## Phụ thuộc ngoài

Chỉ đúng một, và không bắt buộc: font **Be Vietnam Pro** từ Google Fonts. Không
có mạng thì tự lùi về font hệ thống iOS. Mọi thứ còn lại — three.js, model,
texture, nền — đều nằm trong file.

## Giấy phép

three.js r128 © three.js authors, giấy phép MIT. Model nhân vật là tài sản do
người dùng cung cấp, không kèm giấy phép trong repo này.
