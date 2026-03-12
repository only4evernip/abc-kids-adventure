import fs from "node:fs";
import path from "node:path";
import type { ScoutBrief } from "./scoutBrief";
import type { FetchedEvidenceDocument } from "./scoutFetch";

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function getFetchCachePath(
  brief: ScoutBrief,
  sourceType: FetchedEvidenceDocument["sourceType"],
  cacheRoot = "scout-cache"
) {
  return path.join(cacheRoot, "fetch", brief.market.toLowerCase(), normalizeKeyword(brief.keyword), `${sourceType}.json`);
}

export function readFetchCache(
  brief: ScoutBrief,
  sourceType: FetchedEvidenceDocument["sourceType"],
  cacheRoot = "scout-cache"
): FetchedEvidenceDocument[] | null {
  const filePath = getFetchCachePath(brief, sourceType, cacheRoot);
  if (!fs.existsSync(filePath)) return null;
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return Array.isArray(parsed?.documents) ? parsed.documents : null;
}

export function writeFetchCache(
  brief: ScoutBrief,
  sourceType: FetchedEvidenceDocument["sourceType"],
  documents: FetchedEvidenceDocument[],
  cacheRoot = "scout-cache"
) {
  const filePath = getFetchCachePath(brief, sourceType, cacheRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        version: 1,
        sourceType,
        briefKey: `${brief.market.toLowerCase()}|${normalizeKeyword(brief.keyword)}`,
        documents,
      },
      null,
      2
    )
  );
}

export async function runFetchWithCache({
  brief,
  sourceType,
  cacheRoot = "scout-cache",
  fetcher,
}: {
  brief: ScoutBrief;
  sourceType: FetchedEvidenceDocument["sourceType"];
  cacheRoot?: string;
  fetcher: () => Promise<FetchedEvidenceDocument[]>;
}) {
  const cached = readFetchCache(brief, sourceType, cacheRoot);
  if (cached) return cached;

  const documents = await fetcher();
  writeFetchCache(brief, sourceType, documents, cacheRoot);
  return documents;
}
