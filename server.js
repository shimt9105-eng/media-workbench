const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { isFeishuConfigured, writeAnalysisToFeishu } = require("./feishu");

const root = __dirname;
const port = Number(process.env.PORT || 5177);
const pythonBin = process.env.PYTHON_BIN || "python3";
const transcribePython = process.env.TRANSCRIBE_PYTHON || pythonBin;
const transcribeCacheDir = process.env.TRANSCRIBE_CACHE_DIR || path.join(root, ".hf_transcribe");
const transcribeModel = process.env.TRANSCRIBE_MODEL || "Systran/faster-whisper-small";

loadDotEnv();

const dataDir = path.join(root, "data");
const uploadDir = path.join(root, "uploads");
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });
runDb("init", {});

const mime = {
  ".html": "text/html;charset=utf-8",
  ".css": "text/css;charset=utf-8",
  ".js": "application/javascript;charset=utf-8",
  ".json": "application/json;charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

function loadDotEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=").replace(/^["']|["']$/g, "");
  }
}

function send(res, status, body, type = "text/plain;charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function sendJson(res, status, body) {
  send(res, status, JSON.stringify(body), "application/json;charset=utf-8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 500 * 1024 * 1024) {
        reject(new Error("请求太大，请减少视频数量或压缩后再上传"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function runDb(action, payload) {
  const result = spawnSync(pythonBin, [path.join(root, "db.py"), action], {
    input: JSON.stringify(payload || {}),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "SQLite 操作失败");
  }

  return result.stdout ? JSON.parse(result.stdout) : null;
}

function listSkills() {
  const skillsDir = path.join(root, "skills");
  if (!fs.existsSync(skillsDir)) return [];

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillDir = path.join(skillsDir, entry.name);
      const skillPath = path.join(skillDir, "SKILL.md");
      const schemaPath = path.join(skillDir, "references", "output-schema.md");
      const agentPath = path.join(skillDir, "agents", "openai.yaml");
      const skillText = fs.existsSync(skillPath) ? fs.readFileSync(skillPath, "utf8") : "";
      const schemaText = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "";
      const agentText = fs.existsSync(agentPath) ? fs.readFileSync(agentPath, "utf8") : "";
      const displayName = (agentText.match(/display_name:\s*"?([^"\n]+)"?/) || [])[1] || entry.name;
      const analysisType =
        (agentText.match(/analysis_type:\s*"?([^"\n]+)"?/) || [])[1] || "content_creation";
      const outputFields = parseOutputFields(agentText);
      return {
        name: entry.name,
        displayName,
        analysisType,
        outputFields,
        path: skillPath,
        text: [skillText, schemaText ? `\n\n# Referenced Output Schema\n\n${schemaText}` : ""].join(""),
      };
    });
}

function parseOutputFields(agentText) {
  const fields = [];
  const fieldPattern = /-\s+key:\s*"?([^"\n]+)"?\s*\n\s+label:\s*"?([^"\n]+)"?/g;
  let match;
  while ((match = fieldPattern.exec(agentText)) !== null) {
    fields.push({ key: match[1].trim(), label: match[2].trim() });
  }
  return fields;
}

function getSkill(name) {
  const skill = listSkills().find((item) => item.name === name);
  if (!skill) throw new Error(`未找到 skill：${name}`);
  return skill;
}

function saveFile(file) {
  const comma = file.dataUrl.indexOf(",");
  if (comma === -1) throw new Error(`文件格式错误：${file.name}`);
  const header = file.dataUrl.slice(0, comma);
  const buffer = Buffer.from(file.dataUrl.slice(comma + 1), "base64");
  const safeName = file.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, "_");
  const filename = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);
  return {
    original_name: file.name,
    stored_path: filePath,
    mime_type: file.type || header.replace(/^data:|;base64$/g, ""),
    size: file.size || buffer.length,
  };
}

async function ocrImage(fileInfo) {
  if (!fileInfo.mime_type.startsWith("image/")) return "";

  try {
    const { createWorker } = require("tesseract.js");
    const worker = await createWorker("chi_sim+eng");
    const result = await worker.recognize(fileInfo.stored_path);
    await worker.terminate();
    return result.data.text || "";
  } catch (error) {
    return `【OCR失败：${error.message}】`;
  }
}

function isVideo(fileInfo) {
  const name = fileInfo.original_name.toLowerCase();
  return fileInfo.mime_type === "video/quicktime" || name.endsWith(".mov");
}

function transcribeVideo(fileInfo) {
  if (!isVideo(fileInfo)) return "";
  const result = spawnSync(
    transcribePython,
    [path.join(root, "transcribe_video.py"), fileInfo.stored_path, transcribeCacheDir, transcribeModel],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );

  if (result.status !== 0) {
    return `【语音转文字失败：${result.stderr || result.stdout || "转写脚本执行失败"}】`;
  }

  try {
    const data = JSON.parse(result.stdout || "{}");
    const text = data.text || "";
    if (!text.trim()) return "【语音转文字结果为空：视频可能没有可识别的人声或音轨】";
    return [
      `识别语言：${data.language || "unknown"}，置信度：${Number(data.language_probability || 0).toFixed(2)}`,
      text,
    ].join("\n");
  } catch (error) {
    return `【语音转文字结果解析失败：${error.message}】\n${result.stdout || ""}`;
  }
}

