import { calculateRps } from "../domain/rps";
import type { Level4, ProductRecord, ProductRow, WorkflowStatus } from "../types/product";

export type ScoutSignalLevel = "high" | "medium-high" | "medium" | "low";
export type ScoutConfidenceLevel = "high" | "medium" | "low";
export type ScoutDecision = "go-deeper" | "watch" | "drop";

export interface ScoutEvidenceItem {
  type: "reddit" | "article" | "forum" | "review" | "marketplace" | "video" | "other";
  source: string;
  title: string;
  url: string;
  summary: string;
}

export interface ScoutResearchSummary {
  keyword: string;
  market: "US" | "CA";
  productDirection: string;
  platformFocus?: string[];
  language?: string;
  demandSignal: ScoutSignalLevel;
  competitionSignal: ScoutSignalLevel;
  demandEvidence: ScoutEvidenceItem[];
  painPoints: string[];
  painPointEvidence: ScoutEvidenceItem[];
  risks: string[];
  riskEvidence: ScoutEvidenceItem[];
  opportunities?: string[];
  preliminaryDecision: ScoutDecision;
  reasonSummary: string;
  nextStep: string;
  notes?: string;
  tags?: string[];
}

export interface ScoutCard {
  schemaVersion: "scout-card.v1";
  cardId: string;
  createdAt: string;
  updatedAt: string;
  topic: {
    keyword: string;
    productDirection: string;
    market: string;
    platformFocus?: string[];
    language?: string;
  };
  signals: {
    demandSignal: ScoutSignalLevel;
    competitionSignal: ScoutSignalLevel;
    confidence: ScoutConfidenceLevel;
  };
  insights: {
    painPoints: string[];
    risks: string[];
    opportunities?: string[];
  };
  decision: {
    preliminaryDecision: ScoutDecision;
    nextStep: string;
    reasonSummary: string;
  };
  evidence: ScoutEvidenceItem[];
  workbench: {
    workflowStatus?: WorkflowStatus;
    notes?: string;
    tags?: string[];
  };
}

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

function stableScoutCardId(card: ScoutCard) {
  const base = [
    normalizeText(card.topic.market),
    normalizeText(card.topic.keyword),
    normalizeText(card.topic.productDirection),
  ].join("|");
  return `scout_${hashString(base)}`;
}

function signalToLevel4(signal: ScoutSignalLevel): Level4 {
  switch (signal) {
    case "high":
      return "高";
    case "medium-high":
      return "中";
    case "medium":
      return "中";
    default:
      return "低";
  }
}

function decisionToWorkflowStatus(decision: ScoutDecision): WorkflowStatus {
  switch (decision) {
    case "go-deeper":
      return "观察池";
    case "drop":
      return "淘汰库";
    default:
      return "待评估";
  }
}

export function buildScoutCardFromResearch(summary: ScoutResearchSummary): ScoutCard {
  const hasDemandEvidence = summary.demandEvidence.length > 0;
  const hasPainEvidence = summary.painPoints.length > 0 && summary.painPointEvidence.length > 0;
  const hasRiskEvidence = summary.risks.length > 0 && summary.riskEvidence.length > 0;
  const evidenceComplete = hasDemandEvidence && hasPainEvidence && hasRiskEvidence;

  const confidence: ScoutConfidenceLevel = evidenceComplete ? "high" : "low";
  const preliminaryDecision: ScoutDecision = evidenceComplete ? summary.preliminaryDecision : "watch";
  const now = new Date().toISOString();

  const card: ScoutCard = {
    schemaVersion: "scout-card.v1",
    cardId: "pending",
    createdAt: now,
    updatedAt: now,
    topic: {
      keyword: summary.keyword,
      productDirection: summary.productDirection,
      market: summary.market,
      platformFocus: summary.platformFocus || [],
      language: summary.language || "en",
    },
    signals: {
      demandSignal: summary.demandSignal,
      competitionSignal: summary.competitionSignal,
      confidence,
    },
    insights: {
      painPoints: summary.painPoints,
      risks: summary.risks,
      opportunities: summary.opportunities || [],
    },
    decision: {
      preliminaryDecision,
      nextStep: summary.nextStep,
      reasonSummary: evidenceComplete ? summary.reasonSummary : `${summary.reasonSummary}（证据不足，先进入 watch）`,
    },
    evidence: [...summary.demandEvidence, ...summary.painPointEvidence, ...summary.riskEvidence],
    workbench: {
      workflowStatus: decisionToWorkflowStatus(preliminaryDecision),
      notes: summary.notes || "",
      tags: summary.tags || [],
    },
  };

  return {
    ...card,
    cardId: stableScoutCardId(card),
  };
}

