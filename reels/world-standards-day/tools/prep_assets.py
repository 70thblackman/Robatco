"""Derived assets: pre-blurred 9:16 backgrounds for each photo scene and the
portrait with extra headroom (so the camera can push in with the head lower in frame).
Run after tools/upscale.py:   python3 -I tools/prep_assets.py
"""
import os
import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAN = os.path.join(ROOT, "assets", "panels")
SRC = os.path.join(ROOT, "assets", "src")

# 1) blurred vertical backgrounds
for n in (2, 3, 4, 5, 6, 7):
    im = Image.open(os.path.join(PAN, f"p{n}.jpg")).convert("RGB")
    w, h = im.size
    tw = int(h * 9 / 16)                       # cover-crop to 9:16
    x0 = (w - tw) // 2
    im = im.crop((x0, 0, x0 + tw, h)).resize((216, 384), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(7))
    im.save(os.path.join(PAN, f"bg_p{n}.jpg"), quality=90)

# 2) portrait "world": the original padded with a flat sky-blue margin on every side so the camera can
#    start wide (full body, head low enough to clear the header) and push in. Margin = replicated, blurred edge rows/cols.
PADX, PADY = 300, 260                           # px in original portrait space


def pad_edges(img, px, py):
    h, w = img.shape[:2]
    k = max(3, int(round(min(h, w) / 120)) | 1)
    soft = cv2.GaussianBlur(img, (0, 0), k * 2)
    out = cv2.copyMakeBorder(soft, py, py, px, px, cv2.BORDER_REPLICATE)   # margins from the softened edges
    out[py:py + h, px:px + w] = img                                         # crisp original in the middle
    return out


pt = cv2.imread(os.path.join(SRC, "portrait.jpg"))
cv2.imwrite(os.path.join(PAN, "portrait_full.jpg"), pad_edges(pt, PADX, PADY), [cv2.IMWRITE_JPEG_QUALITY, 95])

p4 = os.path.join(PAN, "portrait_top4x.jpg")       # top 1100px of the portrait, EDSR 4x
if os.path.exists(p4):
    up = cv2.imread(p4)
    f = 2.8 / 4.0                                   # keep 2.8x (enough for a 2.3x on-screen push-in)
    up = cv2.resize(up, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    # sides/top margins only (no bottom margin: this layer is feathered out at its bottom edge)
    h, w = up.shape[:2]
    soft = cv2.GaussianBlur(up, (0, 0), 14)
    px, py = int(PADX * 2.8), int(PADY * 2.8)
    big = cv2.copyMakeBorder(soft, py, 0, px, px, cv2.BORDER_REPLICATE)
    big[py:py + h, px:px + w] = up
    cv2.imwrite(os.path.join(PAN, "portrait_top4x_ext.jpg"), big, [cv2.IMWRITE_JPEG_QUALITY, 93])
    print("B layer", big.shape[1], "x", big.shape[0])
print("ok")
