import { describe, expect, it } from "vitest";
import { buildMockResearchDraft } from "./scoutGenerate.mjs";

describe("scoutGenerate script helpers", () => {
  it("builds a mock research draft from scout brief", () => {
    const draft = buildMockResearchDraft({
      version: 1,
      keyword: "posture corrector",
      market: "US",
      language: "en",
      platformFocus: ["Amazon US", "Reddit"],
      researchGoal: "需求验证 + 风险排查",
      notes: "优先看办公场景",
    });

    expect(draft.keyword).toBe("posture corrector");
    expect(draft.market).toBe("US");
    expect(draft.productDirection).toBe("posture corrector");
    expect(draft.demandEvidence.length).toBeGreaterThan(0);
    expect(draft.painPointEvidence.length).toBeGreaterThan(0);
    expect(draft.riskEvidence.length).toBeGreaterThan(0);
  });
});
