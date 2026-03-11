import { calculateRps } from "../domain/rps";
import { db } from "../lib/db";
import type { ProductRecord, ProductRow } from "../types/product";

export interface ScoreWorkerInput {
  batchId: string;
  rows: ProductRow[];
}

export interface ScoreWorkerOutput {
  status: "done" | "error";
  batchId: string;
  count: number;
  errorCount: number;
  message?: string;
}

function buildRecord(row: ProductRow, batchId: string): ProductRecord {
  const importedAt = new Date().toISOString();
  const rps = calculateRps(row);
  const id = `${batchId}:${row.asin || row.keyword}:${row.productDirection}`;

  return {
    ...row,
    id,
    importBatchId: batchId,
    importedAt,
    workflowStatus: rps.suggestedStatus,
    notes: "",
    rps,
  };
}

self.onmessage = async (event: MessageEvent<ScoreWorkerInput>) => {
  const { rows = [], batchId } = event.data;

  try {
    const records = rows.map((row) => buildRecord(row, batchId));
    await db.products.bulkPut(records);

    const payload: ScoreWorkerOutput = {
      status: "done",
      batchId,
      count: records.length,
      errorCount: 0,
    };

    self.postMessage(payload);
  } catch (error) {
    const payload: ScoreWorkerOutput = {
      status: "error",
      batchId,
      count: 0,
      errorCount: rows.length,
      message: error instanceof Error ? error.message : "unknown worker error",
    };
    self.postMessage(payload);
  }
};
