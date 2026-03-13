export function buildRedditComplaintQueries(keyword: string) {
  const cleanKeyword = keyword.trim();
  return [
    `site:reddit.com "${cleanKeyword}" reddit "don't buy"`,
    `site:reddit.com "${cleanKeyword}" reddit "waste of money"`,
    `site:reddit.com "${cleanKeyword}" reddit "stopped using"`,
    `site:reddit.com "${cleanKeyword}" reddit pain`,
  ];
}

export function extractRedditUrlsFromSearchMarkdown(markdown: string) {
  const matches = markdown.match(/https?:\/\/(?:www\.)?reddit\.com\/r\/[^\s)]+/g) || [];
  return [...new Set(matches.map((url) => url.replace(/[)>.,]+$/g, "")))];
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
    pickQueries?: (queries: string[]) => string[];
    limit?: number;
  }
) {
  const queries = buildRedditComplaintQueries(keyword);
  const selectedQueries = deps.pickQueries ? deps.pickQueries(queries) : queries.slice(0, 2);
  const urls: string[] = [];

  for (const query of selectedQueries) {
    const markdown = await deps.fetchSearchMarkdown(query);
    urls.push(...extractRedditUrlsFromSearchMarkdown(markdown));
  }

  return [...new Set(urls)].slice(0, deps.limit ?? 5);
}
