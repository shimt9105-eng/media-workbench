#!/usr/bin/env python3
import base64
import json
import mimetypes
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def request_json(url, method="GET", payload=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = {"error": body}
        return error.code, parsed


def file_to_payload(path):
    file_path = Path(path)
    mime_type = mimetypes.guess_type(file_path.name)[0] or "image/png"
    encoded = base64.b64encode(file_path.read_bytes()).decode("ascii")
    return {
        "name": file_path.name,
        "type": mime_type,
        "size": file_path.stat().st_size,
        "dataUrl": f"data:{mime_type};base64,{encoded}",
    }


def main():
    if len(sys.argv) < 4:
        raise SystemExit("Usage: submit_capture.py SERVER_URL SKILL_NAME IMAGE...")

    server_url = sys.argv[1].rstrip("/")
    skill_name = sys.argv[2]
    image_paths = sys.argv[3:]

    files = [file_to_payload(path) for path in image_paths]
    payload = {
        "inputType": "抖音客户端截图",
        "text": "这些截图来自抖音电脑客户端。请综合视频画面、字幕、标题和评论区内容，生成仿写脚本。",
        "skillName": skill_name,
        "files": files,
    }

    status, created = request_json(f"{server_url}/api/analyze", method="POST", payload=payload)
    if status >= 400:
        raise SystemExit(created.get("error") or f"提交失败：HTTP {status}")

    job_id = created.get("jobId")
    if not job_id:
        raise SystemExit("提交失败：服务器没有返回 jobId")

    while True:
        status, job = request_json(f"{server_url}/api/jobs/{job_id}")
        if status >= 400:
            raise SystemExit(job.get("error") or f"任务查询失败：HTTP {status}")

        progress = int(job.get("progress") or 0)
        step = job.get("step") or "处理中"
        print(f"[{progress:3d}%] {step}", flush=True)

        if job.get("status") == "done":
            result = job.get("result") or {}
            print(json.dumps(result.get("output") or {}, ensure_ascii=False, indent=2))
            if result.get("feishuError"):
                print(f"\n飞书写入失败，本地已备份：{result['feishuError']}")
            else:
                table_name = (result.get("feishuRecord") or {}).get("tableName") or ""
                print(f"\n已写入飞书：{table_name}")
            return

        if job.get("status") == "error":
            raise SystemExit(job.get("error") or "任务失败")

        time.sleep(1)


if __name__ == "__main__":
    main()
