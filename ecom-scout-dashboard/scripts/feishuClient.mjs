import fs from "node:fs";
import path from "node:path";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

export function loadEnvFile(envPath = path.resolve(process.cwd(), ".env.local")) {
  if (!fs.existsSync(envPath)) return {};

  const raw = fs.readFileSync(envPath, "utf8");
  const entries = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    entries[key] = value;
    if (!(key in process.env)) process.env[key] = value;
  }
  return entries;
}

export function createFeishuClient(config) {
  const { appId, appSecret, appToken, tableId, mode = "mock" } = config;

  function ensureBaseConfig() {
    if (mode === "mock") return;
    if (!appId) throw new Error("缺少 FEISHU_APP_ID / appId");
    if (!appSecret) throw new Error("缺少 FEISHU_APP_SECRET / appSecret");
    if (!appToken) throw new Error("缺少 FEISHU_APP_TOKEN / appToken");
    if (!tableId) throw new Error("缺少 FEISHU_TABLE_ID / tableId");
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
    }

    if (data?.code && data.code !== 0) {
      throw new Error(`Feishu API error ${data.code}: ${data.msg || JSON.stringify(data)}`);
    }

    return data;
  }

  async function getTenantAccessToken() {
    ensureBaseConfig();

    if (mode === "mock") {
      console.log("[mock] getTenantAccessToken", JSON.stringify({ appId }, null, 2));
      return "t_mock_token";
    }

    const data = await requestJson(`${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      }),
    });

    return data.tenant_access_token;
  }

  async function listFields() {
    ensureBaseConfig();

    if (mode === "mock") {
      console.log("[mock] listFields", JSON.stringify({ appToken, tableId }, null, 2));
      return [];
    }

    const token = await getTenantAccessToken();
    const data = await requestJson(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=200`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return data?.data?.items || [];
  }

  async function listRecords(pageSize = 500) {
    ensureBaseConfig();

    if (mode === "mock") {
      console.log("[mock] listRecords", JSON.stringify({ appToken, tableId, pageSize }, null, 2));
      return [];
    }

    const token = await getTenantAccessToken();
    const items = [];
    let pageToken = "";
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({ page_size: String(pageSize) });
      if (pageToken) params.set("page_token", pageToken);

      const data = await requestJson(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      items.push(...(data?.data?.items || []));
      hasMore = Boolean(data?.data?.has_more);
      pageToken = data?.data?.page_token || "";
    }

    return items;
  }

  async function findRecordByCardId(cardId) {
    ensureBaseConfig();

    if (mode === "mock") {
      console.log("[mock] findRecordByCardId", JSON.stringify({ appToken, tableId, cardId }, null, 2));
      return null;
    }

    const items = await listRecords(500);
    const matches = items.filter((record) => record?.fields?.["Card ID"] === cardId);

    if (matches.length > 1) {
      throw new Error(`发现重复 Card ID：${cardId}，匹配记录 ${matches.map((item) => item.record_id).join(", ")}`);
    }

    const item = matches[0];
    return item ? { recordId: item.record_id, fields: item.fields } : null;
  }

  async function createRecord(fields) {
    ensureBaseConfig();

    if (mode === "mock") {
      console.log("[mock] createRecord", JSON.stringify({ appToken, tableId, fields }, null, 2));
      return { recordId: "rec_mock_created_001", action: "create" };
    }

    const token = await getTenantAccessToken();
    const data = await requestJson(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields }),
    });

    return { recordId: data?.data?.record?.record_id, action: "create" };
  }

  async function updateRecord(recordId, fields) {
    ensureBaseConfig();

    if (mode === "mock") {
      console.log("[mock] updateRecord", JSON.stringify({ appToken, tableId, recordId, fields }, null, 2));
      return { recordId, action: "update" };
    }

    const token = await getTenantAccessToken();
    const data = await requestJson(`${FEISHU_API_BASE}/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fields }),
    });

    return { recordId: data?.data?.record?.record_id || recordId, action: "update" };
  }

  return {
    getTenantAccessToken,
    listFields,
    listRecords,
    findRecordByCardId,
    createRecord,
    updateRecord,
  };
}
