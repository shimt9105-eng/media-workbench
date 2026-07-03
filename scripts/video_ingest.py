#!/usr/bin/env python3
"""
Extract frames, audio, and metadata from an authorized video source.

Supported inputs:
- Local video files, e.g. ./uploads/example.mp4
- Direct media URLs ending in .mp4/.mov/.m4v/.webm or returning video/*

Intentionally unsupported:
- Automated extraction from social platform share pages such as Douyin pages.
  Use a video file you have permission to process, or an official/authorized API.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path


VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}


def run(command: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(command, check=True, text=True, capture_output=True)


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise SystemExit(f"Missing required binary: {name}")
    return path


def is_url(value: str) -> bool:
    parsed = urllib.parse.urlparse(value)
    return parsed.scheme in {"http", "https"}


def looks_like_direct_video_url(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    suffix = Path(parsed.path).suffix.lower()
    return suffix in VIDEO_EXTENSIONS


def download_direct_video(url: str, output_dir: Path) -> Path:
    if not looks_like_direct_video_url(url):
        raise SystemExit(
            "This looks like a webpage/share link, not a direct video file URL. "
            "For Douyin links, manually download/upload an authorized video file "
            "or use an official authorized API instead of automated page extraction."
        )

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "media-keyword-workbench/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        content_type = response.headers.get("content-type", "").lower()
        if content_type and not content_type.startswith("video/") and "octet-stream" not in content_type:
            raise SystemExit(f"URL did not return a video content-type: {content_type}")

        suffix = Path(urllib.parse.urlparse(url).path).suffix or mimetypes.guess_extension(content_type) or ".mp4"
        target = output_dir / f"source{suffix}"
        with target.open("wb") as handle:
            shutil.copyfileobj(response, handle)
    return target


def resolve_source(source: str, output_dir: Path) -> Path:
    if is_url(source):
        return download_direct_video(source, output_dir)

    path = Path(source).expanduser().resolve()
    if not path.exists():
        raise SystemExit(f"Video file not found: {path}")
    if path.suffix.lower() not in VIDEO_EXTENSIONS:
        raise SystemExit(f"Unsupported video extension: {path.suffix}")
    return path


def probe_video(video_path: Path) -> dict:
    result = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(video_path),
        ]
    )
    data = json.loads(result.stdout)
    video_stream = next((stream for stream in data.get("streams", []) if stream.get("codec_type") == "video"), {})
    audio_stream = next((stream for stream in data.get("streams", []) if stream.get("codec_type") == "audio"), {})
    return {
        "format": data.get("format", {}),
        "video": video_stream,
        "audio": audio_stream,
    }


def extract_frames(video_path: Path, frames_dir: Path, every_seconds: float, max_frames: int) -> list[str]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    pattern = frames_dir / "frame_%04d.jpg"
    fps_expr = f"fps=1/{every_seconds}"
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vf",
            fps_expr,
            "-frames:v",
            str(max_frames),
            "-q:v",
            "3",
            str(pattern),
        ]
    )
    return [str(path) for path in sorted(frames_dir.glob("frame_*.jpg"))]


def extract_audio(video_path: Path, output_dir: Path) -> str | None:
    audio_path = output_dir / "audio.wav"
    try:
        run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(video_path),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                str(audio_path),
            ]
        )
    except subprocess.CalledProcessError:
        return None
    return str(audio_path) if audio_path.exists() else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract video frames, audio, and metadata.")
    parser.add_argument("source", help="Local video path or direct video file URL.")
    parser.add_argument("--out", default="video-analysis-output", help="Output directory.")
    parser.add_argument("--every-seconds", type=float, default=2.0, help="Frame extraction interval.")
    parser.add_argument("--max-frames", type=int, default=30, help="Maximum frames to extract.")
    args = parser.parse_args()

    require_binary("ffmpeg")
    require_binary("ffprobe")

    output_dir = Path(args.out).expanduser().resolve()
    run_dir = output_dir / time.strftime("%Y%m%d-%H%M%S")
    run_dir.mkdir(parents=True, exist_ok=True)

    source_path = resolve_source(args.source, run_dir)
    metadata = probe_video(source_path)
    frames = extract_frames(source_path, run_dir / "frames", args.every_seconds, args.max_frames)
    audio = extract_audio(source_path, run_dir)

    manifest = {
        "source_input": args.source,
        "source_path": str(source_path),
        "output_dir": str(run_dir),
        "metadata": metadata,
        "frames": frames,
        "audio": audio,
        "notes": [
            "Frames are sampled for visual analysis.",
            "Audio is extracted as 16kHz mono wav for downstream transcription.",
            "This script does not scrape Douyin or bypass platform access controls.",
        ],
    }

    manifest_path = run_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"manifest": str(manifest_path), "frames": len(frames), "audio": audio}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
