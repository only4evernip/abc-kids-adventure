import { describe, expect, it } from "vitest";
import example from "../../scout-card.example.json";
import { buildScoutCardFromResearch, parseScoutCard, scoutCardToProductRecord, type ScoutResearchSummary } from "./scoutCard";

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

  it("builds a high-confidence scout card when evidence is complete", () => {
    const summary: ScoutResearchSummary = {
      keyword: "posture corrector",
      market: "US",
      productDirection: "smart posture brace",
      platformFocus: ["Amazon US", "Reddit"],
      language: "en",
      demandSignal: "high",
      competitionSignal: "medium-high",
      demandEvidence: [
        {
          type: "reddit",
          source: "Reddit",
          title: "Need posture help while working",
          url: "https://reddit.com/example-demand",
          summary: "Users actively look for posture correction tools during long desk work.",
        },
      ],
      painPoints: ["普通姿势带太勒", "无法长期佩戴"],
      painPointEvidence: [
        {
          type: "review",
          source: "Amazon",
          title: "Too uncomfortable for all-day use",
          url: "https://amazon.com/example-pain",
          summary: "Comfort is the top complaint in existing products.",
        },
      ],
      risks: ["赛道成熟，需要差异化切口"],
      riskEvidence: [
        {
          type: "article",
          source: "Wirecutter",
          title: "Posture products are crowded",
          url: "https://example.com/risk",
          summary: "Category is crowded but differentiated products still get attention.",
        },
      ],
      opportunities: ["智能提醒 + 更轻量材质"],
      preliminaryDecision: "go-deeper",
      reasonSummary: "需求真实，痛点清晰，适合先做差异化验证。",
      nextStep: "继续验证用户是否愿为智能提醒付费",
      notes: "优先看办公人群场景",
      tags: ["侦察虾", "姿势矫正"],
    };

    const card = buildScoutCardFromResearch(summary);

    expect(card.schemaVersion).toBe("scout-card.v1");
    expect(card.cardId).toMatch(/^scout_/);
    expect(card.createdAt).toBeTruthy();
    expect(card.updatedAt).toBeTruthy();
    expect(card.signals.confidence).toBe("high");
    expect(card.decision.preliminaryDecision).toBe("go-deeper");
    expect(card.evidence).toHaveLength(3);
  });

  it("downgrades confidence and locks decision to watch when evidence is insufficient", () => {
    const summary: ScoutResearchSummary = {
      keyword: "posture corrector",
      market: "US",
      productDirection: "smart posture brace",
      platformFocus: ["Amazon US"],
      language: "en",
      demandSignal: "high",
      competitionSignal: "medium",
      demandEvidence: [
        {
          type: "reddit",
          source: "Reddit",
          title: "Looking for posture support",
          url: "https://reddit.com/example-demand-2",
          summary: "People are asking for posture support options.",
        },
      ],
      painPoints: [],
      painPointEvidence: [],
      risks: [],
      riskEvidence: [],
      opportunities: ["提醒功能可能有机会"],
      preliminaryDecision: "go-deeper",
      reasonSummary: "目前只有需求证据，其他还不够。",
      nextStep: "补充客诉和竞争证据",
    };

    const card = buildScoutCardFromResearch(summary);

    expect(card.signals.confidence).toBe("low");
    expect(card.decision.preliminaryDecision).toBe("watch");
    expect(card.decision.reasonSummary).toContain("证据不足");
  });
});
