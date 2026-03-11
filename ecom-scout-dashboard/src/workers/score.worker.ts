import Papa from "papaparse";
import { calculateRps } from "../domain/rps";
import { db } from "../lib/db";
import { csvRowSchema, toProductRow } from "../lib/csvSchema";
import type { ProductRecord, ProductRow } from "../types/product";

export interface ScoreWorkerInput {
  batchId: string;
  file: File;
}

export type ScoreWorkerOutput =
  | {
      type: "progress";
      batchId: string;
      processed: number;
      total: number;
      saved: number;
      errors: number;
    }
  | {
      type: "done";
      batchId: string;
      count: number;
      errorCount: number;
    }
  | {
      type: "error";
      batchId: string;
      message: string;
    };

function hashString(input: string) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function stableProductId(row: ProductRow) {
  const base = [row.market, row.platformSite, row.asin || row.keyword, row.productDirection]
    .map((v) => (v || "").trim().toLowerCase())
    .join("|");
  return `prd_${hashString(base)}`;
}

function buildRecord(row: ProductRow, batchId: string): ProductRecord {
  const importedAt = new Date().toISOString();
  const rps = calculateRps(row);

  return {
    ...row,
    id: stableProductId(row),
    importBatchId: batchId,
    importedAt,
    workflowStatus: rps.suggestedStatus,
    notes: "",
    rps,
  };
}

async function bulkSave(records: ProductRecord[]) {
  if (records.length === 0) return;
  await db.products.bulkPut(records);
}

function parseCsvFile(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }
        resolve(results.data || []);
      },
      error: (error) => reject(error),
    });
  });
}

self.onmessage = async (event: MessageEvent<ScoreWorkerInput>) => {
  const { file, batchId } = event.data;

  try {
    const rows = await parseCsvFile(file);
    const total = rows.length;
    let errorCount = 0;
    let saved = 0;
    const buffer: ProductRecord[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const raw = rows[index];
      const result = csvRowSchema.safeParse(raw);

      if (!result.success) {
        errorCount += 1;
      } else {
        const normalized = toProductRow(result.data);
        buffer.push(buildRecord(normalized, batchId));
      }

      if (buffer.length >= 500) {
        await bulkSave(buffer.splice(0, buffer.length));
        saved = index + 1 - errorCount;
      }

      if ((index + 1) % 500 === 0 || index === rows.length - 1) {
        self.postMessage({
          type: "progress",
          batchId,
          processed: index + 1,
          total,
          saved,
          errors: errorCount,
        } satisfies ScoreWorkerOutput);
      }
    }

    if (buffer.length > 0) {
      await bulkSave(buffer.splice(0, buffer.length));
      saved = total - errorCount;
    }

    self.postMessage({
      type: "done",
      batchId,
      count: saved,
      errorCount,
    } satisfies ScoreWorkerOutput);
  } catch (error) {
    self.postMessage({
      type: "error",
      batchId,
      message: error instanceof Error ? error.message : "unknown worker error",
    } satisfies ScoreWorkerOutput);
  }
};
