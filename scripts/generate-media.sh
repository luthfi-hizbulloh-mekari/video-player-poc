#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_FILE="${ROOT_DIR}/media/source/sample.mp4"
MP4_OUTPUT_DIR="${ROOT_DIR}/media/output/mp4"
HLS_OUTPUT_DIR="${ROOT_DIR}/media/output/hls/sample"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required. Install it first, then rerun this script." >&2
  exit 1
fi

if [[ ! -f "${SOURCE_FILE}" ]]; then
  echo "Missing source fixture at ${SOURCE_FILE}" >&2
  echo "Place a sample source video there before running media generation." >&2
  exit 1
fi

mkdir -p "${MP4_OUTPUT_DIR}" "${HLS_OUTPUT_DIR}/stream_0" "${HLS_OUTPUT_DIR}/stream_1" "${HLS_OUTPUT_DIR}/stream_2"

echo "==> Generating MP4 (passthrough)…"
ffmpeg -y \
  -i "${SOURCE_FILE}" \
  -c copy \
  -movflags +faststart \
  "${MP4_OUTPUT_DIR}/sample.mp4"

echo "==> Generating multi-rendition fMP4 HLS…"
ffmpeg -y \
  -i "${SOURCE_FILE}" \
  -filter_complex "[0:v]split=3[v1][v2][v3]; \
    [v1]scale=w=-2:h=720[v720]; \
    [v2]scale=w=-2:h=480[v480]; \
    [v3]scale=w=-2:h=360[v360]" \
  -map "[v720]" -map 0:a -map "[v480]" -map 0:a -map "[v360]" -map 0:a \
  -c:v libx264 -preset medium -profile:v main \
  -c:a aac -ar 48000 \
  -b:v:0 2800k -maxrate:v:0 2996k -bufsize:v:0 4200k \
  -b:v:1 1400k -maxrate:v:1 1498k -bufsize:v:1 2100k \
  -b:v:2 800k  -maxrate:v:2 856k  -bufsize:v:2 1200k \
  -b:a:0 128k -b:a:1 128k -b:a:2 128k \
  -g 144 -keyint_min 144 -sc_threshold 0 \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_segment_type fmp4 \
  -hls_fmp4_init_filename "init.mp4" \
  -hls_segment_filename "${HLS_OUTPUT_DIR}/stream_%v/segment-%03d.m4s" \
  -master_pl_name master.m3u8 \
  -var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2" \
  "${HLS_OUTPUT_DIR}/stream_%v/playlist.m3u8"

echo "Generated:"
echo "  - ${MP4_OUTPUT_DIR}/sample.mp4"
echo "  - ${HLS_OUTPUT_DIR}/master.m3u8 (multi-rendition fMP4)"
