#!/usr/bin/env bash
# Rebuild the reel from scratch (after tools/upscale.py + tools/prep_assets.py have produced assets/panels/*).
#   tools/build.sh [workdir]        -> out/robat-world-standards-day-reel.mp4
set -euo pipefail
cd "$(dirname "$0")/.."
W="${1:-/tmp/robat-reel-build}"
FRAMES=1140                       # 38 s @ 30 fps
mkdir -p "$W/frames" out

python3 -I tools/make_audio.py "$W/music.wav"

# render frames in 3 parallel chunks
third=$((FRAMES / 3))
for i in 0 1 2; do
  from=$((i * third)); to=$(((i + 1) * third - 1))
  node tools/render.mjs "$W/frames" --from "$from" --to "$to" &
done
wait

# music-only track (handy for mixing a voice-over later)
ffmpeg -y -loglevel error -i "$W/music.wav" -af "loudnorm=I=-17:TP=-1.5:LRA=9" -c:a aac -b:a 192k out/robat-world-standards-day-music-only.m4a

ffmpeg -y -loglevel error -framerate 30 -i "$W/frames/%05d.jpg" -i "$W/music.wav" \
  -filter_complex "[0:v]scale=1080:1920:flags=lanczos:out_color_matrix=bt709:out_range=tv,format=yuv420p[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=9,aresample=48000[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 22 -maxrate 9M -bufsize 18M -profile:v high -level 4.2 -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 192k -movflags +faststart -t 38 out/robat-world-standards-day-reel.mp4
ls -la out
