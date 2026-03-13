interface FetchLikeResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
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
  const content = raw.trim();
  if (!content) {
    throw new Error("Document content is empty");
  }

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || url;

  return {
    url,
    title,
    content,
  };
}
