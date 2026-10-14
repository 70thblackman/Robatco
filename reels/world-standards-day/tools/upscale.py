"""Crop the storyboard panels (removing the baked-in number badge) and upscale
them 4x with EDSR so they stay sharp in a 1080x1920 reel.

usage: python3 -I tools/upscale.py <path-to-EDSR_x4.pb>
(model: https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x4.pb)
"""
import sys, os, time
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "assets", "src")
OUT = os.path.join(ROOT, "assets", "panels")

# storyboard grid (1376x768): 3x3 panels separated by ~3px black lines
COLS = [(0, 456), (461, 914), (919, 1375)]
ROWS = [(0, 252), (258, 509), (515, 767)]
BADGE_X = 44  # the white-on-black panel number covers the top-left ~41x37 px
USED = {2: (0, 1), 3: (0, 2), 4: (1, 0), 5: (1, 1), 6: (1, 2), 7: (2, 0)}  # panel -> (row, col)


def make_sr(model):
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(model)
    sr.setModel("edsr", 4)
    return sr


def upscale_tiled(sr, img, tile=160, pad=8):
    h, w = img.shape[:2]
    out = np.zeros((h * 4, w * 4, 3), np.uint8)
    for y in range(0, h, tile):
        for x in range(0, w, tile):
            y0, x0 = max(0, y - pad), max(0, x - pad)
            y1, x1 = min(h, y + tile + pad), min(w, x + tile + pad)
            up = sr.upsample(img[y0:y1, x0:x1])
            ty0, tx0 = (y - y0) * 4, (x - x0) * 4
            th, tw = min(tile, h - y) * 4, min(tile, w - x) * 4
            out[y * 4:y * 4 + th, x * 4:x * 4 + tw] = up[ty0:ty0 + th, tx0:tx0 + tw]
    return out


def main():
    sr = make_sr(sys.argv[1])
    sb = cv2.imread(os.path.join(SRC, "storyboard.jpg"))
    for n, (r, c) in USED.items():
        (y0, y1), (x0, x1) = ROWS[r], COLS[c]
        crop = sb[y0 + 1:y1 - 1, x0 + BADGE_X:x1 - 1]
        t = time.time()
        up = upscale_tiled(sr, crop)
        cv2.imwrite(os.path.join(OUT, f"p{n}.jpg"), up, [cv2.IMWRITE_JPEG_QUALITY, 94])
        print(f"panel {n}: {crop.shape[1]}x{crop.shape[0]} -> {up.shape[1]}x{up.shape[0]} in {time.time()-t:.1f}s", flush=True)

    # portrait: only the head & torso area is ever zoomed into -> upscale that part 4x
    pt = cv2.imread(os.path.join(SRC, "portrait.jpg"))
    t = time.time()
    up = upscale_tiled(sr, pt[0:1100, :])
    cv2.imwrite(os.path.join(OUT, "portrait_top4x.jpg"), up, [cv2.IMWRITE_JPEG_QUALITY, 94])
    print(f"portrait top: {up.shape[1]}x{up.shape[0]} in {time.time()-t:.1f}s", flush=True)


if __name__ == "__main__":
    main()
