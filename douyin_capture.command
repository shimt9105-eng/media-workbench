#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_URL="${SERVER_URL:-http://localhost:5188}"
SKILL_NAME="${SKILL_NAME:-viral-script-remix}"
CAPTURE_DIR="$ROOT/uploads/douyin-captures/$(date +%Y%m%d-%H%M%S)"

mkdir -p "$CAPTURE_DIR"

if ! curl -fsS "$SERVER_URL/api/status" >/dev/null 2>&1; then
  osascript -e 'display alert "素材分析工作台没有启动" message "请先在项目里运行 PORT=5188 npm start，再重新打开这个采集器。"'
  exit 1
fi

osascript -e 'display dialog "第 1 步：打开抖音客户端，把要分析的视频停在合适画面。\n\n点击“继续”后，用鼠标框选视频主体、标题或字幕区域。" buttons {"继续"} default button "继续"'
screencapture -i "$CAPTURE_DIR/video.png"

if [[ ! -s "$CAPTURE_DIR/video.png" ]]; then
  osascript -e 'display alert "没有截到图片" message "已取消本次采集。"'
  exit 1
fi

captures=("$CAPTURE_DIR/video.png")

while true; do
  answer="$(osascript -e 'button returned of (display dialog "是否继续框选评论区截图？\n\n建议至少截 1 张评论区；如果评论很多，可以滚动后多截几张。" buttons {"完成并分析", "继续截图"} default button "继续截图")')"
  if [[ "$answer" != "继续截图" ]]; then
    break
  fi
  next="$CAPTURE_DIR/comments-${#captures}.png"
  screencapture -i "$next"
  if [[ -s "$next" ]]; then
    captures+=("$next")
  fi
done

osascript -e 'display notification "正在提交 DeepSeek 分析，请看终端进度。" with title "抖音素材采集器"'
python3 "$ROOT/scripts/submit_capture.py" "$SERVER_URL" "$SKILL_NAME" "${captures[@]}"
osascript -e 'display notification "分析完成，结果已写入工作台/本地备份。" with title "抖音素材采集器"'
