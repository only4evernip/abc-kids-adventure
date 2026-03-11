import type { EligibilityResult, Level4, ProductRow, RpsResult, RpsLevel, ScoreBreakdown, WorkflowStatus } from "../types/product";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function safeText(value: string | null | undefined) {
  return (value || "").trim();
}

function hasText(value: string | null | undefined) {
  return safeText(value).length > 0;
}

function includesAny(text: string, words: string[]) {
  const v = safeText(text);
  return words.some((word) => v.includes(word));
}

export function eligibilityGate(row: ProductRow): EligibilityResult {
  const reasons: string[] = [];

  if (row.overallRisk === "极高") {
    reasons.push("总体风险等级极高");
  }

  if (includesAny(row.initialConclusion, ["侵权", "危险品", "禁入", "专利雷区"])) {
    reasons.push("初筛结论已标记高危禁入");
  }

  if (reasons.length > 0) {
    return {
      eligible: false,
      status: "reject",
      reasons,
    };
  }

  return {
    eligible: true,
    status: "pass",
    reasons: [],
  };
}

export function levelToScore(value: Level4 | null, mapping: Record<Level4, number>, fallback = 40) {
  if (!value) return fallback;
  return mapping[value];
}

export function scoreReviewGrowth(value: number | null) {
  if (value == null) return 20;
  if (value <= 0) return 10;
  if (value <= 10) return 25;
  if (value <= 30) return 55;
  if (value <= 50) return 75;
  return 100;
}

export function scoreBsr(value: number | null) {
  if (value == null) return 30;
  if (value <= 100) return 60;
  if (value <= 1000) return 90;
  if (value <= 5000) return 100;
  if (value <= 20000) return 80;
  if (value <= 50000) return 45;
  return 20;
}

export function scoreRatingWindow(value: number | null) {
  if (value == null) return 40;
  if (value >= 3.8 && value <= 4.2) return 100;
  if (value >= 4.3 && value <= 4.5) return 60;
  if (value < 3.7) return 40;
  if (value > 4.6) return 20;
  return 45;
}

export function scoreReviewBase(value: number | null) {
  if (value == null) return 35;
  if (value < 100) return 100;
  if (value <= 500) return 85;
  if (value <= 2000) return 60;
  if (value <= 5000) return 25;
  return 10;
}

export function riskMultiplier(value: Level4 | null) {
  if (!value) return 0.85;
  return {
    低: 1.0,
    中: 0.8,
    高: 0.3,
    极高: 0.0,
  }[value];
}

export function confidenceMultiplier(row: ProductRow) {
  const keys: Array<keyof ProductRow> = [
    "currentPrice",
    "currentBsr",
    "currentRating",
    "reviewCount",
    "reviewGrowth30d",
    "overallRisk",
  ];

  const missing = keys.filter((key) => row[key] == null || row[key] === "").length;
  let score = 1.0;

  if (missing === 1) score = 0.92;
  else if (missing === 2) score = 0.85;
  else if (missing === 3) score = 0.75;
  else if (missing >= 4) score = 0.6;

  if (hasText(row.coreSellingPoints) && hasText(row.topComplaintPoints) && hasText(row.desiredPoints)) {
    score += 0.03;
  }

  return Math.min(1, score);
}

export function overheatingPenalty(row: ProductRow) {
  let hits = 0;
  if ((row.reviewGrowth30d || 0) > 100) hits += 1;
  if ((row.reviewCount || 0) > 2000) hits += 1;
  if (row.headMonopoly === "高" || row.headMonopoly === "极高") hits += 1;
  if (row.competitionLevel === "高" || row.competitionLevel === "极高") hits += 1;

  if (hits >= 4) return 15;
  if (hits >= 2) return 8;
  return 0;
}

export function manualOverride(text: string) {
  const v = safeText(text);
  if (v.includes("强烈看好")) return 10;
  if (v.includes("看好")) return 5;
  if (v.includes("清库存红海")) return -15;
  if (v.includes("不看好")) return -10;
  return 0;
}

export function falsePositiveTags(row: ProductRow): string[] {
  const tags: string[] = [];

  if ((row.currentRating || 0) > 4.6 && (row.reviewCount || 0) > 2000 && !hasText(row.topComplaintPoints)) {
    tags.push("创新空间锁死");
  }

  if ((row.reviewGrowth30d || 0) > 100 && (row.reviewCount || 0) > 2000 && (row.competitionLevel === "高" || row.competitionLevel === "极高")) {
    tags.push("过热拥挤");
  }

  return tags;
}

export function classifyLevel(score: number): { level: RpsLevel; status: WorkflowStatus } {
  if (score >= 78) return { level: "strong", status: "供应链核价" };
  if (score >= 60) return { level: "watch", status: "观察池" };
  if (score >= 40) return { level: "hold", status: "待补证" };
  return { level: "reject", status: "淘汰库" };
}

export function calculateRps(row: ProductRow): RpsResult {
  const eligibility = eligibilityGate(row);

  const reviewGrowthScore = scoreReviewGrowth(row.reviewGrowth30d);
  const bsrScore = scoreBsr(row.currentBsr);
  const antiMonopolyScore = levelToScore(row.headMonopoly, {
    低: 100,
    中: 60,
    高: 20,
    极高: 0,
  });
  const competitionEaseScore = levelToScore(row.competitionLevel, {
    低: 100,
    中: 70,
    高: 30,
    极高: 10,
  });
  const ratingWindowScore = scoreRatingWindow(row.currentRating);
  const reviewBaseScore = scoreReviewBase(row.reviewCount);

  const rawScore =
    reviewGrowthScore * 0.25 +
    bsrScore * 0.15 +
    antiMonopolyScore * 0.2 +
    competitionEaseScore * 0.15 +
    ratingWindowScore * 0.15 +
    reviewBaseScore * 0.1;

  const risk = riskMultiplier(row.overallRisk);
  const confidence = confidenceMultiplier(row);
  const penalty = overheatingPenalty(row);
  const override = manualOverride(row.initialConclusion);

  const finalScore = eligibility.eligible
    ? clamp((rawScore + override - penalty) * risk * confidence)
    : 0;

  const classification = classifyLevel(finalScore);

  const breakdown: ScoreBreakdown = {
    reviewGrowthScore,
    bsrScore,
    antiMonopolyScore,
    competitionEaseScore,
    ratingWindowScore,
    reviewBaseScore,
    rawScore: Number(rawScore.toFixed(2)),
    riskMultiplier: risk,
    confidenceMultiplier: confidence,
    overheatingPenalty: penalty,
    manualOverride: override,
    finalScore: Number(finalScore.toFixed(2)),
  };

  return {
    eligibility,
    score: breakdown,
    level: classification.level,
    suggestedStatus: eligibility.eligible ? classification.status : "淘汰库",
    falsePositiveTags: falsePositiveTags(row),
  };
}
