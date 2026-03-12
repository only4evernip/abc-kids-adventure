import fs from "node:fs";
import path from "node:path";

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
  const { appToken, tableId, mode = "mock" } = config;

  function ensureBaseConfig() {
    if (mode === "mock") return;
    if (!appToken) throw new Error("缺少 FEISHU_APP_TOKEN / appToken");
    if (!tableId) throw new Error("缺少 FEISHU_TABLE_ID / tableId");
  }

  async function findRecordByCardId(cardId) {
    ensureBaseConfig();
    const filter = {
      conditions: [
        {
          field_name: "Card ID",
          operator: "is",
          value: [cardId],
        },
      ],
      conjunction: "and",
    };

    if (mode === "mock") {
      console.log("[mock] findRecordByCardId", JSON.stringify({ appToken, tableId, filter }, null, 2));
      return null;
    }

    throw new Error("真实 Feishu API 调用尚未接入；当前请使用 mode=mock");
  }

  async function createRecord(fields) {
    ensureBaseConfig();

    if (mode === "mock") {
      console.log("[mock] createRecord", JSON.stringify({ appToken, tableId, fields }, null, 2));
      return { recordId: "rec_mock_created_001", action: "create" };
    }

    throw new Error("真实 Feishu API 调用尚未接入；当前请使用 mode=mock");
  }

  async function updateRecord(recordId, fields) {
    ensureBaseConfig();

    if (mode === "mock") {
      console.log("[mock] updateRecord", JSON.stringify({ appToken, tableId, recordId, fields }, null, 2));
      return { recordId, action: "update" };
    }

    throw new Error("真实 Feishu API 调用尚未接入；当前请使用 mode=mock");
  }

  return {
    findRecordByCardId,
    createRecord,
    updateRecord,
  };
}
