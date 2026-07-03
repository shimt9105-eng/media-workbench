const FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";

const FIELD_TYPE_TEXT = 1;
let tokenCache = null;

const MONTHLY_FIELDS = [
  "标题",
  "摘要",
  "分析类型",
  "输入类型",
  "Skill",
  "原始文字",
  "OCR或转写文字",
  "输出JSON",
  "文件JSON",
  "本地记录ID",
  "创建时间",
];

function isFeishuConfigured() {
  return Boolean(process.env.FEISHU_APP_ID && process.env.FEISHU_APP_SECRET);
}

function getFeishuTarget(analysisType) {
  if (analysisType === "user_pain") {
    return {
      appToken: process.env.FEISHU_USER_PAIN_APP_TOKEN || "BSr5bPvTPaL5LdsBV9vcq1zen4e",
      templateTableId: process.env.FEISHU_USER_PAIN_TEMPLATE_TABLE_ID || "tblGMoNcGRaEzo52",
      tableNameSuffix: "用户痛点",
    };
  }

  return {
    appToken: process.env.FEISHU_CONTENT_APP_TOKEN || "S7wIbd0ZQa60VIsCbkfcZ2QTntg",
    templateTableId: process.env.FEISHU_CONTENT_TEMPLATE_TABLE_ID || "tbleW3viGAqwA5ro",
    tableNameSuffix: "内容创作",
  };
}

function getMonthTableName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function feishuFetch(path, options = {}) {
  const response = await fetch(`${FEISHU_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok || data.code !== 0) {
    throw new Error(data.msg || data.error?.message || `飞书 API 调用失败：${response.status}`);
  }
  return data.data || data;
}

async function getTenantAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60 * 1000) {
    return tokenCache.token;
  }

  const data = await feishuFetch("/auth/v3/tenant_access_token/internal", {
    method: "POST",
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET,
    }),
  });
  if (!data.tenant_access_token) throw new Error("飞书没有返回 tenant_access_token");

  tokenCache = {
    token: data.tenant_access_token,
    expiresAt: Date.now() + Number(data.expire || 7200) * 1000,
  };
  return tokenCache.token;
}

async function listTables(appToken, tenantAccessToken) {
  const data = await feishuFetch(`/bitable/v1/apps/${appToken}/tables?page_size=100`, {
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
    },
  });
  return data.items || [];
}

async function createMonthlyTable(appToken, tableName, tenantAccessToken) {
  const data = await feishuFetch(`/bitable/v1/apps/${appToken}/tables`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
    },
    body: JSON.stringify({
      table: {
        name: tableName,
        default_view_name: "默认表格",
        fields: MONTHLY_FIELDS.map((fieldName) => ({
          field_name: fieldName,
          type: FIELD_TYPE_TEXT,
        })),
      },
    }),
  });
  return data.table_id || data.table?.table_id;
}

async function ensureMonthlyTable(target, tenantAccessToken) {
  const tableName = getMonthTableName();
  const tables = await listTables(target.appToken, tenantAccessToken);
  const existing = tables.find((table) => table.name === tableName);
  if (existing) return { tableId: existing.table_id, tableName, created: false };

  const tableId = await createMonthlyTable(target.appToken, tableName, tenantAccessToken);
  if (!tableId) throw new Error(`飞书创建月度表失败：${tableName}`);
  return { tableId, tableName, created: true };
}

function stringifyForFeishu(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function buildRecordFields(payload) {
  return {
    标题: payload.title || "",
    摘要: payload.summary || "",
    分析类型: payload.analysis_type || "",
    输入类型: payload.input_type || "",
    Skill: payload.skill_name || "",
    原始文字: payload.text_input || "",
    OCR或转写文字: payload.ocr_text || "",
    输出JSON: stringifyForFeishu(payload.output_json),
    文件JSON: stringifyForFeishu(payload.files_json),
    本地记录ID: String(payload.local_id || ""),
    创建时间: new Date().toISOString(),
  };
}

async function createRecord(appToken, tableId, fields, tenantAccessToken) {
  const data = await feishuFetch(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tenantAccessToken}`,
    },
    body: JSON.stringify({
      fields,
    }),
  });
  return data.record;
}

async function writeAnalysisToFeishu(payload) {
  if (!isFeishuConfigured()) {
    throw new Error("未配置 FEISHU_APP_ID / FEISHU_APP_SECRET，无法写入飞书多维表格。");
  }

  const tenantAccessToken = await getTenantAccessToken();
  const target = getFeishuTarget(payload.analysis_type);
  const monthlyTable = await ensureMonthlyTable(target, tenantAccessToken);
  const record = await createRecord(
    target.appToken,
    monthlyTable.tableId,
    buildRecordFields(payload),
    tenantAccessToken,
  );

  return {
    appToken: target.appToken,
    tableId: monthlyTable.tableId,
    tableName: monthlyTable.tableName,
    createdTable: monthlyTable.created,
    recordId: record?.record_id || "",
  };
}

module.exports = {
  getMonthTableName,
  isFeishuConfigured,
  writeAnalysisToFeishu,
};
