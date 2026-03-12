import { describe, expect, it } from "vitest";
import example from "../../scout-card.example.json";
import { parseScoutCard, scoutCardToProductRecord } from "./scoutCard";

describe("scoutCard import", () => {
  it("parses example scout card and maps it into a ProductRecord", () => {
    const card = parseScoutCard(example);
    const record = scoutCardToProductRecord(card, "scout-test");

    expect(record.id).toMatch(/^scout_/);
    expect(record.importBatchId).toBe("scout-test");
    expect(record.keyword).toBe(card.topic.keyword);
    expect(record.productDirection).toBe(card.topic.productDirection);
    expect(record.market).toBe(card.topic.market);
    expect(record.workflowStatusSource).toBe("manual");
    expect(record.notes).toContain("优先排查是否有规避医疗器械认证的侧翼打法");
    expect(record.scoutMeta?.cardId).toBe(example.cardId);
    expect(record.scoutMeta?.evidence[0]?.source).toBe("Wirecutter");
    expect(record.scoutMeta?.painPoints).toContain("佩戴不舒服");
    expect(record.rps.falsePositiveTags).toContain("问题驱动型需求");
  });
});
