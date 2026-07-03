const state = {
  inputMode: "text",
  inputType: "文字输入",
  files: [],
  skills: [],
  selectedSkill: null,
  currentResult: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function addFiles(fileList) {
  for (const file of fileList) {
    if (!isAllowedFile(file)) continue;
    state.files.push({
      id: crypto.randomUUID(),
      file,
    });
  }
  renderFiles();
}

function renderFiles() {
  $("#fileList").innerHTML = state.files
    .map(
      (item) => `<div class="file-item">
        <div>
          <strong>${escapeHtml(item.file.name)}</strong>
          <small>${escapeHtml(item.file.type || "unknown")} · ${formatBytes(item.file.size)}</small>
        </div>
        <button data-remove-file="${item.id}">移除</button>
      </div>`,
    )
    .join("");

  $$("[data-remove-file]").forEach((button) => {
    button.addEventListener("click", () => {
      state.files = state.files.filter((item) => item.id !== button.dataset.removeFile);
      renderFiles();
    });
  });
}

function renderSkills() {
  $("#skillSelect").innerHTML = state.skills
    .map((skill) => `<option value="${escapeHtml(skill.name)}">${escapeHtml(skill.displayName || skill.name)}</option>`)
    .join("");
  state.selectedSkill = getSelectedSkill();
}

async function loadSkills() {
  const response = await fetch("/api/skills");
  state.skills = await response.json();
  renderSkills();
}

async function loadStatus() {
  const response = await fetch("/api/status");
  const status = await response.json();
  const parts = [
    status.deepseekConfigured ? `DeepSeek 已配置 · ${status.model}` : "未配置 DeepSeek",
    status.feishuConfigured ? "飞书已配置" : "未配置飞书",
  ];
  $("#apiStatus").textContent = parts.join(" · ");
  $("#apiStatus").classList.toggle("ok", status.deepseekConfigured && status.feishuConfigured);
}

async function submitAnalysis() {
  const text = $("#textInput").value.trim();
  if (state.inputMode === "text" && !text) {
    alert("先粘贴文字。");
    return;
  }
  if (state.inputMode !== "text" && !state.files.length) {
    alert(state.inputMode === "image" ? "先粘贴截图。" : "先上传 .mov 视频文件。");
    return;
  }

  $("#submitBtn").disabled = true;
  $("#submitBtn").textContent = "分析中...";
  renderProgress(8, "正在上传素材");

  try {
    const files = [];
    for (const item of state.files) {
      files.push({
        name: item.file.name,
        type: item.file.type,
        size: item.file.size,
        dataUrl: await fileToDataUrl(item.file),
      });
    }

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputType: state.inputType,
        text,
        skillName: $("#skillSelect").value,
        files,
      }),
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "提交失败");
    if (!result.jobId) throw new Error("服务器没有返回任务 ID");

    await pollJob(result.jobId);
  } catch (error) {
    $("#resultMeta").textContent = "提交失败";
    renderError(error.message);
  } finally {
    $("#submitBtn").disabled = false;
    $("#submitBtn").textContent = "提交分析";
  }
}

async function pollJob(jobId) {
  while (true) {
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`);
    const job = await response.json();
    if (!response.ok) throw new Error(job.error || "任务查询失败");

    renderProgress(job.progress || 0, job.step || "处理中");

    if (job.status === "done") {
      const result = job.result;
      state.currentResult = result.output;
      const writeStatus = result.feishuError
        ? `飞书写入失败，本地已备份 · ${result.feishuError}`
        : `已写入飞书 ${result.feishuRecord?.tableName || ""}`;
      renderResult(
        result.output,
        `${writeStatus} · ${formatAnalysisType(result.analysisType)} #${result.id}`,
        state.selectedSkill,
      );
      return;
    }

    if (job.status === "error") {
      throw new Error(job.error || "任务失败");
    }

    await wait(1000);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderProgress(progress, step) {
  $("#emptyState").style.display = "none";
  $("#resultFields").classList.add("is-visible");
  $("#resultMeta").textContent = step;
  $("#resultFields").innerHTML = `<article class="progress-card">
    <div class="progress-head">
      <strong>${escapeHtml(step)}</strong>
      <span>${Math.max(0, Math.min(100, Math.round(progress)))}%</span>
    </div>
    <div class="progress-track">
      <div class="progress-bar" style="width: ${Math.max(0, Math.min(100, Number(progress) || 0))}%"></div>
    </div>
  </article>`;
}

