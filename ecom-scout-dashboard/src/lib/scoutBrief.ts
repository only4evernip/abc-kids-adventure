export interface ScoutBrief {
  version: 1;
  keyword: string;
  market: "US" | "CA";
  language: string;
  platformFocus: string[];
  researchGoal?: string;
  notes?: string;
}

export function parseScoutBrief(input: unknown): ScoutBrief {
  const brief = input as Partial<ScoutBrief>;

  if (!brief || typeof brief !== "object") {
    throw new Error("无效的侦察 brief：输入必须是对象");
  }

  if (!brief.keyword || !brief.keyword.trim()) {
    throw new Error("无效的侦察 brief：缺少 keyword");
  }

  if (brief.market !== "US" && brief.market !== "CA") {
    throw new Error("无效的侦察 brief：market 仅支持 US / CA");
  }

  return {
    version: 1,
    keyword: brief.keyword.trim(),
    market: brief.market,
    language: brief.language?.trim() || "en",
    platformFocus: Array.isArray(brief.platformFocus) ? brief.platformFocus : [],
    researchGoal: brief.researchGoal?.trim() || undefined,
    notes: brief.notes?.trim() || undefined,
  };
}
