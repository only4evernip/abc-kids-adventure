import Dexie, { type Table } from "dexie";
import type { ProductRecord, WorkflowStatus } from "../types/product";

export interface SessionPayload {
  version: 1;
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
  }
}

export const db = new ScoutDatabase();

export async function updateProductRecord(id: string, patch: Partial<Pick<ProductRecord, "workflowStatus" | "notes">>) {
  return db.products.update(id, patch);
}

export async function exportSessionPayload(): Promise<SessionPayload> {
  const products = await db.products.toArray();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    products,
  };
}

export async function importSessionPayload(payload: SessionPayload) {
  if (!payload || payload.version !== 1 || !Array.isArray(payload.products)) {
    throw new Error("无效的 session 文件");
  }
  await db.products.bulkPut(payload.products);
  return payload.products.length;
}

export const WORKFLOW_STATUS_OPTIONS: WorkflowStatus[] = ["待评估", "观察池", "待补证", "供应链核价", "淘汰库"];
