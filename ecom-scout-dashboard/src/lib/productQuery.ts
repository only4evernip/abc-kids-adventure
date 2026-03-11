import { db } from "./db";
import type { ProductRecord } from "../types/product";
import type { FilterState } from "../store/useScoutStore";

export async function queryProducts(filters: FilterState): Promise<ProductRecord[]> {
  let collection:
    | ReturnType<typeof db.products.toCollection>
    | ReturnType<typeof db.products.where>;

  if (filters.market && filters.workflowStatus) {
    collection = db.products.where("[market+workflowStatus]").equals([filters.market, filters.workflowStatus]);
  } else if (filters.workflowStatus) {
    collection = db.products.where("workflowStatus").equals(filters.workflowStatus);
  } else if (filters.market) {
    collection = db.products.where("market").equals(filters.market);
  } else {
    collection = db.products.toCollection();
  }

  if (filters.risk || filters.keyword || filters.minScore != null || filters.maxScore != null) {
    collection = collection.filter((row) => {
      if (filters.risk && row.overallRisk !== filters.risk) return false;
      if (filters.keyword) {
        const q = filters.keyword.trim().toLowerCase();
        const haystack = `${row.keyword} ${row.productDirection} ${row.title || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.minScore != null && row.rps.score.finalScore < filters.minScore) return false;
      if (filters.maxScore != null && row.rps.score.finalScore > filters.maxScore) return false;
      return true;
    });
  }

  return collection.toArray();
}
