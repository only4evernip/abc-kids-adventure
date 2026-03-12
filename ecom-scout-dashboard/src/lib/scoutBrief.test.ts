import { describe, expect, it } from "vitest";
import { parseScoutBrief } from "./scoutBrief";

describe("parseScoutBrief", () => {
  it("accepts a minimal valid brief and defaults language/platformFocus", () => {
    const brief = parseScoutBrief({
      version: 1,
      keyword: "posture corrector",
      market: "US",
    });

    expect(brief.version).toBe(1);
    expect(brief.keyword).toBe("posture corrector");
    expect(brief.market).toBe("US");
    expect(brief.language).toBe("en");
    expect(brief.platformFocus).toEqual([]);
  });

  it("throws when keyword is missing", () => {
    expect(() =>
      parseScoutBrief({
        version: 1,
        market: "US",
      })
    ).toThrow("无效的侦察 brief：缺少 keyword");
  });

  it("throws when market is invalid", () => {
    expect(() =>
      parseScoutBrief({
        version: 1,
        keyword: "posture corrector",
        market: "JP",
      })
    ).toThrow("无效的侦察 brief：market 仅支持 US / CA");
  });

  it("keeps optional fields when provided", () => {
    const brief = parseScoutBrief({
      version: 1,
      keyword: "anti snoring device",
      market: "CA",
      language: "en",
      platformFocus: ["Amazon CA", "Reddit"],
      researchGoal: "需求验证 + 风险排查",
      notes: "优先看舒适度相关痛点",
    });

    expect(brief.platformFocus).toEqual(["Amazon CA", "Reddit"]);
    expect(brief.researchGoal).toBe("需求验证 + 风险排查");
    expect(brief.notes).toBe("优先看舒适度相关痛点");
  });
});