function extractTextFile(fileInfo) {
  const name = fileInfo.original_name.toLowerCase();
  const isText =
    fileInfo.mime_type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".csv");
  if (!isText) return "";

  try {
    return fs.readFileSync(fileInfo.stored_path, "utf8");
  } catch (error) {
    return `【文本文件读取失败：${error.message}】`;
  }
}

function buildPrompt({ skill, inputType, text, files, ocrTexts }) {
  const fileSummary = files
    .map((file, index) => {
      const ocr = ocrTexts[index] ? `\nOCR文字：${ocrTexts[index]}` : "";
      return `文件${index + 1}：${file.original_name}；类型：${file.mime_type}；大小：${file.size} bytes${ocr}`;
    })
    .join("\n\n");

  return [
    "你是一个素材分析助手。请严格按用户选择的 skill 执行，不要混用其他分析模式。",
    "【Skill】",
    skill.text,
    "【材料类型】",
    inputType,
    "【用户粘贴/补充文字】",
    text || "无",
    "【附件信息】",
    fileSummary || "无",
    "【输出要求】",
    "只输出一个 JSON 对象，不要 Markdown，不要代码块。",
    "JSON 顶层字段必须严格匹配所选 Skill 中 Required JSON Shape 和 Referenced Output Schema 的要求。",
    "不要编造材料里不存在的事实、原话、昵称、平台、指标或截图内容。",
  ].join("\n\n");
}

async function callDeepSeek(prompt) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("未配置 DEEPSEEK_API_KEY。请在 .env 中填写后重启服务。");
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你只输出可解析 JSON。不要输出 Markdown、解释、代码块或额外文本。",
        },
        { role: "user", content: prompt },
      ],
      temperature: Number(process.env.DEEPSEEK_TEMPERATURE || 0.4),
      response_format: { type: "json_object" },
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || `DeepSeek 调用失败：${response.status}`);
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek 没有返回内容");
  return parseJsonContent(content);
}

function parseJsonContent(content) {
  try {
    return JSON.parse(content);
  } catch (_error) {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("DeepSeek 返回内容不是 JSON");
    return JSON.parse(match[0]);
  }
}

async function handleAnalyze(req, res) {
  const raw = await readBody(req);
  const payload = JSON.parse(raw || "{}");
  const skill = getSkill(payload.skillName);
  const savedFiles = [];
  const ocrTexts = [];

  for (const file of payload.files || []) {
    const saved = saveFile(file);
    savedFiles.push(saved);
    ocrTexts.push(extractTextFile(saved) || (await ocrImage(saved)) || transcribeVideo(saved));
  }

  const prompt = buildPrompt({
    skill,
    inputType: payload.inputType || "作品",
    text: payload.text || "",
    files: savedFiles,
    ocrTexts,
  });

  const output = await callDeepSeek(prompt);
  const recordPayload = {
    analysis_type: skill.analysisType,
    input_type: payload.inputType || "作品",
    text_input: payload.text || "",
    skill_name: skill.name,
    files_json: savedFiles,
    ocr_text: ocrTexts.join("\n\n"),
    prompt,
    output_json: output,
    title: output.title || inferTitle(output, skill.analysisType),
    summary: output.summary || summarizeOutput(output, skill.analysisType),
  };
  const record = runDb("insert", recordPayload);
  const feishuRecord = await writeAnalysisToFeishu({
    ...recordPayload,
    local_id: record.id,
  });

  sendJson(res, 200, { id: record.id, analysisType: skill.analysisType, feishuRecord, output });
}

function inferTitle(output, analysisType) {
  if (analysisType === "user_pain") return output.pain_points?.[0]?.pain_point || "";
  return output.topics?.candidate_topics?.[0]?.title || "";
}

function summarizeOutput(output, analysisType) {
  if (analysisType === "user_pain") return summarizeLeadOutput(output);
  return output.summary || "";
}

function summarizeLeadOutput(output) {
  const painCount = Array.isArray(output.pain_points) ? output.pain_points.length : 0;
  const profileCount = Array.isArray(output.user_profiles) ? output.user_profiles.length : 0;
  const leadCount = Array.isArray(output.contact_leads) ? output.contact_leads.length : 0;
  return `提取 ${painCount} 条痛点、${profileCount} 类画像标签、${leadCount} 条昵称/平台线索。`;
}

async function route(req, res) {
  try {
    if (req.method === "GET" && req.url === "/api/status") {
      sendJson(res, 200, {
        deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
        feishuConfigured: isFeishuConfigured(),
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      });
      return;
    }

    if (req.method === "GET" && req.url === "/api/skills") {
      sendJson(
        res,
        200,
        listSkills().map(({ name, displayName, analysisType, outputFields }) => ({
          name,
          displayName,
          analysisType,
          outputFields,
        })),
      );
      return;
    }

    if (req.method === "GET" && req.url === "/api/records") {
      sendJson(res, 200, runDb("list", {}));
      return;
    }

    const recordMatch =
      req.method === "GET" && decodeURIComponent(req.url).match(/^\/api\/records\/([^:]+):(\d+)/);
    if (recordMatch) {
      sendJson(res, 200, runDb("get", { analysis_type: recordMatch[1], id: Number(recordMatch[2]) }));
      return;
    }

    if (req.method === "POST" && req.url === "/api/analyze") {
      await handleAnalyze(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "服务器错误" });
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const requested = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(root, requested));

  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }
    send(res, 200, data, mime[path.extname(filePath)] || "application/octet-stream");
  });
}

const server = http.createServer(route);
server.listen(port, () => {
  console.log(`素材分析工作台已启动：http://localhost:${port}`);
});
