import { describe, expect, it } from "vitest";
import example from "../../scout-card.example.json";
import { parseScoutCard, scoutCardToProductRecord } from "./scoutCard";
import { scoutCardToFeishuRecord } from "./scoutCardFeishu";

describe("scout card workbench export path", () => {
  it("keeps Feishu payload stable after importing into workbench", () => {
    const card = parseScoutCard(example);
    const record = scoutCardToProductRecord(card, "roundtrip-test");

    const reconstructed = {
      schemaVersion: "scout-card.v1" as const,
      cardId: record.scoutMeta!.cardId,
      createdAt: `${record.researchDate}T00:00:00+08:00`,
      updatedAt: record.workflowStatusUpdatedAt || record.importedAt,
      topic: {
        keyword: record.keyword,
        productDirection: record.productDirection,
        market: record.market,
        platformFocus: record.platformSite ? [record.platformSite] : [],
        language: "en",
      },
      signals: {
        demandSignal: record.scoutMeta!.demandSignal,
        competitionSignal: record.scoutMeta!.competitionSignal,
        confidence: record.scoutMeta!.confidence,
      },
      insights: {
        painPoints: record.scoutMeta!.painPoints,
        risks: record.scoutMeta!.risks,
        opportunities: record.scoutMeta!.opportunities,
      },
      decision: {
        preliminaryDecision: record.scoutMeta!.preliminaryDecision,
        nextStep: record.nextAction,
        reasonSummary: record.scoutMeta!.reasonSummary,
      },
      evidence: record.scoutMeta!.evidence,
      workbench: {
        workflowStatus: record.workflowStatus,
        notes: record.notes || "",
        tags: record.scoutMeta!.tags,
      },
    };

    const payload = scoutCardToFeishuRecord(reconstructed);
    expect(payload.cardId).toBe(example.cardId);
    expect(payload.keyword).toBe(example.topic.keyword);
    expect(payload.workflowStatus).toBe(record.workflowStatus);
    expect(payload.notes).toBe(example.workbench.notes);
    expect(payload.evidenceLinks).toContain("Wirecutter");
  });
});
