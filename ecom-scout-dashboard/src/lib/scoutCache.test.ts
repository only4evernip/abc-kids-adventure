import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getFetchCachePath, readFetchCache, runFetchWithCache, writeFetchCache } from "./scoutCache";
import type { ScoutBrief } from "./scoutBrief";
import type { FetchedEvidenceDocument } from "./scoutFetch";

const brief: ScoutBrief = {
  version: 1,
  keyword: "Posture Corrector",
  market: "US",
  language: "en",
  platformFocus: ["Amazon US", "Reddit"],
  researchGoal: "需求验证 + 风险排查",
  notes: "优先看办公场景",
};

const cacheRoot = "/tmp/ecom-scout-cache-tests";

const docs: FetchedEvidenceDocument[] = [
  {
    sourceType: "web",
    sourceName: "example.com",
    sourceUrl: "https://example.com/posture-guide",
    title: "Posture correction guide",
    fetchedAt: "2026-03-12T00:00:00.000Z",
    keyword: "posture corrector",
    market: "US",
    content: "Long-form posture article content.",
  },
];

describe("scoutCache", () => {
  it("builds a stable cache path from market and normalized keyword", () => {
    const filePath = getFetchCachePath(brief, "web", cacheRoot);
    expect(filePath).toBe(path.join(cacheRoot, "fetch", "us", "posture-corrector", "web.json"));
  });

  it("reads fetch cache when file exists", () => {
    const filePath = getFetchCachePath(brief, "web", cacheRoot);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, documents: docs }, null, 2));

    const cached = readFetchCache(brief, "web", cacheRoot);
    expect(cached).toEqual(docs);
  });

  it("writes fetch cache when data is fetched", () => {
    writeFetchCache(brief, "web", docs, cacheRoot);
    const filePath = getFetchCachePath(brief, "web", cacheRoot);

    expect(fs.existsSync(filePath)).toBe(true);
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    expect(parsed.documents).toEqual(docs);
  });

  it("skips fetcher when cache hit occurs", async () => {
    writeFetchCache(brief, "web", docs, cacheRoot);
    let calls = 0;

    const result = await runFetchWithCache({
      brief,
      sourceType: "web",
      cacheRoot,
      fetcher: async () => {
        calls += 1;
        return [];
      },
    });

    expect(calls).toBe(0);
    expect(result).toEqual(docs);
  });
});
