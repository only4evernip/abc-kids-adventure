import fs from "node:fs";
import path from "node:path";
import { parseScoutBrief } from "../src/lib/scoutBrief.ts";
import { runFetchWithCache } from "../src/lib/scoutCache.ts";
import { fetchWebEvidence } from "../src/lib/scoutFetch.ts";
import { normalizeResearchSummary } from "../src/lib/scoutResearch.ts";
import { buildScoutCardFromResearch } from "../src/lib/scoutCard.ts";
import { summarizeResearchDraft } from "../src/lib/scoutSummarizer.ts";
import { createOpenAiCompatibleLlmClient, getLlmConfigFromEnv } from "../src/lib/scoutLlmAdapter.ts";
import { createGeminiLlmClient, getGeminiConfigFromEnv } from "../src/lib/scoutGeminiAdapter.ts";
import { fetchDocumentWithJina } from "../src/lib/scoutWebAdapter.ts";

export function parseArgs(argv) {
  const args = {
    file: "./scout-brief.example.json",
    out: "/tmp/scout-card.json",
    cacheRoot: "scout-cache",
    liveWeb: false,
    liveLlm: false,
    liveGemini: false,
    debugContent: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.file = argv[i + 1];
    if (arg === "--out") args.out = argv[i + 1];
    if (arg === "--cache-root") args.cacheRoot = argv[i + 1];
    if (arg === "--live-web") args.liveWeb = true;
    if (arg === "--live-llm") args.liveLlm = true;
    if (arg === "--live-gemini") args.liveGemini = true;
    if (arg === "--debug-content") args.debugContent = true;
  }

  return args;
}

export function createMockFetchers() {
  return {
    web: async (brief) => [
      {
        sourceType: "web",
        sourceName: "Sleep Foundation",
        sourceUrl: "https://example.com/snoring-guide",
        title: `Why people keep searching ${brief.keyword}`,
        fetchedAt: "2026-03-13T00:00:00.000Z",
        keyword: brief.keyword,
        market: brief.market,
        content: `${brief.keyword} has steady problem awareness, and users keep looking for solutions with better comfort and compliance.`,
      },
    ],
    reddit: async (brief) => [
      {
        sourceType: "reddit",
        sourceName: "Reddit/r/snoring",
        sourceUrl: "https://www.reddit.com/r/snoring/comments/abc123/help",
        title: `Need a ${brief.keyword} I can actually tolerate`,
        fetchedAt: "2026-03-13T00:00:01.000Z",
        keyword: brief.keyword,
        market: brief.market,
        content: "Users complain that many devices feel bulky, uncomfortable, and easy to abandon after a few nights.",
      },
    ],
  };
}

export function createLiveWebFetcher() {
  return async (brief) =>
    fetchWebEvidence(brief, {
      // TODO: integrate real search for general web result discovery instead of hardcoded seed URLs.
      // See ADR: docs/decisions/002-v1.2-negative-evidence-discovery.md
      searchWeb: async () => [
        {
          url: "https://www.healthline.com/health/best-posture-corrector",
          title: "The 4 Best Posture Correctors and How to Choose",
        },
      ],
      fetchDocument: (url) => fetchDocumentWithJina(url),
    });
}

