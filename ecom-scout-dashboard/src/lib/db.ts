import Dexie, { type Table } from "dexie";
import type { ProductRecord } from "../types/product";

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
