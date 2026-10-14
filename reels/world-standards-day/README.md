# ریلز روز جهانی استاندارد — دکتر قازاریان (۳۸ ثانیه، ۹:۱۶)

خروجی‌ها در `out/`:

| فایل | توضیح |
|---|---|
| `robat-world-standards-day-reel.mp4` | نسخه‌ی ۱ (اول‌شخص: «من دکتر قازاریان هستم…») ۱۰۸۰×۱۹۲۰، ۳۰fps، ۳۸ ثانیه، با موسیقی و زیرنویس فارسی |
| `robat-world-standards-day-reel-v2-narrator.mp4` | نسخه‌ی ۲ (سوم‌شخص: «امروز، به یاد دکتر قازاریان…»)؛ همان تصاویر و موسیقی. با `--variant 2` ساخته می‌شود |
| `robat-world-standards-day-music-only.m4a` | فقط موسیقی و افکت‌ها، برای افزودن صدای گوینده |
| `captions.fa.srt` / `captions.fa.v2-narrator.srt` | زیرنویس فارسی (برای ریلز/تلگرام/CapCut؛ در خود ویدیو هم سوخته است) |
| `voiceover-timing.fa.md` / `voiceover-timing.fa.v2-narrator.md` | متن و بازه‌ی زمانی هر جمله برای ضبط صدا |

## ساختار پروژه

- `assets/src/` عکس‌های اصلی (لوگو، پرتره، استوری‌بورد، کارت معرفی)
- `assets/panels/` پنل‌های برش‌خورده از استوری‌بورد، ۴ برابر بزرگ‌شده با EDSR
- `src/index.html` + `src/main.js` صحنه‌ها؛ `renderFrame(t)` هر فریم را بر اساس زمان می‌کشد (زمان‌بندی در `TL` و `SCENES`)
- `tools/` اسکریپت‌های ساخت (`upscale.py`، `prep_assets.py`، `make_audio.py`، `render.mjs`، `build.sh`)

## ساخت دوباره

```bash
pip install numpy scipy opencv-contrib-python-headless pillow
npm i playwright            # + chromium
python3 -I tools/upscale.py EDSR_x4.pb   # فقط اگر عکس‌ها را عوض کردید
python3 -I tools/prep_assets.py
tools/build.sh
```

اگر تصویر اصلیِ هر پنل را با وضوح بالاتر دارید، فایل `assets/panels/pN.jpg` را جایگزین کنید (۲ تا ۷) و دوباره `build.sh` را بزنید.

فونت: Vazirmatn (OFL). موسیقی از صفر با کد ساخته شده و حق‌کپی ندارد.
