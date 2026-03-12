import type { ScoutBrief } from "./scoutBrief";

export interface FetchedEvidenceDocument {
  sourceType: "web" | "reddit" | "amazon";
  sourceName: string;
  sourceUrl: string;
  title?: string;
  fetchedAt: string;
  keyword: string;
  market: "US" | "CA";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface FetchResult {
  documents: FetchedEvidenceDocument[];
  warnings: string[];
}

export interface FetchDependencies {
  web: (brief: ScoutBrief) => Promise<FetchedEvidenceDocument[]>;
  reddit: (brief: ScoutBrief) => Promise<FetchedEvidenceDocument[]>;
}

export interface WebSearchResult {
  url: string;
  title?: string;
}

export interface WebFetchDeps {
  searchWeb: (brief: ScoutBrief) => Promise<WebSearchResult[]>;
  fetchDocument: (url: string) => Promise<{ url: string; title?: string; content: string }>;
}

export interface RedditSearchResult {
  url: string;
  title?: string;
  content?: string;
  subreddit?: string;
}

export interface RedditFetchResult extends FetchResult {}

export interface RedditFetchDeps {
  searchReddit: (brief: ScoutBrief) => Promise<RedditSearchResult[]>;
}

export async function fetchWebEvidence(brief: ScoutBrief, deps: WebFetchDeps): Promise<FetchedEvidenceDocument[]> {
  const results = await deps.searchWeb(brief);
  if (results.length === 0) return [];

  const documents: FetchedEvidenceDocument[] = [];
  for (const item of results) {
    const doc = await deps.fetchDocument(item.url);
    if (!doc.content?.trim()) continue;
    documents.push({
      sourceType: "web",
      sourceName: new URL(doc.url).hostname,
      sourceUrl: doc.url,
      title: doc.title || item.title || doc.url,
      fetchedAt: new Date().toISOString(),
      keyword: brief.keyword,
      market: brief.market,
      content: doc.content,
    });
  }

  return documents;
}

export async function fetchRedditEvidence(brief: ScoutBrief, deps: RedditFetchDeps): Promise<RedditFetchResult> {
  try {
    const results = await deps.searchReddit(brief);
    const documents: FetchedEvidenceDocument[] = [];

    for (const item of results) {
      if (!item.url?.trim() || !item.content?.trim()) {
        return { documents: [], warnings: ["Reddit fetch returned empty or invalid items"] };
      }

      documents.push({
        sourceType: "reddit",
        sourceName: item.subreddit ? `Reddit/r/${item.subreddit}` : "Reddit",
        sourceUrl: item.url,
        title: item.title || item.url,
        fetchedAt: new Date().toISOString(),
        keyword: brief.keyword,
        market: brief.market,
        content: item.content,
      });
    }

    return { documents, warnings: [] };
  } catch (error) {
    return {
      documents: [],
      warnings: [`Reddit fetch failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

export async function fetchResearchEvidence(brief: ScoutBrief, deps: FetchDependencies): Promise<FetchResult> {
  const documents: FetchedEvidenceDocument[] = [];
  const warnings: string[] = [];

  try {
    documents.push(...(await deps.web(brief)));
  } catch (error) {
    warnings.push(`Web fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    documents.push(...(await deps.reddit(brief)));
  } catch (error) {
    warnings.push(`Reddit fetch failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { documents, warnings };
}
