import Dexie, { type Table } from "dexie";
import type { ProductRecord, WorkflowStatus } from "../types/product";

export interface SessionPayload {
  version: 2;
  exportedAt: string;
  products: ProductRecord[];
}

export class ScoutDatabase extends Dexie {
  products!: Table<ProductRecord, string>;

  constructor() {
    super("ecom-scout-dashboard");
    this.version(3).stores({
      products:
        "id, importBatchId, workflowStatus, market, overallRisk, keyword, productDirection, importedAt, rps.score.finalScore, [workflowStatus+rps.score.finalScore], [market+workflowStatus]",
    });
    this.version(4)
      .stores({
        products:
          "id, importBatchId, workflowStatus, workflowStatusSource, market, overallRisk, keyword, productDirection, importedAt, rps.score.finalScore, [workflowStatus+rps.score.finalScore], [market+workflowStatus]",
      })
      .upgrade(async (tx) => {
        await tx.table("products").toCollection().modify((record: ProductRecord) => {
          record.workflowStatusSource = record.workflowStatusSource ?? "system";
          record.workflowStatusUpdatedAt = record.workflowStatusUpdatedAt ?? record.importedAt;
          record.notes = record.notes ?? "";
        });
      });
  }
}

export const db = new ScoutDatabase();

export async function updateProductRecord(id: string, patch: Partial<Pick<ProductRecord, "workflowStatus" | "notes">>) {
  return db.products.update(id, {
    ...patch,
    workflowStatusSource: patch.workflowStatus ? "manual" : undefined,
    workflowStatusUpdatedAt: patch.workflowStatus ? new Date().toISOString() : undefined,
  });
}

export async function exportSessionPayload(): Promise<SessionPayload> {
  const products = await db.products.toArray();
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    products,
  };
}

export async function importSessionPayload(payload: SessionPayload | { version: 1; exportedAt: string; products: ProductRecord[] }) {
  if (!payload || ![1, 2].includes(payload.version) || !Array.isArray(payload.products)) {
    throw new Error("无效的 session 文件");
  }

  const normalizedProducts = payload.products.map((product) => ({
    ...product,
    workflowStatusSource: product.workflowStatusSource ?? "system",
    workflowStatusUpdatedAt: product.workflowStatusUpdatedAt ?? product.importedAt,
    notes: product.notes ?? "",
  }));

  await db.products.bulkPut(normalizedProducts);
  return normalizedProducts.length;
}

export const WORKFLOW_STATUS_OPTIONS: WorkflowStatus[] = ["待评估", "观察池", "待补证", "供应链核价", "淘汰库"];
