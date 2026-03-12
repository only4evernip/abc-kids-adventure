import type { ScoutCard } from "./scoutCard";

export interface FeishuScoutCardRecord {
  cardId: string;
  keyword: string;
  productDirection: string;
  market: string;
  platformFocus: string;
  language: string;
  demandSignal: string;
  competitionSignal: string;
  confidence: string;
  painPoints: string;
  risks: string;
  opportunities: string;
  preliminaryDecision: string;
  nextStep: string;
  reasonSummary: string;
  workflowStatus: string;
  notes: string;
  tags: string;
  evidenceLinks: string;
  evidenceSummary: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: string;
}

function multiline(items?: string[]) {
  return (items || []).map((item) => `- ${item}`).join("\n");
}

export function scoutCardToFeishuRecord(card: ScoutCard): FeishuScoutCardRecord {
  return {
    cardId: card.cardId,
    keyword: card.topic.keyword,
    productDirection: card.topic.productDirection,
    market: card.topic.market,
    platformFocus: (card.topic.platformFocus || []).join(" / "),
    language: card.topic.language || "en",
    demandSignal: card.signals.demandSignal,
    competitionSignal: card.signals.competitionSignal,
    confidence: card.signals.confidence,
    painPoints: multiline(card.insights.painPoints),
    risks: multiline(card.insights.risks),
    opportunities: multiline(card.insights.opportunities || []),
    preliminaryDecision: card.decision.preliminaryDecision,
    nextStep: card.decision.nextStep,
    reasonSummary: card.decision.reasonSummary,
    workflowStatus: card.workbench.workflowStatus || "待评估",
    notes: card.workbench.notes || "",
    tags: (card.workbench.tags || []).join(" / "),
    evidenceLinks: card.evidence.map((item) => `${item.source} | ${item.title} | ${item.url}`).join("\n"),
    evidenceSummary: card.evidence.map((item) => `${item.source}: ${item.summary}`).join("\n"),
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    schemaVersion: card.schemaVersion,
  };
}
