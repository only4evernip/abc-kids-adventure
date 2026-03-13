interface FetchLikeResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export function cleanJinaMarkdown(raw: string, options?: { maxChars?: number }) {
  const maxChars = options?.maxChars ?? 15000;
  let text = raw.replace(/\r\n/g, "\n");

  const marker = /(?:^|\n)Markdown Content:\n?/m;
  const markerMatch = text.match(marker);
  if (markerMatch && markerMatch.index !== undefined) {
    text = text.slice(markerMatch.index + markerMatch[0].length);
  }

  text = text
    .replace(/^Title:\s.*$/gm, "")
    .replace(/^URL Source:\s.*$/gm, "")
    .replace(/^Published Time:\s.*$/gm, "")
    .replace(/^Warning:\s.*$/gm, "")
    .replace(/^![^\n]*$/gm, "")
    .replace(/^\[[^\]]*\]\([^\)]+\)\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trimEnd();
  }

  return text;
}

export async function fetchDocumentWithJina(
  url: string,
  deps?: {
    fetcher?: (url: string) => Promise<FetchLikeResponse>;
  }
) {
  const fetcher = deps?.fetcher || (async (targetUrl: string) => {
    const response = await fetch(targetUrl);
    return {
      ok: response.ok,
      status: response.status,
      text: () => response.text(),
    };
  });

  const jinaUrl = `https://r.jina.ai/${url}`;
  const response = await fetcher(jinaUrl);

  if (!response.ok) {
    throw new Error(`Jina fetch failed with status: ${response.status}`);
  }

  const raw = await response.text();
  const content = cleanJinaMarkdown(raw);
  if (!content) {
    throw new Error("Document content is empty");
  }

  const titleMatch = content.match(/^(?:#\s+(.+)|(.+)\n=+)/m);
  const title = (titleMatch?.[1] || titleMatch?.[2] || url).trim();

  return {
    url,
    title,
    content,
  };
}
