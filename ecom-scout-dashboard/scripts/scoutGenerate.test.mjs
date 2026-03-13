import { describe, expect, it } from "vitest";
import { generateScoutCard } from "./scoutGenerate.mjs";

describe("scoutGenerate script helpers", () => {
  it("runs the V1.1 fetch -> summarize -> card pipeline with mock deps", async () => {
    const result = await generateScoutCard({
      brief: {
        version: 1,
        keyword: "posture corrector",
        market: "US",
        language: "en",
        platformFocus: ["Amazon US", "Reddit"],
        researchGoal: "需求验证 + 风险排查",
        notes: "优先看办公场景",
      },
      cacheRoot: "/tmp/ecom-scout-cli-pipeline-test",
    });

    expect(result.documents.length).toBeGreaterThan(0);
    expect(result.draft.keyword).toBe("posture corrector");
    expect(result.summary.preliminaryDecision).toBe("watch");
    expect(result.summary.demandEvidence.length).toBeGreaterThan(0);
    expect(result.summary.painPointEvidence.length).toBeGreaterThan(0);
    expect(result.summary.riskEvidence.length).toBeGreaterThan(0);
    expect(result.card.schemaVersion).toBe("scout-card.v1");
    expect(result.card.topic.keyword).toBe("posture corrector");
    expect(result.card.evidence.length).toBeGreaterThan(0);
  });
});
