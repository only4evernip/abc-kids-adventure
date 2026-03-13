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
    .replace(/^\[[^\]]+\]:\s*.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trimEnd();
  }

  return text;
}

// TODO: integrate real search for web/reddit result discovery instead of hardcoded seed URLs.
// TODO: add searchRedditComplaints(keyword) using Google/Jina result pages as a low-cost Reddit discovery path.
