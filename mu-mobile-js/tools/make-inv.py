#!/usr/bin/env python3
"""Chuẩn bị ảnh nền paper doll, đo 14 ô trang bị, và cắt đồng tiền ở khay dưới.

    python3 tools/make-inv.py <inventory-TOP.png> [inventory-BOT.png]

Ảnh nguồn 1024 × 1008, RGB không alpha, nền đá tối liền khối — nền này GIỮ
NGUYÊN vì nó chính là mặt khay trang bị, khác hẳn bar-hud.png (ảnh đó nền đen
phải bỏ). Vì không cần alpha nên xuất JPEG: nhẹ hơn PNG cỡ năm lần mà kết cấu
đá không thấy khác.

Đo ô: viền kim loại sáng hơn hẳn nền (ngưỡng 60 trên kênh lớn nhất). Mỗi khung
là một vòng khép kín, nên lấp lỗ rồi trừ đi chính vòng là ra lòng ô. Lọc thêm
theo độ lấp đầy ≥ 0,85 để bỏ những mảng sáng không phải khung.

Ra đúng 14 ô. MU chỉ có 12 ô trang bị nên hai ô thừa (ô vai trên cùng bên trái
và ô huy hiệu dưới cùng bên phải) để trống làm hoạ tiết — art vẽ sẵn hình mờ
trong đó nên nhìn vẫn liền mạch.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

NGUONG = 60
LAP_DAY = 0.85
CHAT_LUONG = 90

# Thứ tự sau khi sắp theo (hàng, cột) — xem chú thích ở đầu file.
TEN = [
    'vai (không dùng)', 'dây chuyền', 'mũ', 'cánh',
    'tay trái', 'giáp', 'tay phải',
    'găng', 'quần', 'giày',
    'nhẫn 1', 'nhẫn 2',
    'thú cưng', 'huy hiệu (không dùng)',
]


def main():
    if len(sys.argv) < 2:
        sys.exit('Thiếu đường dẫn inventory-TOP.png')
    src = Path(sys.argv[1])
    root = Path(__file__).resolve().parent.parent

    im = Image.open(src).convert('RGB')
    w, h = im.size
    mx = np.array(im).astype(np.int32).max(axis=2)

    sang = nd.binary_closing(mx > NGUONG, structure=np.ones((5, 5)))
    lab, n = nd.label(sang)

    o = []
    for l in range(1, n + 1):
        m = lab == l
        if m.sum() < 2000:
            continue
        lo = nd.binary_fill_holes(m) & ~m
        hl, hn = nd.label(lo)
        for k in range(1, hn + 1):
            hm = hl == k
            s = int(hm.sum())
            if s < 2500:
                continue
            yy, xx = np.nonzero(hm)
            x0, x1, y0, y1 = int(xx.min()), int(xx.max()), int(yy.min()), int(yy.max())
            bw, bh = x1 - x0 + 1, y1 - y0 + 1
            if s / (bw * bh) < LAP_DAY:
                continue
            o.append({'x': x0, 'y': y0, 'w': bw, 'h': bh})

    o.sort(key=lambda r: (r['y'] // 120, r['x']))
    if len(o) != len(TEN):
        sys.exit(f'Chờ {len(TEN)} ô, tìm được {len(o)}')

    out = root / 'img' / 'ui_equip.jpg'
    im.save(out, 'JPEG', quality=CHAT_LUONG, optimize=True, progressive=True)

    def pct(v, tong):
        return round(v * 100 / tong, 3)

    do = {
        'nguon': src.name,
        'anh': out.name,
        'co': [w, h],
        'ti_le': round(w / h, 4),
        'o': [
            {
                'ten': TEN[i],
                'x': pct(r['x'], w),
                'y': pct(r['y'], h),
                'w': pct(r['w'], w),
                'h': pct(r['h'], h),
            }
            for i, r in enumerate(o)
        ],
    }
    print(json.dumps(do, ensure_ascii=False, indent=2))
    print(f'\n→ {out}  {w}×{h}  {out.stat().st_size / 1024:.1f} KB '
          f'(PNG gốc {src.stat().st_size / 1024:.1f} KB)', file=sys.stderr)

    if len(sys.argv) > 2:
        cat_dong_tien(Path(sys.argv[2]), root)


def cat_dong_tien(src, root):
    """Cắt chồng tiền vàng ở góc dưới trái khay đồ, dùng cho hàng chân panel.

    Tiền nằm trên nền đá xám nâu, không phải nền đen, nên không lan biên được.
    Nhưng tiền vàng rất no màu còn đá thì xám: lấy alpha theo ĐỘ VÀNG
    (đỏ trừ lam) là tách sạch, kèm một ngưỡng sáng để bỏ vệt phản chiếu mờ.
    """
    a = np.array(Image.open(src).convert('RGB')).astype(np.int32)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    vang = (r > 110) & (g > 80) & (r - b > 55) & (r >= g)

    lab, n = nd.label(vang)
    if n == 0:
        sys.exit('Không thấy chồng tiền trong ảnh khay dưới')
    kich = nd.sum(np.ones_like(lab), lab, index=range(1, n + 1))
    l = int(np.argmax(kich)) + 1
    ys, xs = np.nonzero(lab == l)
    x0, x1 = int(xs.min()) - 6, int(xs.max()) + 7
    y0, y1 = int(ys.min()) - 6, int(ys.max()) + 7

    do_vang = np.clip((r - b - 30) / 55, 0, 1)
    sang = np.clip((a.max(axis=2) - 60) / 90, 0, 1)
    alpha = np.clip(do_vang * sang * 1.35, 0, 1)

    rgba = np.dstack([a.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    cat = rgba[y0:y1, x0:x1]
    out = root / 'img' / 'ui_coin.png'
    Image.fromarray(cat, 'RGBA').save(out, optimize=True)
    print(f'→ {out}  {cat.shape[1]}×{cat.shape[0]}  '
          f'{out.stat().st_size / 1024:.1f} KB', file=sys.stderr)


if __name__ == '__main__':
    main()
