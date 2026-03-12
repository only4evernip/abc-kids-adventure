import fs from "node:fs";
import path from "node:path";
import { loadEnvFile, createFeishuClient } from "./feishuClient.mjs";
import { parseScoutCard, scoutCardToFeishuRecord } from "./scoutCardRuntime.mjs";

function isScoutCardLike(input) {
  return Boolean(input && typeof input === "object" && input.schemaVersion === "scout-card.v1" && input.cardId);
}

function isFeishuPayloadLike(input) {
  return Boolean(input && typeof input === "object" && input["Card ID"]);
}

function normalizeSyncItem(input, index) {
  if (isScoutCardLike(input)) {
    const card = parseScoutCard(input);
    return { index, cardId: card.cardId, record: scoutCardToFeishuRecord(card) };
  }

  if (isFeishuPayloadLike(input)) {
    return { index, cardId: input["Card ID"], record: input };
  }

  throw new Error(`第 ${index + 1} 项不是有效的 Scout Card 或 Feishu 同步 payload`);
}

function parseArgs(argv) {
  const args = { file: "./scout-card.example.json", mode: process.env.FEISHU_SYNC_MODE || "mock", fieldsOnly: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.file = argv[i + 1];
    if (arg === "--mode") args.mode = argv[i + 1];
    if (arg === "--fields-only") args.fieldsOnly = true;
  }
  return args;
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(process.cwd(), args.file);

  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到输入文件：${filePath}`);
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const isBatch = Array.isArray(raw);
  const batchItems = (isBatch ? raw : [raw]).map((item, index) => normalizeSyncItem(item, index));

  const appId = process.env.FEISHU_APP_ID || "";
  const appSecret = process.env.FEISHU_APP_SECRET || "";
  const appToken = process.env.FEISHU_APP_TOKEN || process.env.FEISHU_APP_TOKEN_MOCK || "";
  const tableId = process.env.FEISHU_TABLE_ID || process.env.FEISHU_TABLE_ID_MOCK || "";

  const client = createFeishuClient({
    appId,
    appSecret,
    appToken,
    tableId,
    mode: args.mode,
  });

  console.log("[sync] loaded items:", batchItems.length);
  console.log("[sync] first payload preview:");
  console.log(JSON.stringify(batchItems[0]?.record, null, 2));

  const fields = await client.listFields();

  if (args.fieldsOnly) {
    console.log("[sync] bitable fields:");
    console.log(JSON.stringify(fields, null, 2));
    return;
  }

  const fieldNames = new Set(fields.map((field) => field.field_name));

  if (args.mode === "mock") {
    console.log("[sync] mock 模式：跳过字段缺失预检");
  } else {
    for (const { cardId, record } of batchItems) {
      const missingFields = Object.keys(record).filter((key) => !fieldNames.has(key));
      if (missingFields.length > 0) {
        console.error(`[sync] missing bitable fields for ${cardId}:`, JSON.stringify(missingFields, null, 2));
        process.exitCode = 1;
        return;
      }
    }
  }

  const results = [];
  for (const { cardId, record } of batchItems) {
    const existing = await client.findRecordByCardId(cardId);
    const result = existing?.recordId
      ? await client.updateRecord(existing.recordId, record)
      : await client.createRecord(record);
    results.push({ cardId, ...result });
  }

  console.log("[sync] done:", JSON.stringify(isBatch ? results : results[0], null, 2));
}

main().catch((error) => {
  console.error("[sync] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
