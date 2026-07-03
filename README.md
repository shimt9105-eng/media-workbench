# 素材分析工作台

这是一个本地工具，用来把文字、截图、苹果录屏等素材交给 DeepSeek 分析，并写入 SQLite，方便后续周期复盘。

同一个系统支持两种分析模式：

- `content-creation`：内容创作分析，生成关键词、选题、视频拆解、平台脚本、营销风险扫描。
- `user-pain-insight`：用户痛点分析，生成痛点原话、用户画像、昵称/平台建联线索。

## 启动

先复制环境变量：

```bash
cp .env.example .env
```

然后在 `.env` 里填写：

```text
DEEPSEEK_API_KEY=你的 key
FEISHU_APP_ID=飞书自建应用 app id
FEISHU_APP_SECRET=飞书自建应用 app secret
```

双击 `start.command`，或在终端运行：

```bash
npm install
./start.command
```

打开：

```text
http://localhost:5177
```

## 四个模块

- 文字输入：粘贴文字。
- 图片输入：复制截图后 Cmd+V 粘贴，并用 `tesseract.js` 做本地 OCR。
- 视频输入：上传苹果录屏 `.mov`，使用 `ffmpeg` 提取音频，再用 `faster-whisper-tiny` 语音转文字，优先保证速度。
- Skill 选择：默认初始化了 `content-creation` 和 `user-pain-insight`，后续可在 `skills/` 目录继续维护并提交到 GitHub。
- DeepSeek 分析：根据所选 skill 读取对应输出 schema，不同模式生成不同 JSON。
- 飞书存储：结果写入飞书多维表格；本地 SQLite 只作为备份。

## 飞书多维表格

内容创作分析写入这个 Base：

```text
S7wIbd0ZQa60VIsCbkfcZ2QTntg
```

用户痛点分析写入这个 Base：

```text
BSr5bPvTPaL5LdsBV9vcq1zen4e
```

每次提交时，系统会在对应 Base 里查找当月数据表，例如 `2026-07`。如果当月表不存在，会自动创建；当月所有记录都会写入该月表。

需要给飞书自建应用开通多维表格读写权限，并把该应用添加为两个 Base 的协作者。

## SQLite 表

- `content_creation_records`：维护内容创作分析记录。
- `user_pain_records`：维护用户痛点分析记录。

两张表字段一致，便于统一历史展示：`input_type`、`text_input`、`skill_name`、`files_json`、`ocr_text`、`prompt`、`output_json`、`title`、`summary`、`created_at`。

## 合规原则

只处理你自己拥有、授权、手动摘录或公开工具导出的内容。不要用它配合爬虫、模拟浏览器或绕过平台风控。后续私信建联时避免发送骚扰、误导或侵犯隐私的内容。

## Docker 部署

项目已包含：

- `Dockerfile`
- `requirements.txt`
- `.dockerignore`

本地测试镜像：

```bash
docker build -t media-keyword-workbench .
docker run --env-file .env -p 5188:10000 media-keyword-workbench
```

部署到 Render 时选择 Docker Web Service，并在 Render 环境变量里配置 `.env.example` 中的变量。不要把本地 `.env` 提交到 GitHub。
