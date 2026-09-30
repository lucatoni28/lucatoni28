#!/usr/bin/env python3
"""Tách nền đen của bar-hud.png và đo hình học của thanh HUD.

    python3 tools/make-bar.py <bar-hud.png>

Ảnh gốc là RGB không có kênh alpha, vẽ trên nền ĐEN TUYỀN (42% số điểm ảnh
có giá trị 0). Không thể lấy alpha theo độ sáng vì chính phần đá của thanh
cũng rất tối — thân panel có trung vị 20 và phân vị 1 chỉ là 4, tức tối ngang
nền. Lan từ mép với ngưỡng rộng (< 40) thì thủng luôn cả thân panel, đã thử
và thấy rõ. Cách làm ở đây:

  1. Lan từ mép ảnh CHỈ qua các điểm gần đen tuyệt đối (< NGƯỠNG_NỀN = 6).
     Ở ngưỡng này vùng nền chiếm 24,6% ảnh và không rò vào thân panel; nới
     lên 14 cũng chỉ thành 26,7% nên biên độ an toàn là rộng.
  2. Lòng hai vòng cầu cũng là nền nhưng KHÔNG chạm mép ảnh (khe hở của vòng
     hẹp hơn ngưỡng), nên gieo thêm hạt tại tâm hai vòng đã đo được.
  3. Dải rộng VIỀN_MEM pixel quanh vùng nền lấy alpha mềm theo độ sáng, để mép
     không răng cưa. Ngoài dải đó giữ đục hoàn toàn, nên thân panel tối vẫn
     nguyên vẹn.

Đo đạc xuất ra là phần trăm so với ảnh ĐÃ CẮT, để CSS đặt theo % không lệch:

  - hai vòng cầu: khớp đường tròn theo TIA. Đầu sọ và đầu rồng đè lên vòng nên
    lòng vòng bị khoét, khớp bình phương tối thiểu thẳng vào biên lòng sẽ bị
    kéo lệch (đã thử: vòng phải lệch hẳn lên trên). Cách dùng ở đây bắn 1440
    tia từ tâm ước lượng, lấy bán kính tại chỗ tia ra khỏi lòng, rồi CHỈ khớp
    những tia dài nhất (từ phân vị 72 trở lên) — các tia bị đầu sọ chặn ngắn
    hơn nên tự rụng. Lặp 8 vòng, tâm hội tụ đúng vào tâm vòng.
  - bốn ô kỹ năng Q E 1 2: lòng ô là khe tối khép kín giữa khung ngoài và tấm
    nền trong; lấy hộp bao, bỏ hộp nằm lọt trong hộp khác.
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as nd

NGUONG_NEN = 6       # dưới mức này coi là nền khi lan từ mép
NGUONG_DAC = 40      # trong dải mềm, trên mức này alpha 255
SAN_ALPHA = 2        # dưới mức này alpha 0 hẳn
VIEN_MEM = 4         # bề rộng dải alpha mềm quanh nền, tính bằng pixel
NGUONG_O = 40        # ngưỡng tách lòng bốn ô kỹ năng


def disc(r):
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return x * x + y * y <= r * r


def main():
    if len(sys.argv) < 2:
        sys.exit('Thiếu đường dẫn bar-hud.png')
    src = Path(sys.argv[1])
    root = Path(__file__).resolve().parent.parent

    rgb = np.array(Image.open(src).convert('RGB')).astype(np.int32)
    h, w, _ = rgb.shape
    mx = rgb.max(axis=2)

    # --- 1. hai vòng cầu: khớp đường tròn theo tia --------------------------
    kin = nd.binary_closing(mx >= 20, structure=disc(9))
    lo, n = nd.label(~kin)
    bien = set(np.unique(np.concatenate(
        [lo[0, :], lo[-1, :], lo[:, 0], lo[:, -1]])).tolist()) - {0}

    def kasa(px, py):
        A = np.c_[2 * px, 2 * py, np.ones(len(px))]
        s, *_ = np.linalg.lstsq(A, px ** 2 + py ** 2, rcond=None)
        cx, cy, c = s
        return cx, cy, float(np.sqrt(c + cx * cx + cy * cy))

    def khop_tia(m, cx, cy):
        th = np.linspace(0, 2 * np.pi, 1440, endpoint=False)
        ct, st = np.cos(th), np.sin(th)
        rr = np.arange(0, 400, 0.5)
        for _ in range(8):
            xi = np.clip(np.round(cx + np.outer(rr, ct)).astype(int), 0, w - 1)
            yi = np.clip(np.round(cy + np.outer(rr, st)).astype(int), 0, h - 1)
            trong = m[yi, xi]
            dau = np.where(trong.all(axis=0), len(rr) - 1, np.argmax(~trong, axis=0))
            r = rr[dau]
            giu = r >= np.percentile(r, 72)
            cx, cy, R = kasa(cx + r[giu] * ct[giu], cy + r[giu] * st[giu])
        return cx, cy, R

    vong = []
    for l in range(1, n + 1):
        if l in bien:
            continue
        m = lo == l
        if m.sum() < 20000:
            continue
        yy, xx = np.nonzero(m)
        cx, cy, R = khop_tia(m, xx.mean(), yy.mean())
        vong.append({'cx': cx, 'cy': cy, 'r': R})
    vong.sort(key=lambda v: v['cx'])
    if len(vong) != 2:
        sys.exit(f'Chờ 2 vòng cầu, tìm được {len(vong)}')

    # Art vẽ hai vòng lệch nhau ~2,5%. Dùng chung bán kính nhỏ hơn (trừ thêm
    # LE_AN pixel) để hai quả cầu bằng nhau đúng như yêu cầu mà vẫn không tràn
    # ra ngoài viền nào.
    LE_AN = 6
    r_chung = min(v['r'] for v in vong) - LE_AN

    # --- 5. bốn ô kỹ năng --------------------------------------------------
    # Lòng ô là khe tối giữa khung ngoài và tấm nền trong, nên vùng tối khép
    # kín ở đây là một VIỀN mỏng (lấp chỉ ~19% hộp bao) chứ không phải khối
    # đặc — lọc theo độ lấp đầy là hỏng. Lấy hộp bao, rồi bỏ những hộp nằm lọt
    # trong hộp khác, vì mỗi ô còn có một ô lõm nhỏ hơn bên trong.
    lab2, n2 = nd.label(mx < NGUONG_O)
    nhan_bien_o = set(np.unique(np.concatenate(
        [lab2[0, :], lab2[-1, :], lab2[:, 0], lab2[:, -1]])).tolist()) - {0}
    tho = []
    for l in range(1, n2 + 1):
        if l in nhan_bien_o:
            continue
        m = lab2 == l
        if m.sum() < 2500:
            continue
        yy, xx = np.nonzero(m)
        bx0, bx1, by0, by1 = int(xx.min()), int(xx.max()), int(yy.min()), int(yy.max())
        bw, bh = bx1 - bx0 + 1, by1 - by0 + 1
        if not (120 <= bw <= 260 and 150 <= bh <= 300):
            continue
        tho.append({'x': bx0, 'y': by0, 'w': bw, 'h': bh})

    def long_trong(a, b):
        return (b['x'] <= a['x'] and b['y'] <= a['y']
                and b['x'] + b['w'] >= a['x'] + a['w']
                and b['y'] + b['h'] >= a['y'] + a['h'] and b is not a)

    o = [r for r in tho if not any(long_trong(r, s) for s in tho)]
    o.sort(key=lambda r: r['x'])
    if len(o) != 4:
        sys.exit(f'Chờ 4 ô kỹ năng, tìm được {len(o)}: {o}')

    # --- 3. tách nền -------------------------------------------------------
    lab3, _ = nd.label(mx < NGUONG_NEN)
    hat = set(np.unique(np.concatenate(
        [lab3[0, :], lab3[-1, :], lab3[:, 0], lab3[:, -1]])).tolist()) - {0}
    for v in vong:                       # gieo thêm tâm hai vòng cầu
        l = int(lab3[int(round(v['cy'])), int(round(v['cx']))])
        if l == 0:
            sys.exit('Tâm vòng cầu không nằm trong vùng tối — xem lại NGUONG_NEN')
        hat.add(l)
    nen = np.isin(lab3, list(hat))

    mem = nd.binary_dilation(nen, structure=disc(VIEN_MEM)) & ~nen
    ramp = np.clip((mx - SAN_ALPHA) / (NGUONG_DAC - SAN_ALPHA), 0, 1)
    alpha = np.where(nen, 0.0, np.where(mem, ramp, 1.0))

    rgba = np.dstack([rgb.astype(np.uint8), (alpha * 255).astype(np.uint8)])
    ys, xs = np.nonzero(alpha > 0.02)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    cat = rgba[y0:y1 + 1, x0:x1 + 1]
    ch, cw = cat.shape[:2]

    out = root / 'img' / 'ui_bar.png'
    Image.fromarray(cat, 'RGBA').save(out, optimize=True)

    def pct(v, tong):
        return round(v * 100 / tong, 4)

    # Hộp icon = hộp ô thu vào 9% mỗi chiều; số này ra gần đúng mặt tấm nền
    # trong đã đo được ở hai ô có vùng lõm rõ (153×178 so với khung 179×215).
    THU = 0.09

    do = {
        'nguon': src.name,
        'goc': [w, h],
        'cat': {'x': x0, 'y': y0, 'w': cw, 'h': ch},
        'ti_le': round(cw / ch, 4),
        'r_do_duoc_px': [round(v['r'], 1) for v in vong],
        'cau': [
            {
                'x': pct(v['cx'] - x0 - r_chung, cw),
                'y': pct(v['cy'] - y0 - r_chung, ch),
                'w': pct(2 * r_chung, cw),
                'h': pct(2 * r_chung, ch),
            }
            for v in vong
        ],
        'o': [
            {
                'x': pct(r['x'] - x0, cw),
                'y': pct(r['y'] - y0, ch),
                'w': pct(r['w'], cw),
                'h': pct(r['h'], ch),
                'icon': {
                    'x': pct(r['x'] - x0 + r['w'] * THU, cw),
                    'y': pct(r['y'] - y0 + r['h'] * THU, ch),
                    'w': pct(r['w'] * (1 - 2 * THU), cw),
                    'h': pct(r['h'] * (1 - 2 * THU), ch),
                },
            }
            for r in o
        ],
    }
    print(json.dumps(do, ensure_ascii=False, indent=2))
    print(f'\n→ {out}  {cw}×{ch}  {out.stat().st_size / 1024:.1f} KB', file=sys.stderr)
    print(f'  bán kính chung {r_chung:.1f}px (nhỏ nhất {min(v["r"] for v in vong):.1f} '
          f'trừ lề an toàn {LE_AN})', file=sys.stderr)


if __name__ == '__main__':
    main()
