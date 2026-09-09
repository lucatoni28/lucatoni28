# design/ — canvas thiết kế giao diện

Sáu artboard mô tả giao diện mới của STAR ARENA. Đây là **bản thiết kế tĩnh**
để chốt hình, chưa phải code chạy được — phần dựng vào `index.html` làm sau.

| File | Artboard |
|---|---|
| `Login.dc.html` | Welcome / đặt tên chỉ huy |
| `Campaign.dc.html` | Bản đồ chiến dịch, qua màn |
| `Main.dc.html` | HUD trận đấu (artboard chính) |
| `Reward.dc.html` | Rơi đồ, phần thưởng cuối màn |
| `Shop.dc.html` | Cửa hàng avatar |
| `Icons.dc.html` | Bộ icon + thành phần HUD |
| `canvas.json` | Vị trí các artboard trên canvas |

Ảnh `aduka.png` và `thor.png` lấy thẳng từ `../assets/` lúc dựng, không nhân bản.

## Dựng lại canvas

`star-arena-giao-dien-moi.html` là file sinh ra (~2,4 MB) nên không commit.
Sửa bất kỳ `.dc.html` nào rồi chạy lại:

```sh
cd design
SKILL=/path/to/skills/design
node "$SKILL/seed-canvas.mjs" \
  --template "$SKILL/payload.template.html" \
  --out star-arena-giao-dien-moi.html \
  --title "STAR ARENA Giao Diện Mới" \
  --artboard Main.dc.html --artboard Login.dc.html --artboard Campaign.dc.html \
  --artboard Reward.dc.html --artboard Shop.dc.html --artboard Icons.dc.html \
  --image ../assets/aduka.png --image ../assets/thor.png \
  --canvas canvas.json
```

## Token lấy từ index.html

Bảng màu và font bám đúng bản đang chạy, không đặt màu mới:

```
--cy   #00e5e5      --ice  #6bdbff      --deep #0a1f33
--gold #ffcc00      --org  #ff8c2a      nền    #04121f / #020a14
```

Thêm cho phần mới: `#ff4a9d` (SS / Thor cấp 5), `#7a4ad0` hiếm,
`#ff8c2a` sử thi, `#ffcc00` huyền thoại.

Font `Orbitron` 700/900 cho số và tiêu đề, `Be Vietnam Pro` 500/600/700 cho chữ.
Bo góc 5–6 px, viền 2 px, bóng cứng `0 3px 0 #0a1f33` — giữ chất arcade của bản gốc.

**Lưu ý dấu tiếng Việt:** tiêu đề Orbitron cỡ lớn phải để `line-height` ≥ 1.16,
để `1` sẽ cắt mất dấu (Ế, Ắ, Ậ…).
