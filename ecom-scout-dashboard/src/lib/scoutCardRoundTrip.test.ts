import { describe, expect, it } from "vitest";
import example from "../../scout-card.example.json";
import { parseScoutCard, scoutCardToProductRecord, type ScoutCard } from "./scoutCard";
import { scoutCardToFeishuRecord } from "./scoutCardFeishu";

describe("scout card workbench export path", () => {
  it("keeps Feishu payload stable after importing into workbench", () => {
    const card = parseScoutCard(example);
    const record = scoutCardToProductRecord(card, "roundtrip-test");

    const reconstructed: ScoutCard = {
      schemaVersion: "scout-card.v1",
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
    expect(payload["Card ID"]).toBe(example.cardId);
    expect(payload["关键词"]).toBe(example.topic.keyword);
    expect(payload["工作流状态"]).toBe(record.workflowStatus);
    expect(payload["本地备注"]).toBe(example.workbench.notes);
    expect(payload["证据链接"]).toContain("Wirecutter");
  });
});
