import fs from "node:fs";
import path from "node:path";
import type { ScoutBrief } from "./scoutBrief";
import type { FetchedEvidenceDocument } from "./scoutFetch";
import type { ScoutResearchDraft, ScoutResearchDraftEvidence } from "./scoutResearch";

export type ScoutLlmClient = (prompt: string) => Promise<string>;

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

export function getDraftCachePath(brief: ScoutBrief, cacheRoot = "scout-cache") {
  return path.join(cacheRoot, "draft", brief.market.toLowerCase(), normalizeKeyword(brief.keyword), "draft.json");
}

export function readDraftCache(brief: ScoutBrief, cacheRoot = "scout-cache"): ScoutResearchDraft | null {
  const filePath = getDraftCachePath(brief, cacheRoot);
  if (!fs.existsSync(filePath)) return null;
  return parseScoutResearchDraft(fs.readFileSync(filePath, "utf8"), { allowEvidenceWithoutDocuments: true });
}

export function writeDraftCache(brief: ScoutBrief, draft: ScoutResearchDraft, cacheRoot = "scout-cache") {
  const filePath = getDraftCachePath(brief, cacheRoot);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(draft, null, 2));
}

function ensureNonEmptyString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`missing ${field}`);
  }
  return value.trim();
}

function normalizeEnumString(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : value;
}

function ensureStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`invalid ${field}`);
  }
  return value.map((item) => item.trim());
}

function ensureEvidenceArray(value: unknown, field: string): ScoutResearchDraftEvidence[] {
  if (!Array.isArray(value)) {
    throw new Error(`invalid ${field}`);
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error(`invalid ${field}`);
    }

    return {
      sourceName: ensureNonEmptyString((item as Record<string, unknown>).sourceName, `${field}.sourceName`),
      sourceUrl: ensureNonEmptyString((item as Record<string, unknown>).sourceUrl, `${field}.sourceUrl`),
      title: ensureNonEmptyString((item as Record<string, unknown>).title, `${field}.title`),
      summary: ensureNonEmptyString((item as Record<string, unknown>).summary, `${field}.summary`),
    };
  });
}

function clampEvidenceToDocuments(
  evidence: ScoutResearchDraftEvidence[],
  documents: FetchedEvidenceDocument[],
  allowEvidenceWithoutDocuments: boolean
) {
  if (documents.length === 0 && !allowEvidenceWithoutDocuments) return [];
  if (documents.length === 0) return evidence;

  const allowedUrls = new Set(documents.map((doc) => doc.sourceUrl.trim()));
  return evidence.filter((item) => allowedUrls.has(item.sourceUrl.trim()));
}

export function parseScoutResearchDraft(
  raw: string,
  options?: { documents?: FetchedEvidenceDocument[]; allowEvidenceWithoutDocuments?: boolean }
): ScoutResearchDraft {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("LLM draft parse failed: invalid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("LLM draft validation failed: draft must be an object");
  }

  const record = parsed as Record<string, unknown>;
  const documents = options?.documents || [];
  const allowEvidenceWithoutDocuments = options?.allowEvidenceWithoutDocuments ?? false;

  let draft: ScoutResearchDraft;
  try {
    const market = record.market;
    if (market !== "US" && market !== "CA") {
      throw new Error("invalid market");
    }

    const demandSignal = normalizeEnumString(record.demandSignal);
    if (demandSignal !== "high" && demandSignal !== "medium-high" && demandSignal !== "medium" && demandSignal !== "low") {
      throw new Error("invalid demandSignal");
    }

    const competitionSignal = normalizeEnumString(record.competitionSignal);
    if (
      competitionSignal !== "high" &&
      competitionSignal !== "medium-high" &&
      competitionSignal !== "medium" &&
      competitionSignal !== "low"
    ) {
      throw new Error("invalid competitionSignal");
    }

    const preliminaryDecision = normalizeEnumString(record.preliminaryDecision);
    if (preliminaryDecision !== "go-deeper" && preliminaryDecision !== "watch" && preliminaryDecision !== "drop") {
      throw new Error("missing preliminaryDecision");
    }

    draft = {
      keyword: ensureNonEmptyString(record.keyword, "keyword"),
      market,
      productDirection: ensureNonEmptyString(record.productDirection, "productDirection"),
      platformFocus: Array.isArray(record.platformFocus)
        ? record.platformFocus.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim())
        : undefined,
      language: typeof record.language === "string" && record.language.trim() ? record.language.trim() : undefined,
      demandSignal,
      competitionSignal,
      demandEvidence: ensureEvidenceArray(record.demandEvidence, "demandEvidence"),
      painPoints: ensureStringArray(record.painPoints, "painPoints"),
      painPointEvidence: ensureEvidenceArray(record.painPointEvidence, "painPointEvidence"),
      risks: ensureStringArray(record.risks, "risks"),
      riskEvidence: ensureEvidenceArray(record.riskEvidence, "riskEvidence"),
      opportunities: Array.isArray(record.opportunities)
        ? record.opportunities.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim())
        : undefined,
      preliminaryDecision,
      reasonSummary: ensureNonEmptyString(record.reasonSummary, "reasonSummary"),
      nextStep: ensureNonEmptyString(record.nextStep, "nextStep"),
      notes: typeof record.notes === "string" && record.notes.trim() ? record.notes.trim() : undefined,
      tags: Array.isArray(record.tags)
        ? record.tags.filter((item): item is string => typeof item === "string" && !!item.trim()).map((item) => item.trim())
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`LLM draft validation failed: ${message}`);
  }

  return {
    ...draft,
    demandEvidence: clampEvidenceToDocuments(draft.demandEvidence, documents, allowEvidenceWithoutDocuments),
    painPointEvidence: clampEvidenceToDocuments(draft.painPointEvidence, documents, allowEvidenceWithoutDocuments),
    riskEvidence: clampEvidenceToDocuments(draft.riskEvidence, documents, allowEvidenceWithoutDocuments),
  };
}

function buildSummarizerPrompt(brief: ScoutBrief, documents: FetchedEvidenceDocument[]) {
  return JSON.stringify(
    {
      task: "Summarize fetched scout evidence into ScoutResearchDraft JSON",
      brief,
      documents,
    },
    null,
    2
  );
}

export async function summarizeResearchDraft({
  brief,
  documents,
  cacheRoot = "scout-cache",
  llmClient,
}: {
  brief: ScoutBrief;
  documents: FetchedEvidenceDocument[];
  cacheRoot?: string;
  llmClient: ScoutLlmClient;
}) {
  const cached = readDraftCache(brief, cacheRoot);
  if (cached) return cached;

  const raw = await llmClient(buildSummarizerPrompt(brief, documents));

  let draft: ScoutResearchDraft;
  try {
    draft = parseScoutResearchDraft(raw, { documents });
  } catch (error) {
    console.error("Raw LLM Output:", raw);
    throw error;
  }

  writeDraftCache(brief, draft, cacheRoot);
  return draft;
}
