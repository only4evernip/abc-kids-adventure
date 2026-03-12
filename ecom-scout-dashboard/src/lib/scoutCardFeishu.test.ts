import { describe, expect, it } from "vitest";
import example from "../../scout-card.example.json";
import { parseScoutCard } from "./scoutCard";
import { scoutCardToFeishuRecord } from "./scoutCardFeishu";

describe("scoutCardToFeishuRecord", () => {
  it("maps scout card into a stable Feishu-friendly flat record", () => {
    const card = parseScoutCard(example);
    const record = scoutCardToFeishuRecord(card);

    expect(record["Card ID"]).toBe(example.cardId);
    expect(record["关键词"]).toBe(example.topic.keyword);
    expect(record["产品方向"]).toBe(example.topic.productDirection);
    expect(record["市场"]).toBe(example.topic.market);
    expect(record["需求信号"]).toBe(example.signals.demandSignal);
    expect(record["用户痛点"]).toContain("佩戴不舒服");
    expect(record["标签"]).toContain("问题驱动型需求");
    expect(record["证据链接"]).toContain("Wirecutter");
    expect(record["证据摘要"]).toContain("赛道成熟");
    expect(record["工作流状态"]).toBe(example.workbench.workflowStatus);
  });
});
