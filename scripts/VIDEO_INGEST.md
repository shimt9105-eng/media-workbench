# Video Ingest Script

Use this for videos you have permission to process.

```bash
python3 scripts/video_ingest.py /path/to/video.mp4 --out data/video-analysis
```

It produces:

- `manifest.json`
- sampled frames in `frames/`
- `audio.wav` at 16kHz mono

Direct media URLs are supported only when they are actual video file URLs, such as `.mp4`. Douyin share pages are intentionally not downloaded by this script; manually upload an authorized video file or use an official authorized API.