function renderError(message) {
  $("#emptyState").style.display = "none";
  $("#resultFields").classList.add("is-visible");
  $("#resultFields").innerHTML = `<article class="field-card error-card">
    <h3>提交失败</h3>
    <pre>${escapeHtml(message || "未知错误")}</pre>
  </article>`;
}

function renderResult(output, meta, skill = state.selectedSkill) {
  $("#emptyState").style.display = "none";
  $("#resultFields").classList.add("is-visible");
  $("#resultMeta").textContent = meta;
  const fields = getOutputFields(skill, output);

  $("#resultFields").innerHTML = fields
    .map(
      ({ label, value }) => `<article class="field-card">
        <h3>${escapeHtml(label)}</h3>
        <pre>${escapeHtml(formatValue(value))}</pre>
      </article>`,
    )
    .join("");
}

function getOutputFields(skill, output) {
  const fields = skill?.outputFields?.length ? skill.outputFields : [];
  if (fields.length) {
    return fields.map((field) => ({ label: field.label, value: output[field.key] }));
  }
  return Object.keys(output || {}).map((key) => ({ label: key, value: output[key] }));
}

function getSelectedSkill() {
  return state.skills.find((skill) => skill.name === $("#skillSelect")?.value) || state.skills[0] || null;
}

function formatAnalysisType(analysisType) {
  if (analysisType === "user_pain") return "用户痛点";
  if (analysisType === "content_creation") return "内容创作";
  return analysisType || "分析";
}

function formatValue(value) {
  if (value === null || value === undefined) return "无";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function clearAll() {
  $("#textInput").value = "";
  $("#fileInput").value = "";
  state.files = [];
  renderFiles();
}

function addClipboardImages(event) {
  if (state.inputMode !== "image") return;
  const files = [];
  for (const item of event.clipboardData?.items || []) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) files.push(file);
    }
  }
  if (!files.length) return;
  event.preventDefault();
  addFiles(files);
}

function isAllowedFile(file) {
  if (state.inputMode === "image") return file.type.startsWith("image/");
  if (state.inputMode === "video") {
    const name = file.name.toLowerCase();
    return file.type === "video/quicktime" || name.endsWith(".mov");
  }
  return false;
}

function setInputMode(mode) {
  state.inputMode = mode;
  state.inputType = mode === "text" ? "文字输入" : mode === "image" ? "图片输入" : "视频输入";
  state.files = [];
  $("#fileInput").value = "";
  renderFiles();

  $$(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.inputMode === mode);
  });

  $("#textPanel").classList.toggle("is-hidden", mode !== "text");
  $("#uploadZone").classList.toggle("is-hidden", mode === "text");
  $("#textInput").disabled = mode !== "text";

  if (mode === "image") {
    $("#fileInput").disabled = true;
    $("#fileInput").accept = "";
    $("#uploadZone").classList.add("paste-only");
    $("#uploadTitle").textContent = "粘贴截图";
    $("#uploadHint").textContent = "复制截图后按 Cmd+V；图片会先 OCR，再交给 DeepSeek 分析。";
  }
  if (mode === "video") {
    $("#fileInput").disabled = false;
    $("#fileInput").accept = ".mov,video/quicktime";
    $("#uploadZone").classList.remove("paste-only");
    $("#uploadTitle").textContent = "上传苹果录屏 .mov";
    $("#uploadHint").textContent = "点击选择或拖拽 .mov 文件；系统会提取音频并转文字，再交给 DeepSeek 分析。";
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function initEvents() {
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => setInputMode(button.dataset.inputMode));
  });
  $("#skillSelect").addEventListener("change", () => {
    state.selectedSkill = getSelectedSkill();
  });
  $("#fileInput").addEventListener("change", (event) => addFiles(event.target.files));
  document.addEventListener("paste", addClipboardImages);
  $("#uploadZone").addEventListener("dragover", (event) => event.preventDefault());
  $("#uploadZone").addEventListener("drop", (event) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  });
  $("#submitBtn").addEventListener("click", submitAnalysis);
  $("#clearBtn").addEventListener("click", clearAll);
}

async function boot() {
  initEvents();
  renderFiles();
  await Promise.all([loadSkills(), loadStatus()]);
}

boot();
