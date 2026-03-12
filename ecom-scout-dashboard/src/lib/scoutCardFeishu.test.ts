import { describe, expect, it } from "vitest";
import example from "../../scout-card.example.json";
import { parseScoutCard } from "./scoutCard";
import { scoutCardToFeishuRecord } from "./scoutCardFeishu";

describe("scoutCardToFeishuRecord", () => {
  it("maps scout card into a stable Feishu-friendly flat record", () => {
    const card = parseScoutCard(example);
    const record = scoutCardToFeishuRecord(card);

    expect(record.cardId).toBe(example.cardId);
    expect(record.keyword).toBe(example.topic.keyword);
    expect(record.productDirection).toBe(example.topic.productDirection);
    expect(record.market).toBe(example.topic.market);
    expect(record.demandSignal).toBe(example.signals.demandSignal);
    expect(record.painPoints).toContain("佩戴不舒服");
    expect(record.tags).toContain("问题驱动型需求");
    expect(record.evidenceLinks).toContain("Wirecutter");
    expect(record.evidenceSummary).toContain("赛道成熟");
    expect(record.workflowStatus).toBe(example.workbench.workflowStatus);
  });
});
