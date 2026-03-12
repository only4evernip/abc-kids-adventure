import type { ScoutEvidenceItem, ScoutSignalLevel } from "./scoutCard";

export interface ScoutResearchDraftEvidence {
  sourceName: string;
  sourceUrl: string;
  title: string;
  summary: string;
}

export interface ScoutResearchDraft {
  keyword: string;
  market: "US" | "CA";
  productDirection: string;
  demandSignal: ScoutSignalLevel;
  competitionSignal: ScoutSignalLevel;
  demandEvidence: ScoutResearchDraftEvidence[];
  painPoints: string[];
  painPointEvidence: ScoutResearchDraftEvidence[];
  risks: string[];
  riskEvidence: ScoutResearchDraftEvidence[];
  opportunities?: string[];
  preliminaryDecision: "go-deeper" | "watch" | "drop";
  reasonSummary: string;
  nextStep: string;
  notes?: string;
  tags?: string[];
}

export interface NormalizedResearchSummary {
  keyword: string;
  market: "US" | "CA";
  productDirection: string;
  demandSignal: ScoutSignalLevel;
  competitionSignal: ScoutSignalLevel;
  demandEvidence: ScoutEvidenceItem[];
  painPoints: string[];
  painPointEvidence: ScoutEvidenceItem[];
  risks: string[];
  riskEvidence: ScoutEvidenceItem[];
  warnings: string[];
}

const SOURCE_RULES = [
  { match: /reddit\.com/i, type: "reddit" as const, allowed: true },
  { match: /amazon\./i, type: "review" as const, allowed: true },
  { match: /google\./i, type: "article" as const, allowed: true },
  { match: /forum/i, type: "forum" as const, allowed: true },
  { match: /blog|wirecutter|medium|substack/i, type: "article" as const, allowed: true },
  { match: /tiktok\.com/i, type: "other" as const, allowed: false },
  { match: /xiaohongshu\.com/i, type: "other" as const, allowed: false },
] as const;

function toEvidenceItem(item: ScoutResearchDraftEvidence, fallbackType: ScoutEvidenceItem["type"]): ScoutEvidenceItem | { dropped: string } {
  if (!item.sourceName?.trim() || !item.sourceUrl?.trim()) {
    throw new Error("无效的 research evidence：缺少 sourceName 或 sourceUrl");
  }

  const rule = SOURCE_RULES.find((entry) => entry.match.test(item.sourceUrl));
  if (rule && !rule.allowed) {
    return { dropped: `已过滤非白名单来源：${item.sourceName}` };
  }

  return {
    type: rule?.type || fallbackType,
    source: item.sourceName.trim(),
    title: item.title.trim(),
    url: item.sourceUrl.trim(),
    summary: item.summary.trim(),
  };
}

function normalizeEvidenceList(
  items: ScoutResearchDraftEvidence[],
  fallbackType: ScoutEvidenceItem["type"]
): { kept: ScoutEvidenceItem[]; warnings: string[] } {
  const kept: ScoutEvidenceItem[] = [];
  const warnings: string[] = [];

  for (const item of items) {
    const normalized = toEvidenceItem(item, fallbackType);
    if ("dropped" in normalized) {
      warnings.push(normalized.dropped);
      continue;
    }
    kept.push(normalized);
  }

  return { kept, warnings };
}

export function normalizeResearchSummary(draft: ScoutResearchDraft): NormalizedResearchSummary {
  const demand = normalizeEvidenceList(draft.demandEvidence, "article");
  const pain = normalizeEvidenceList(draft.painPointEvidence, "review");
  const risk = normalizeEvidenceList(draft.riskEvidence, "article");

  return {
    keyword: draft.keyword,
    market: draft.market,
    productDirection: draft.productDirection,
    demandSignal: draft.demandSignal,
    competitionSignal: draft.competitionSignal,
    demandEvidence: demand.kept,
    painPoints: draft.painPoints,
    painPointEvidence: pain.kept,
    risks: draft.risks,
    riskEvidence: risk.kept,
    warnings: [...demand.warnings, ...pain.warnings, ...risk.warnings],
  };
}
