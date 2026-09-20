#!/usr/bin/env python3
"""Cắt viền trong suốt của logo màn khởi đầu và ghi ra img/ui_title.png.

    python3 tools/make-title.py <Logo_login.PNG>

Ảnh gốc 1280×1280 RGBA. Chỉ cắt phần biên TRONG SUỐT HẲN, không đụng gì tới
nội dung: chữ MU ở nửa trên và phù hiệu mờ ở nửa dưới đều giữ nguyên. In ra
tỉ lệ sau khi cắt để đặt cho ô chứa trong CSS.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image

NGUONG = 8   # alpha dưới mức này coi là trong suốt hẳn


def main():
    if len(sys.argv) < 2:
        sys.exit('Thiếu đường dẫn Logo_login.PNG')
    src = Path(sys.argv[1])
    root = Path(__file__).resolve().parent.parent

    im = Image.open(src).convert('RGBA')
    a = np.array(im)
    ys, xs = np.nonzero(a[:, :, 3] > NGUONG)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    cat = im.crop((x0, y0, x1 + 1, y1 + 1))

    out = root / 'img' / 'ui_title.png'
    cat.save(out, optimize=True)

    w, h = cat.size
    print(f'{src.name} {im.size[0]}×{im.size[1]} → {out.name} {w}×{h}')
    print(f'tỉ lệ ngang/dọc = {w / h:.4f}')
    print(f'{out.stat().st_size / 1024:.1f} KB')

    # Chữ MU sáng nằm ở đâu trong ảnh đã cắt — để biết ô chứa cao bao nhiêu thì
    # phần chữ còn đọc được.
    b = np.array(cat)
    manh = (b[:, :, 3] > 200) & (b[:, :, :3].max(axis=2) > 190)
    yy, xx = np.nonzero(manh)
    print(f'phần chữ sáng: x[{xx.min()},{xx.max()}] y[{yy.min()},{yy.max()}]'
          f' = {xx.max() - xx.min() + 1}×{yy.max() - yy.min() + 1}'
          f', chiếm {(yy.max() + 1) * 100 // h}% chiều cao tính từ trên')


if __name__ == '__main__':
    main()
