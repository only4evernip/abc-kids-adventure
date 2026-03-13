// Experimental negative-evidence discovery work is documented in:
// docs/decisions/002-v1.2-negative-evidence-discovery.md
export function buildRedditComplaintQueries(keyword: string) {
  const cleanKeyword = keyword.trim();
  return [
    `site:reddit.com "${cleanKeyword}" reddit "don't buy"`,
    `site:reddit.com "${cleanKeyword}" reddit "waste of money"`,
    `site:reddit.com "${cleanKeyword}" reddit "stopped using"`,
    `site:reddit.com "${cleanKeyword}" reddit pain`,
  ];
}

export function normalizeToOldReddit(url: string) {
  return url.replace(/^https?:\/\/(?:www\.)?reddit\.com/i, "https://old.reddit.com");
}

export function extractRedditUrlsFromSearchMarkdown(markdown: string) {
  const matches = markdown.match(/https?:\/\/(?:www\.)?reddit\.com\/r\/[A-Za-z0-9_]+\/comments\/[^\s)]+/g) || [];
  const cleaned = matches
    .map((url) => url.replace(/[)>.,]+$/g, ""))
    .filter((url) => !/[?&](login|signup)=/i.test(url));
  return [...new Set(cleaned)].map(normalizeToOldReddit);
}

export function cleanRedditThread(raw: string, options?: { maxChars?: number }) {
  const maxChars = options?.maxChars ?? 12000;
  let text = raw.replace(/\r\n/g, "\n");

  text = text
    .replace(/^>.*$/gm, "")
    .replace(/^\*.*(?:replying to|hours ago|days ago|minutes ago).*\*$/gim, "")
    .replace(/^\*\s*$/gm, "")
    .replace(/^\[[^\]]+\]:\s*.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trimEnd();
  }

  return text;
}

export async function discoverRedditThreads(
  keyword: string,
  deps: {
    fetchSearchMarkdown: (query: string) => Promise<string>;
    fetchSearchMarkdownFallback?: (query: string) => Promise<string>;
    pickQueries?: (queries: string[]) => string[];
    limit?: number;
    debug?: boolean;
  }
) {
  const queries = buildRedditComplaintQueries(keyword);
  const selectedQueries = deps.pickQueries ? deps.pickQueries(queries) : queries.slice(0, 2);
  const urls: string[] = [];

  if (deps.debug) {
    console.log("[reddit-discovery] selected queries:", selectedQueries);
  }

  for (const query of selectedQueries) {
    let markdown: string;
    let source = "primary";
    try {
      markdown = await deps.fetchSearchMarkdown(query);
    } catch (error) {
      if (!deps.fetchSearchMarkdownFallback) throw error;
      source = "fallback";
      if (deps.debug) {
        console.log("[reddit-discovery] primary search failed:", query, error instanceof Error ? error.message : String(error));
      }
      markdown = await deps.fetchSearchMarkdownFallback(query);
    }

    const extracted = extractRedditUrlsFromSearchMarkdown(markdown);
    if (deps.debug) {
      const rawMatches = markdown.match(/https?:\/\/[^\s)]+/g) || [];
      console.log(`[reddit-discovery] Attempting channel: ${source === "primary" ? "s.jina.ai" : "Google-Fallback"}`);
      console.log(`[reddit-discovery] Search Query: ${query}`);
      console.log(`[reddit-discovery] Raw Response Length: ${markdown.length} bytes`);
      console.log("[reddit-discovery] Regex Match Results (raw):", rawMatches.slice(0, 5));
      console.log("[reddit-discovery] After filtering:", extracted);
      if (source === "fallback") {
        console.log("[reddit-discovery] Fallback preview:", markdown.slice(0, 500));
      }
    }
    urls.push(...extracted);
  }

  const retained = [...new Set(urls)].slice(0, deps.limit ?? 5);
  if (deps.debug) {
    console.log("[reddit-discovery] retained links:", retained);
  }
  return retained;
}
