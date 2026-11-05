#!/bin/sh
# Run from the project root with an FFmpeg build that includes librubberband.
set -eu
for tier in blue:2 purple:4 rainbow:8; do
  color=${tier%:*}
  ratio=${tier#*:}
  ffmpeg -nostdin -hide_banner -loglevel error -y \
    -i assets/sounds/goldenorbspickup.mp3 \
    -af "rubberband=pitch=$ratio:pitchq=quality,alimiter=limit=0.85:level=false" \
    -codec:a libmp3lame -q:a 3 "assets/sounds/orb-pickup-$color.mp3"
done
