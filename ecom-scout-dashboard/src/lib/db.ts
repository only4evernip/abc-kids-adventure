import Dexie, { type Table } from "dexie";
import type { ProductRecord } from "../types/product";

export class ScoutDatabase extends Dexie {
  products!: Table<ProductRecord, string>;

  constructor() {
    super("ecom-scout-dashboard");
    this.version(1).stores({
      products: "id, importBatchId, workflowStatus, market, keyword, productDirection, rps.score.finalScore, importedAt",
    });
  }
}

export const db = new ScoutDatabase();
