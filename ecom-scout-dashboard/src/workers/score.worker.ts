import Papa from "papaparse";
import { calculateRps } from "../domain/rps";
import { db } from "../lib/db";
import { csvRowSchema, toProductRow } from "../lib/csvSchema";
import type { ProductRecord, ProductRow, WorkflowStatus } from "../types/product";

export interface ScoreWorkerInput {
  batchId: string;
  file: File;
}

export interface ImportErrorItem {
  rowNumber: number;
  reason: string;
  field?: string;
  valuePreview?: string;
}

export interface ImportStats {
  insertedCount: number;
  updatedCount: number;
  preservedManualStatusCount: number;
  preservedNotesCount: number;
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
      errorItems: ImportErrorItem[];
      stats: ImportStats;
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

function normalizeText(value?: string) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeUrlPath(value?: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.replace(/\/+$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase().split(/[?#]/)[0] || "";
  }
}

function stableProductId(row: ProductRow) {
  const asin = normalizeText(row.asin);
  const urlPath = normalizeUrlPath(row.productUrl);
  const title = normalizeText(row.title).slice(0, 120);
  const fallbackKeyword = normalizeText(row.keyword);
  const fallbackDirection = normalizeText(row.productDirection);

  const base = [normalizeText(row.market), normalizeText(row.platformSite), asin, urlPath, title, fallbackKeyword, fallbackDirection].join("|");
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
    workflowStatusSource: "system",
    workflowStatusUpdatedAt: importedAt,
    notes: "",
    rps,
  };
}

function mergeImportedRecord(existing: ProductRecord | undefined, incoming: ProductRecord): { record: ProductRecord; stats: ImportStats } {
  if (!existing) {
    return {
      record: incoming,
      stats: {
        insertedCount: 1,
        updatedCount: 0,
        preservedManualStatusCount: 0,
        preservedNotesCount: 0,
      },
    };
  }

  const manualStatusLocked = existing.workflowStatusSource === "manual";
  const preservedNotes = Boolean(existing.notes?.trim());
  const workflowStatus: WorkflowStatus = manualStatusLocked ? existing.workflowStatus : incoming.rps.suggestedStatus;

  return {
    record: {
      ...existing,
      ...incoming,
      notes: existing.notes ?? "",
      workflowStatus,
      workflowStatusSource: manualStatusLocked ? "manual" : "system",
      workflowStatusUpdatedAt: manualStatusLocked
        ? existing.workflowStatusUpdatedAt ?? existing.importedAt
        : incoming.importedAt,
    },
    stats: {
      insertedCount: 0,
      updatedCount: 1,
      preservedManualStatusCount: manualStatusLocked ? 1 : 0,
      preservedNotesCount: preservedNotes ? 1 : 0,
    },
  };
}

function emptyImportStats(): ImportStats {
  return {
    insertedCount: 0,
    updatedCount: 0,
    preservedManualStatusCount: 0,
    preservedNotesCount: 0,
  };
}

function mergeStats(base: ImportStats, next: ImportStats): ImportStats {
  return {
    insertedCount: base.insertedCount + next.insertedCount,
    updatedCount: base.updatedCount + next.updatedCount,
    preservedManualStatusCount: base.preservedManualStatusCount + next.preservedManualStatusCount,
    preservedNotesCount: base.preservedNotesCount + next.preservedNotesCount,
  };
}

async function bulkSave(records: ProductRecord[]) {
  if (records.length === 0) return emptyImportStats();

  const existingRecords = await db.products.bulkGet(records.map((record) => record.id));
  const mergeResults = records.map((record, index) => mergeImportedRecord(existingRecords[index] ?? undefined, record));
  const mergedRecords = mergeResults.map((item) => item.record);
  const stats = mergeResults.reduce((acc, item) => mergeStats(acc, item.stats), emptyImportStats());

  await db.products.bulkPut(mergedRecords);
  return stats;
}

function summarizeParseError(rowNumber: number, raw: Record<string, unknown>, issues: { path: (string | number)[]; message: string }[]): ImportErrorItem {
  const firstIssue = issues[0];
  const field = firstIssue?.path?.[0] != null ? String(firstIssue.path[0]) : undefined;
  const valuePreview = field ? String(raw[field] ?? "").slice(0, 80) : undefined;

  return {
    rowNumber,
    field,
    valuePreview,
    reason: issues.map((issue) => issue.message).join("；"),
  };
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
    let stats = emptyImportStats();
    const buffer: ProductRecord[] = [];
    const errorItems: ImportErrorItem[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const raw = rows[index];
      const result = csvRowSchema.safeParse(raw);

      if (!result.success) {
        errorCount += 1;
        if (errorItems.length < 20) {
          errorItems.push(summarizeParseError(index + 2, raw, result.error.issues));
        }
      } else {
        const normalized = toProductRow(result.data);
        buffer.push(buildRecord(normalized, batchId));
      }

      if (buffer.length >= 500) {
        stats = mergeStats(stats, await bulkSave(buffer.splice(0, buffer.length)));
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
      stats = mergeStats(stats, await bulkSave(buffer.splice(0, buffer.length)));
      saved = total - errorCount;
    }

    self.postMessage({
      type: "done",
      batchId,
      count: saved,
      errorCount,
      errorItems,
      stats,
    } satisfies ScoreWorkerOutput);
  } catch (error) {
    self.postMessage({
      type: "error",
      batchId,
      message: error instanceof Error ? error.message : "unknown worker error",
    } satisfies ScoreWorkerOutput);
  }
};
