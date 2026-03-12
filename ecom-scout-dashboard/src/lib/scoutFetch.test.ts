import { describe, expect, it } from "vitest";
import { fetchRedditEvidence, fetchResearchEvidence, fetchWebEvidence, type FetchDependencies } from "./scoutFetch";
import type { ScoutBrief } from "./scoutBrief";

const brief: ScoutBrief = {
  version: 1,
  keyword: "posture corrector",
  market: "US",
  language: "en",
  platformFocus: ["Amazon US", "Reddit"],
  researchGoal: "需求验证 + 风险排查",
  notes: "优先看办公场景",
};

describe("scoutFetch", () => {
  it("returns fetch result with documents and warnings", async () => {
    const deps: FetchDependencies = {
      web: async () => [
        {
          sourceType: "web",
          sourceName: "Example Blog",
          sourceUrl: "https://example.com/posture-guide",
          title: "Posture correction guide",
          fetchedAt: "2026-03-12T00:00:00.000Z",
          keyword: brief.keyword,
          market: brief.market,
          content: "Long-form posture article content.",
        },
      ],
      reddit: async () => {
        throw new Error("reddit timeout");
      },
    };

    const result = await fetchResearchEvidence(brief, deps);

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.sourceType).toBe("web");
    expect(result.warnings).toEqual(expect.arrayContaining(["Reddit fetch failed: reddit timeout"]));
  });

  it("returns warnings instead of throwing when all source fetchers fail", async () => {
    const deps: FetchDependencies = {
      web: async () => {
        throw new Error("web unavailable");
      },
      reddit: async () => {
        throw new Error("reddit timeout");
      },
    };

    const result = await fetchResearchEvidence(brief, deps);

    expect(result.documents).toEqual([]);
    expect(result.warnings).toEqual([
      "Web fetch failed: web unavailable",
      "Reddit fetch failed: reddit timeout",
    ]);
  });

  it("maps web fetch responses into fetched evidence documents", async () => {
    const docs = await fetchWebEvidence(brief, {
      searchWeb: async () => [
        { url: "https://example.com/posture-guide", title: "Posture correction guide" },
      ],
      fetchDocument: async (url) => ({
        url,
        title: "Posture correction guide",
        content: "Long-form posture article content.",
      }),
    });

    expect(docs).toHaveLength(1);
    expect(docs[0]?.sourceType).toBe("web");
    expect(docs[0]?.sourceUrl).toBe("https://example.com/posture-guide");
    expect(docs[0]?.title).toBe("Posture correction guide");
    expect(docs[0]?.content).toContain("Long-form posture article");
  });

  it("returns empty docs when web search yields nothing", async () => {
    const docs = await fetchWebEvidence(brief, {
      searchWeb: async () => [],
      fetchDocument: async () => ({ url: "", title: "", content: "" }),
    });

    expect(docs).toEqual([]);
  });

  it("maps reddit posts into fetched evidence documents on happy path", async () => {
    const result = await fetchRedditEvidence(brief, {
      searchReddit: async () => [
        {
          url: "https://www.reddit.com/r/posture/comments/abc123/help_needed",
          title: "Need help fixing my posture",
          content: "I sit at my desk all day and my posture keeps getting worse.",
          subreddit: "posture",
        },
      ],
    });

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0]?.sourceType).toBe("reddit");
    expect(result.documents[0]?.sourceUrl).toContain("reddit.com");
    expect(result.documents[0]?.content).toContain("desk all day");
    expect(result.warnings).toEqual([]);
  });

  it("returns warnings instead of throwing on reddit timeout or 403", async () => {
    const result = await fetchRedditEvidence(brief, {
      searchReddit: async () => {
        throw new Error("403 Forbidden");
      },
    });

    expect(result.documents).toEqual([]);
    expect(result.warnings).toEqual(["Reddit fetch failed: 403 Forbidden"]);
  });

  it("treats empty or malformed reddit payload as warning, not crash", async () => {
    const result = await fetchRedditEvidence(brief, {
      searchReddit: async () => [
        {
          url: "",
          title: "",
          content: "",
        },
      ],
    });

    expect(result.documents).toEqual([]);
    expect(result.warnings).toEqual(["Reddit fetch returned empty or invalid items"]);
  });
});
