export type Level4 = "低" | "中" | "高" | "极高";

export type RpsLevel = "strong" | "watch" | "hold" | "reject";

export type WorkflowStatus =
  | "待评估"
  | "观察池"
  | "待补证"
  | "供应链核价"
  | "打样验证"
  | "小单测试"
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
  riskMultiplier: number;
  confidenceMultiplier: number;
  overheatingPenalty: number;
  manualOverride: number;
  finalScore: number;
}

export interface RpsResult {
  eligibility: EligibilityResult;
  score: ScoreBreakdown;
  level: RpsLevel;
  suggestedStatus: WorkflowStatus;
  falsePositiveTags: string[];
}
