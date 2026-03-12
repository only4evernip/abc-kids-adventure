import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { summarizeResearchDraft, type ScoutLlmClient } from "./scoutSummarizer";
import type { ScoutBrief } from "./scoutBrief";
import type { FetchedEvidenceDocument } from "./scoutFetch";

const brief: ScoutBrief = {
  version: 1,
  keyword: "Anti Snoring Device",
  market: "US",
  language: "en",
  platformFocus: ["Amazon US", "Reddit"],
  researchGoal: "需求验证 + 风险排查",
  notes: "优先看舒适度与依从性",
};

const cacheRoot = "/tmp/ecom-scout-draft-cache-tests";

const documents: FetchedEvidenceDocument[] = [
  {
    sourceType: "web",
    sourceName: "Sleep Foundation",
    sourceUrl: "https://example.com/snoring-guide",
    title: "How people deal with snoring",
    fetchedAt: "2026-03-13T00:00:00.000Z",
    keyword: "anti snoring device",
    market: "US",
    content: "People keep looking for simple anti-snoring solutions and complain about comfort.",
  },
  {
    sourceType: "reddit",
    sourceName: "Reddit/r/snoring",
    sourceUrl: "https://www.reddit.com/r/snoring/comments/abc123/help",
    title: "Need an anti snoring device that I can tolerate",
    fetchedAt: "2026-03-13T00:00:01.000Z",
    keyword: "anti snoring device",
    market: "US",
    content: "Users say many devices feel bulky and they stop using them after a few nights.",
  },
];

const validDraftJson = JSON.stringify({
  keyword: "anti snoring device",
  market: "US",
  productDirection: "comfortable anti-snoring mouthpiece",
  demandSignal: "high",
  competitionSignal: "high",
  demandEvidence: [
    {
      sourceName: "Sleep Foundation",
      sourceUrl: "https://example.com/snoring-guide",
      title: "How people deal with snoring",
      summary: "Users actively look for anti-snoring solutions.",
    },
  ],
  painPoints: ["佩戴不舒服", "难以坚持使用"],
  painPointEvidence: [
    {
      sourceName: "Reddit/r/snoring",
      sourceUrl: "https://www.reddit.com/r/snoring/comments/abc123/help",
      title: "Need an anti snoring device that I can tolerate",
      summary: "Comfort and adherence are repeated complaints.",
    },
  ],
  risks: ["赛道成熟", "舒适度门槛高"],
  riskEvidence: [
    {
      sourceName: "Sleep Foundation",
      sourceUrl: "https://example.com/snoring-guide",
      title: "How people deal with snoring",
      summary: "The category is established and users are demanding.",
    },
  ],
  opportunities: ["更舒适的轻量设计"],
  preliminaryDecision: "watch",
  reasonSummary: "需求真实，但舒适度与成熟竞争会卡住转化。",
  nextStep: "继续深挖舒适度方案与差评集中点",
  notes: "先别激进 go-deeper",
  tags: ["comfort", "mature-category"],
});

describe("scoutSummarizer", () => {
  it("skips llm client when draft cache hit occurs", async () => {
    const llmCalls: string[] = [];
    const mockLlmClient: ScoutLlmClient = async (prompt) => {
      llmCalls.push(prompt);
      return validDraftJson;
    };

    const cachePath = path.join(cacheRoot, "draft", "us", "anti-snoring-device", "draft.json");
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, validDraftJson);

    const result = await summarizeResearchDraft({
      brief,
      documents,
      cacheRoot,
      llmClient: mockLlmClient,
    });

    expect(llmCalls).toHaveLength(0);
    expect(result.productDirection).toBe("comfortable anti-snoring mouthpiece");
    expect(result.preliminaryDecision).toBe("watch");
  });

  it("parses valid llm json into ScoutResearchDraft and persists draft cache", async () => {
    const mockLlmClient: ScoutLlmClient = async () => validDraftJson;

    const result = await summarizeResearchDraft({
      brief,
      documents,
      cacheRoot,
      llmClient: mockLlmClient,
    });

    expect(result.keyword).toBe("anti snoring device");
    expect(result.market).toBe("US");
    expect(result.preliminaryDecision).toBe("watch");
    expect(result.demandEvidence).toHaveLength(1);
    expect(result.painPointEvidence).toHaveLength(1);
    expect(result.riskEvidence).toHaveLength(1);

    const cachePath = path.join(cacheRoot, "draft", "us", "anti-snoring-device", "draft.json");
    expect(fs.existsSync(cachePath)).toBe(true);
  });

  it("throws a clear parse error when llm returns non-json", async () => {
    const mockLlmClient: ScoutLlmClient = async () => "definitely not json";

    await expect(
      summarizeResearchDraft({
        brief,
        documents,
        cacheRoot: `${cacheRoot}-invalid-json`,
        llmClient: mockLlmClient,
      })
    ).rejects.toThrow("LLM draft parse failed: invalid JSON");
  });

  it("throws a clear validation error when llm omits required fields", async () => {
    const mockLlmClient: ScoutLlmClient = async () =>
      JSON.stringify({
        keyword: "anti snoring device",
        market: "US",
        productDirection: "comfortable anti-snoring mouthpiece",
        demandSignal: "high",
        competitionSignal: "high",
        demandEvidence: [],
        painPoints: [],
        painPointEvidence: [],
        risks: [],
        riskEvidence: [],
        reasonSummary: "missing decision",
        nextStep: "inspect reviews",
      });

    await expect(
      summarizeResearchDraft({
        brief,
        documents,
        cacheRoot: `${cacheRoot}-missing-field`,
        llmClient: mockLlmClient,
      })
    ).rejects.toThrow("LLM draft validation failed: missing preliminaryDecision");
  });

  it("never fabricates evidence when documents are empty", async () => {
    const mockLlmClient: ScoutLlmClient = async () =>
      JSON.stringify({
        keyword: "anti snoring device",
        market: "US",
        productDirection: "anti-snoring device",
        demandSignal: "low",
        competitionSignal: "medium",
        demandEvidence: [
          {
            sourceName: "Imaginary Source",
            sourceUrl: "https://imaginary.example/evidence",
            title: "Fake demand proof",
            summary: "This should be stripped out.",
          },
        ],
        painPoints: [],
        painPointEvidence: [
          {
            sourceName: "Imaginary Source",
            sourceUrl: "https://imaginary.example/pain",
            title: "Fake pain proof",
            summary: "This should be stripped out.",
          },
        ],
        risks: ["证据不足"],
        riskEvidence: [
          {
            sourceName: "Imaginary Source",
            sourceUrl: "https://imaginary.example/risk",
            title: "Fake risk proof",
            summary: "This should be stripped out.",
          },
        ],
        preliminaryDecision: "watch",
        reasonSummary: "没有抓到有效文档，不能强行下结论。",
        nextStep: "先修 fetch 层，再重跑",
      });

    const result = await summarizeResearchDraft({
      brief,
      documents: [],
      cacheRoot: `${cacheRoot}-empty`,
      llmClient: mockLlmClient,
    });

    expect(result.demandEvidence).toEqual([]);
    expect(result.painPointEvidence).toEqual([]);
    expect(result.riskEvidence).toEqual([]);
  });
});