export function scoutCardToProductRow(card: ScoutCard): ProductRow {
  const evidenceLinks = card.evidence.map((item) => `${item.source}: ${item.url}`).join("\n");
  const topComplaintPoints = card.insights.painPoints.join("；");
  const desiredPoints = (card.insights.opportunities || []).join("；");
  const riskText = card.insights.risks.join("；");
  const platformSite = card.topic.platformFocus?.join(" / ") || "Scout Research";

  return {
    researchDate: card.createdAt.slice(0, 10),
    market: card.topic.market,
    platformSite,
    keyword: card.topic.keyword,
    nicheDirection: "侦察虾机会卡",
    productDirection: card.topic.productDirection,
    bigCategory: "Scout Card",
    asin: undefined,
    title: `${card.topic.productDirection} · ${card.topic.keyword}`,
    brand: undefined,
    productUrl: card.evidence[0]?.url,
    currentPrice: null,
    currentBsr: null,
    currentRating: null,
    reviewCount: null,
    reviewGrowth30d: null,
    coreSellingPoints: card.decision.reasonSummary,
    topComplaintPoints,
    desiredPoints,
    headMonopoly: signalToLevel4(card.signals.competitionSignal),
    competitionLevel: signalToLevel4(card.signals.competitionSignal),
    overallRisk: card.insights.risks.some((item) => /合规|高敏感|红海|高预期/.test(item)) ? "高" : "中",
    initialConclusion: card.decision.preliminaryDecision,
    nextAction: card.decision.nextStep,
    conclusionSummary: `${card.decision.reasonSummary}\n\n风险：${riskText}\n\n证据：\n${evidenceLinks}`,
  };
}

export function scoutCardToProductRecord(card: ScoutCard, batchId = "scout-card-import"): ProductRecord {
  const row = scoutCardToProductRow(card);
  const importedAt = new Date().toISOString();
  const rps = calculateRps(row);
  const workflowStatus = card.workbench.workflowStatus || decisionToWorkflowStatus(card.decision.preliminaryDecision);
  return {
    ...row,
    id: stableScoutCardId(card),
    importBatchId: batchId,
    importedAt,
    workflowStatus,
    workflowStatusSource: "manual",
    workflowStatusUpdatedAt: importedAt,
    notes: card.workbench.notes || "",
    scoutMeta: {
      cardId: card.cardId,
      demandSignal: card.signals.demandSignal,
      competitionSignal: card.signals.competitionSignal,
      confidence: card.signals.confidence,
      painPoints: card.insights.painPoints,
      opportunities: card.insights.opportunities || [],
      risks: card.insights.risks,
      preliminaryDecision: card.decision.preliminaryDecision,
      reasonSummary: card.decision.reasonSummary,
      evidence: card.evidence,
      tags: card.workbench.tags || [],
    },
    rps: {
      ...rps,
      suggestedStatus: workflowStatus,
      falsePositiveTags: [...new Set([...(rps.falsePositiveTags || []), ...(card.workbench.tags || [])])],
    },
  };
}

export function parseScoutCard(input: unknown): ScoutCard {
  const card = input as ScoutCard;

  if (!card || card.schemaVersion !== "scout-card.v1") {
    throw new Error("无效的侦察卡：schemaVersion 不正确");
  }
  if (!card.cardId || !card.topic?.keyword || !card.topic?.productDirection || !card.topic?.market) {
    throw new Error("无效的侦察卡：缺少核心 topic 字段");
  }
  if (!Array.isArray(card.insights?.painPoints) || !Array.isArray(card.insights?.risks) || !Array.isArray(card.evidence)) {
    throw new Error("无效的侦察卡：insights/evidence 结构错误");
  }

  return card;
}