export function createMockLlmClient() {
  return async (prompt) => {
    const parsed = JSON.parse(prompt);
    const brief = parsed.brief;

    return JSON.stringify({
      keyword: String(brief.keyword).trim().toLowerCase(),
      market: brief.market,
      productDirection: `comfortable ${String(brief.keyword).trim().toLowerCase()}`,
      platformFocus: Array.isArray(brief.platformFocus) ? brief.platformFocus : [],
      language: brief.language || "en",
      demandSignal: "high",
      competitionSignal: "high",
      demandEvidence: [
        {
          sourceName: "Sleep Foundation",
          sourceUrl: "https://example.com/snoring-guide",
          title: `Why people keep searching ${brief.keyword}`,
          summary: "Users are actively looking for workable solutions.",
        },
      ],
      painPoints: ["佩戴不舒服", "难以长期坚持使用"],
      painPointEvidence: [
        {
          sourceName: "Reddit/r/snoring",
          sourceUrl: "https://www.reddit.com/r/snoring/comments/abc123/help",
          title: `Need a ${brief.keyword} I can actually tolerate`,
          summary: "Comfort and adherence are repeated user complaints.",
        },
      ],
      risks: ["赛道成熟", "舒适度门槛高"],
      riskEvidence: [
        {
          sourceName: "Sleep Foundation",
          sourceUrl: "https://example.com/snoring-guide",
          title: `Why people keep searching ${brief.keyword}`,
          summary: "The category is established and users have high expectations.",
        },
      ],
      opportunities: ["更轻量、更舒适的结构设计"],
      preliminaryDecision: "watch",
      reasonSummary: "需求真实，但成熟赛道里舒适度会决定转化和复购。",
      nextStep: brief.researchGoal || "继续补抓差评与竞品切口",
      notes: brief.notes || "",
      tags: ["mock-fetch", "mock-llm", "v1.1"],
    });
  };
}

export async function generateScoutCard({
  brief,
  cacheRoot = "scout-cache",
  fetchers = createMockFetchers(),
  llmClient = createMockLlmClient(),
  debugContent = false,
}) {
  const webDocuments = await runFetchWithCache({
    brief,
    sourceType: "web",
    cacheRoot,
    fetcher: () => fetchers.web(brief),
  });

  const redditDocuments = await runFetchWithCache({
    brief,
    sourceType: "reddit",
    cacheRoot,
    fetcher: () => fetchers.reddit(brief),
  });

  const documents = [...webDocuments, ...redditDocuments];
  const contentPreview = debugContent && documents[0]?.content ? documents[0].content.slice(0, 500) : undefined;
  const draft = await summarizeResearchDraft({
    brief,
    documents,
    cacheRoot,
    llmClient,
  });
  const summary = normalizeResearchSummary(draft);
  const card = buildScoutCardFromResearch(summary);

  return { card, brief, documents, draft, summary, contentPreview };
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const inputPath = path.resolve(process.cwd(), args.file);
  const outputPath = path.resolve(process.cwd(), args.out);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`找不到输入文件：${inputPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const brief = parseScoutBrief(raw);
  const fetchers = args.liveWeb
    ? { ...createMockFetchers(), web: createLiveWebFetcher() }
    : createMockFetchers();

  if (args.liveLlm && args.liveGemini) {
    throw new Error("choose only one live LLM adapter: --live-llm or --live-gemini");
  }

  const openAiConfig = args.liveLlm ? getLlmConfigFromEnv() : null;
  if (args.liveLlm && !openAiConfig) {
    throw new Error("live LLM requested but no OPENAI_API_KEY / LLM_API_KEY is configured");
  }

  const geminiConfig = args.liveGemini ? getGeminiConfigFromEnv() : null;
  if (args.liveGemini && !geminiConfig) {
    throw new Error("live Gemini requested but no GEMINI_API_KEY is configured");
  }

  const llmClient = openAiConfig
    ? createOpenAiCompatibleLlmClient(openAiConfig)
    : geminiConfig
      ? createGeminiLlmClient(geminiConfig)
      : createMockLlmClient();
  const { card, documents, summary, contentPreview } = await generateScoutCard({
    brief,
    cacheRoot: args.cacheRoot,
    fetchers,
    llmClient,
    debugContent: args.debugContent,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(card, null, 2)}\n`, "utf8");

  console.log("[scout] brief loaded:", brief.keyword);
  console.log("[scout] fetched docs:", documents.length);
  console.log("[scout] warnings:", summary.warnings.length);
  if (contentPreview) {
    console.log("[scout] content preview:\n" + contentPreview);
  }
  console.log("[scout] card written:", outputPath);
  console.log("[scout] card id:", card.cardId);
}

const entryUrl = process.argv[1] ? new URL(`file://${process.argv[1]}`).href : "";
if (import.meta.url === entryUrl) {
  main().catch((error) => {
    console.error("[scout] failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
