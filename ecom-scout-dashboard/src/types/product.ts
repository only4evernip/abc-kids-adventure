export type Level4 = "低" | "中" | "高" | "极高";

export type RpsLevel = "strong" | "watch" | "hold" | "reject";

export type WorkflowStatus =
  | "待评估"
  | "观察池"
  | "待补证"
  | "供应链核价"
  | "淘汰库";

export interface RawCsvRow {
  [key: string]: unknown;
}

export interface ProductRow {
  researchDate: string;
  market: string;
  platformSite: string;
  keyword: string;
  nicheDirection: string;
  productDirection: string;
  bigCategory?: string;
  asin?: string;
  title?: string;
  brand?: string;
  productUrl?: string;
  currentPrice: number | null;
  currentBsr: number | null;
  currentRating: number | null;
  reviewCount: number | null;
  reviewGrowth30d: number | null;
  coreSellingPoints: string;
  topComplaintPoints: string;
  desiredPoints: string;
  headMonopoly: Level4 | null;
  competitionLevel: Level4 | null;
  overallRisk: Level4 | null;
  initialConclusion: string;
  nextAction: string;
  conclusionSummary: string;
}

export interface EligibilityResult {
  eligible: boolean;
  status: "pass" | "review" | "reject";
  reasons: string[];
}

export interface ScoreBreakdown {
  reviewGrowthScore: number;
  bsrScore: number;
  antiMonopolyScore: number;
  competitionEaseScore: number;
  ratingWindowScore: number;
  reviewBaseScore: number;
  rawScore: number;
  riskPenalty: number;
  manualOverride: number;
  finalScore: number;
}

export interface DataQualityResult {
  missingCoreFieldCount: number;
  needsMoreEvidence: boolean;
  isStale: boolean;
  ageDays: number;
}

export interface RpsResult {
  eligibility: EligibilityResult;
  score: ScoreBreakdown;
  dataQuality: DataQualityResult;
  level: RpsLevel;
  suggestedStatus: WorkflowStatus;
  falsePositiveTags: string[];
}

export type WorkflowStatusSource = "system" | "manual";

export interface ProductRecord extends ProductRow {
  id: string;
  importBatchId: string;
  importedAt: string;
  workflowStatus: WorkflowStatus;
  workflowStatusSource: WorkflowStatusSource;
  workflowStatusUpdatedAt?: string;
  notes?: string;
  scoutMeta?: {
    cardId: string;
    demandSignal: "high" | "medium-high" | "medium" | "low";
    competitionSignal: "high" | "medium-high" | "medium" | "low";
    confidence: "high" | "medium" | "low";
    painPoints: string[];
    opportunities: string[];
    risks: string[];
    preliminaryDecision: "go-deeper" | "watch" | "drop";
    reasonSummary: string;
    evidence: {
      type: "reddit" | "article" | "forum" | "review" | "marketplace" | "video" | "other";
      source: string;
      title: string;
      url: string;
      summary: string;
    }[];
    tags: string[];
  };
  rps: RpsResult;
}
