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

mkdir -p "${MP4_OUTPUT_DIR}" "${HLS_OUTPUT_DIR}"

ffmpeg -y \
  -i "${SOURCE_FILE}" \
  -c copy \
  -movflags +faststart \
  "${MP4_OUTPUT_DIR}/sample.mp4"

ffmpeg -y \
  -i "${SOURCE_FILE}" \
  -codec:v libx264 \
  -codec:a aac \
  -preset veryfast \
  -g 48 \
  -sc_threshold 0 \
  -hls_time 2 \
  -hls_playlist_type vod \
  -hls_segment_filename "${HLS_OUTPUT_DIR}/segment-%03d.ts" \
  "${HLS_OUTPUT_DIR}/master.m3u8"

echo "Generated:"
echo "  - ${MP4_OUTPUT_DIR}/sample.mp4"
echo "  - ${HLS_OUTPUT_DIR}/master.m3u8"
