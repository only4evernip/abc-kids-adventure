import { db } from "./db";
import type { ProductRecord } from "../types/product";
import type { FilterState } from "../store/useScoutStore";

function normalizeKeyword(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function buildKeywordHaystack(row: ProductRecord) {
  return `${row.keyword} ${row.productDirection} ${row.title || ""}`.toLowerCase();
}

function isInContinueQueue(row: ProductRecord) {
  const systemHighScore = row.workflowStatusSource === "system" && row.rps.score.finalScore >= 80;
  const freshScout = Boolean(row.scoutMeta) && row.workflowStatusSource !== "manual" && ["待评估", "观察池"].includes(row.workflowStatus);
  return systemHighScore || freshScout;
}

export async function queryProducts(filters: FilterState): Promise<ProductRecord[]> {
  const normalizedKeyword = normalizeKeyword(filters.keyword);
  const hasScoreFilter = filters.minScore != null || filters.maxScore != null;
  const hasWorkflowFlags = Boolean(filters.manualOnly || filters.changedOnly || filters.reviewPriorityOnly || filters.queueOnly);
  const hasResidualFilter = Boolean(filters.risk || normalizedKeyword || hasScoreFilter || hasWorkflowFlags);

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

  if (!hasResidualFilter) {
    return collection.toArray();
  }

  collection = collection.filter((row) => {
    if (filters.risk && row.overallRisk !== filters.risk) return false;
    if (filters.manualOnly && row.workflowStatusSource !== "manual") return false;
    if (filters.changedOnly && row.workflowStatus === row.rps.suggestedStatus) return false;
    if (filters.reviewPriorityOnly) {
      const isHighScore = row.rps.score.finalScore >= 80;
      const isNotAdvanced = ["待评估", "观察池", "待补证"].includes(row.workflowStatus);
      if (!isHighScore || !isNotAdvanced) return false;
    }
    if (filters.queueOnly && !isInContinueQueue(row)) return false;

    const score = row.rps.score.finalScore;
    if (filters.minScore != null && score < filters.minScore) return false;
    if (filters.maxScore != null && score > filters.maxScore) return false;

    if (normalizedKeyword) {
      if (!buildKeywordHaystack(row).includes(normalizedKeyword)) return false;
    }

    return true;
  });

  return collection.toArray();
}
