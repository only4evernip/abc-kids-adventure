import fs from "node:fs";
import path from "node:path";
import { loadEnvFile, createFeishuClient } from "./feishuClient.mjs";
import { parseScoutCard, scoutCardToFeishuRecord } from "./scoutCardRuntime.mjs";

function parseArgs(argv) {
  const args = { file: "./scout-card.example.json", mode: process.env.FEISHU_SYNC_MODE || "mock" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.file = argv[i + 1];
    if (arg === "--mode") args.mode = argv[i + 1];
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
  const card = parseScoutCard(raw);
  const record = scoutCardToFeishuRecord(card);

  const appToken = process.env.FEISHU_APP_TOKEN || process.env.FEISHU_APP_TOKEN_MOCK || "";
  const tableId = process.env.FEISHU_TABLE_ID || process.env.FEISHU_TABLE_ID_MOCK || "";

  const client = createFeishuClient({
    appToken,
    tableId,
    mode: args.mode,
  });

  console.log("[sync] loaded scout card:", card.cardId);
  console.log("[sync] mapped Feishu payload preview:");
  console.log(JSON.stringify(record, null, 2));

  const existing = await client.findRecordByCardId(record.cardId);
  const result = existing?.recordId
    ? await client.updateRecord(existing.recordId, record)
    : await client.createRecord(record);

  console.log("[sync] done:", JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("[sync] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
