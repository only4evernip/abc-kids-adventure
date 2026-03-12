import { describe, expect, it } from "vitest";
import { normalizeResearchSummary, type ScoutResearchDraft } from "./scoutResearch";

describe("normalizeResearchSummary", () => {
  it("keeps whitelist evidence from reddit and amazon", () => {
    const draft: ScoutResearchDraft = {
      keyword: "posture corrector",
      market: "US",
      productDirection: "smart posture brace",
      demandSignal: "high",
      competitionSignal: "medium-high",
      demandEvidence: [
        {
          sourceName: "Reddit",
          sourceUrl: "https://www.reddit.com/r/posture/comments/example",
          title: "Need posture help",
          summary: "Users are actively looking for solutions.",
        },
      ],
      painPoints: ["不舒服"],
      painPointEvidence: [
        {
          sourceName: "Amazon",
          sourceUrl: "https://www.amazon.com/review/example",
          title: "Too uncomfortable",
          summary: "Comfort is a major complaint.",
        },
      ],
      risks: ["赛道成熟"],
      riskEvidence: [
        {
          sourceName: "Forum",
          sourceUrl: "https://exampleforum.com/thread/1",
          title: "Crowded category discussion",
          summary: "People think the category is crowded.",
        },
      ],
      preliminaryDecision: "watch",
      reasonSummary: "需求真实，但竞争不轻。",
      nextStep: "继续深挖舒适度差异化",
    };

    const summary = normalizeResearchSummary(draft);

    expect(summary.demandEvidence).toHaveLength(1);
    expect(summary.painPointEvidence).toHaveLength(1);
    expect(summary.riskEvidence).toHaveLength(1);
    expect(summary.demandEvidence[0]?.source).toBe("Reddit");
    expect(summary.painPointEvidence[0]?.type).toBe("review");
  });

  it("drops non-whitelist evidence from tiktok and xiaohongshu", () => {
    const draft: ScoutResearchDraft = {
      keyword: "posture corrector",
      market: "US",
      productDirection: "smart posture brace",
      demandSignal: "medium",
      competitionSignal: "high",
      demandEvidence: [
        {
          sourceName: "TikTok",
          sourceUrl: "https://www.tiktok.com/@demo/video/123",
          title: "Trending posture hack",
          summary: "Short video trend.",
        },
      ],
      painPoints: ["容易闲置"],
      painPointEvidence: [
        {
          sourceName: "小红书",
          sourceUrl: "https://www.xiaohongshu.com/explore/abc",
          title: "姿势矫正器体验",
          summary: "User diary post.",
        },
      ],
      risks: ["证据质量存疑"],
      riskEvidence: [
        {
          sourceName: "Reddit",
          sourceUrl: "https://www.reddit.com/r/posture/comments/risk1",
          title: "Need stronger differentiation",
          summary: "Category looks crowded.",
        },
      ],
      preliminaryDecision: "drop",
      reasonSummary: "噪音大且证据质量不稳。",
      nextStep: "换更干净的信息源再看",
    };

    const summary = normalizeResearchSummary(draft);

    expect(summary.demandEvidence).toHaveLength(0);
    expect(summary.painPointEvidence).toHaveLength(0);
    expect(summary.riskEvidence).toHaveLength(1);
    expect(summary.warnings).toEqual(
      expect.arrayContaining(["已过滤非白名单来源：TikTok", "已过滤非白名单来源：小红书"])
    );
  });

  it("throws when evidence item is missing sourceUrl or sourceName", () => {
    const draft: ScoutResearchDraft = {
      keyword: "posture corrector",
      market: "US",
      productDirection: "smart posture brace",
      demandSignal: "high",
      competitionSignal: "medium",
      demandEvidence: [
        {
          sourceName: "Reddit",
          sourceUrl: "",
          title: "Need posture help",
          summary: "Users are actively looking for solutions.",
        },
      ],
      painPoints: [],
      painPointEvidence: [],
      risks: [],
      riskEvidence: [],
      preliminaryDecision: "watch",
      reasonSummary: "证据不完整。",
      nextStep: "补抓有效来源",
    };

    expect(() => normalizeResearchSummary(draft)).toThrow("无效的 research evidence：缺少 sourceName 或 sourceUrl");
  });
});
