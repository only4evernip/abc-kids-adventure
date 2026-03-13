import type { EligibilityResult, Level4, ProductRow, RpsResult, RpsLevel, ScoreBreakdown, WorkflowStatus } from "../types/product.ts";

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

function daysSince(dateText: string): number {
  const ts = Date.parse(dateText);
  if (Number.isNaN(ts)) return 999;
  return Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
}

export function eligibilityGate(row: ProductRow): EligibilityResult {
  const reasons: string[] = [];

  if (row.overallRisk === "极高") {
    reasons.push("总体风险等级极高");
  }

  if (includesAny(row.initialConclusion, ["侵权", "危险品", "禁入", "专利雷区"])) {
    reasons.push("初筛结论已标记高危禁入");
  }

  if ((row.currentRating || 0) > 4.6 && (row.reviewCount || 0) > 2000 && !hasText(row.topComplaintPoints)) {
    reasons.push("创新空间锁死：高评分高壁垒且无明确差评切口");
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
  if (value == null) return 35;
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

export function fixedRiskPenalty(value: Level4 | null) {
  if (!value) return 5;
  return {
    低: 0,
    中: 8,
    高: 15,
    极高: 100,
  }[value];
}

export function dataQuality(row: ProductRow) {
  const keys: Array<keyof ProductRow> = [
    "currentPrice",
    "currentBsr",
    "currentRating",
    "reviewCount",
    "reviewGrowth30d",
    "overallRisk",
  ];

  const missingCoreFieldCount = keys.filter((key) => row[key] == null || row[key] === "").length;
  const ageDays = daysSince(row.researchDate);
  const isStale = ageDays > 15;
  const needsMoreEvidence = missingCoreFieldCount >= 2;

  return {
    missingCoreFieldCount,
    needsMoreEvidence,
    isStale,
    ageDays,
  };
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

  let heatHits = 0;
  if ((row.reviewGrowth30d || 0) > 100) heatHits += 1;
  if ((row.reviewCount || 0) > 2000) heatHits += 1;
  if (row.headMonopoly === "高" || row.headMonopoly === "极高") heatHits += 1;
  if (row.competitionLevel === "高" || row.competitionLevel === "极高") heatHits += 1;
  if (heatHits >= 2) tags.push("过热拥挤");

  const quality = dataQuality(row);
  if (quality.isStale) tags.push("数据过期");
  if (quality.needsMoreEvidence) tags.push("待补证");

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
  const quality = dataQuality(row);

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
    bsrScore * 0.1 +
    antiMonopolyScore * 0.2 +
    competitionEaseScore * 0.15 +
    ratingWindowScore * 0.2 +
    reviewBaseScore * 0.1;

  const override = manualOverride(row.initialConclusion);
  const riskPenalty = fixedRiskPenalty(row.overallRisk);

  const finalScore = eligibility.eligible ? clamp(rawScore + override - riskPenalty) : 0;
  const classification = classifyLevel(finalScore);

  let suggestedStatus: WorkflowStatus = eligibility.eligible ? classification.status : "淘汰库";

  if (!eligibility.eligible) {
    suggestedStatus = "淘汰库";
  } else if (quality.needsMoreEvidence || quality.isStale) {
    suggestedStatus = "待补证";
  } else if (row.overallRisk === "高" && suggestedStatus === "供应链核价") {
    suggestedStatus = "观察池";
  }

  const breakdown: ScoreBreakdown = {
    reviewGrowthScore,
    bsrScore,
    antiMonopolyScore,
    competitionEaseScore,
    ratingWindowScore,
    reviewBaseScore,
    rawScore: Number(rawScore.toFixed(2)),
    riskPenalty,
    manualOverride: override,
    finalScore: Number(finalScore.toFixed(2)),
  };

  return {
    eligibility,
    dataQuality: quality,
    score: breakdown,
    level: classification.level,
    suggestedStatus,
    falsePositiveTags: falsePositiveTags(row),
  };
}
