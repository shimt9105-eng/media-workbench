import json
import subprocess
import sys
import tempfile
from pathlib import Path

from faster_whisper import WhisperModel


ROOT = Path(__file__).resolve().parent
DEFAULT_CACHE = ROOT.parent / ".hf_transcribe"
DEFAULT_MODEL = "Systran/faster-whisper-tiny"


def extract_audio(video_path: Path, audio_path: Path):
    result = subprocess.run(
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
            "-f",
            "wav",
            str(audio_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr or result.stdout or "ffmpeg audio extraction failed")


def transcribe(video_path: Path):
    cache_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_CACHE
    model_name = sys.argv[3] if len(sys.argv) > 3 else DEFAULT_MODEL

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = Path(tmpdir) / "audio.wav"
        extract_audio(video_path, audio_path)

        model = WhisperModel(
            model_name,
            device="cpu",
            compute_type="int8",
            download_root=str(cache_dir),
        )
        segments, info = model.transcribe(
            str(audio_path),
            vad_filter=True,
            beam_size=1,
            language=None,
        )
        rows = [
            {
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip(),
            }
            for segment in segments
            if segment.text.strip()
        ]
        return {
            "language": info.language,
            "language_probability": info.language_probability,
            "text": "\n".join(row["text"] for row in rows),
            "segments": rows,
        }


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: transcribe_video.py <video-path> [cache-dir] [model]")
    result = transcribe(Path(sys.argv[1]).resolve())
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
