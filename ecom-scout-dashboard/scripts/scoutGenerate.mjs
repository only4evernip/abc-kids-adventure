import fs from "node:fs";
import path from "node:path";

function hashString(input) {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function normalizeText(value = "") {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseArgs(argv) {
  const args = { file: "./scout-brief.example.json", out: "/tmp/scout-card.json" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.file = argv[i + 1];
    if (arg === "--out") args.out = argv[i + 1];
  }
  return args;
}

export function parseScoutBrief(input) {
  const brief = input;
  if (!brief || typeof brief !== "object") throw new Error("无效的侦察 brief：输入必须是对象");
  if (!brief.keyword || !String(brief.keyword).trim()) throw new Error("无效的侦察 brief：缺少 keyword");
  if (brief.market !== "US" && brief.market !== "CA") throw new Error("无效的侦察 brief：market 仅支持 US / CA");

  return {
    version: 1,
    keyword: String(brief.keyword).trim(),
    market: brief.market,
    language: String(brief.language || "en").trim() || "en",
    platformFocus: Array.isArray(brief.platformFocus) ? brief.platformFocus : [],
    researchGoal: brief.researchGoal ? String(brief.researchGoal).trim() : undefined,
    notes: brief.notes ? String(brief.notes).trim() : undefined,
  };
}

const SOURCE_RULES = [
  { match: /reddit\.com/i, type: "reddit", allowed: true },
  { match: /amazon\./i, type: "review", allowed: true },
  { match: /google\./i, type: "article", allowed: true },
  { match: /forum/i, type: "forum", allowed: true },
  { match: /blog|wirecutter|medium|substack|nytimes/i, type: "article", allowed: true },
  { match: /tiktok\.com/i, type: "other", allowed: false },
  { match: /xiaohongshu\.com/i, type: "other", allowed: false },
];

function toEvidenceItem(item, fallbackType) {
  if (!item.sourceName?.trim() || !item.sourceUrl?.trim()) {
    throw new Error("无效的 research evidence：缺少 sourceName 或 sourceUrl");
  }

  const rule = SOURCE_RULES.find((entry) => entry.match.test(item.sourceUrl));
  if (rule && !rule.allowed) {
    return { dropped: `已过滤非白名单来源：${item.sourceName}` };
  }

  return {
    type: rule?.type || fallbackType,
    source: item.sourceName.trim(),
    title: item.title.trim(),
    url: item.sourceUrl.trim(),
    summary: item.summary.trim(),
  };
}

function normalizeEvidenceList(items, fallbackType) {
  const kept = [];
  const warnings = [];
  for (const item of items) {
    const normalized = toEvidenceItem(item, fallbackType);
    if (normalized.dropped) warnings.push(normalized.dropped);
    else kept.push(normalized);
  }
  return { kept, warnings };
}

export function normalizeResearchSummary(draft) {
  const demand = normalizeEvidenceList(draft.demandEvidence, "article");
  const pain = normalizeEvidenceList(draft.painPointEvidence, "review");
  const risk = normalizeEvidenceList(draft.riskEvidence, "article");

  return {
    keyword: draft.keyword,
    market: draft.market,
    productDirection: draft.productDirection,
    demandSignal: draft.demandSignal,
    competitionSignal: draft.competitionSignal,
    demandEvidence: demand.kept,
    painPoints: draft.painPoints,
    painPointEvidence: pain.kept,
    risks: draft.risks,
    riskEvidence: risk.kept,
    warnings: [...demand.warnings, ...pain.warnings, ...risk.warnings],
  };
}

export function buildMockResearchDraft(brief) {
  return {
    keyword: brief.keyword,
    market: brief.market,
    productDirection: brief.keyword,
    platformFocus: brief.platformFocus || [],
    language: brief.language || "en",
    demandSignal: "medium-high",
    competitionSignal: "medium",
    demandEvidence: [
      {
        sourceName: "Reddit",
        sourceUrl: "https://www.reddit.com/r/Entrepreneur/comments/example",
        title: `People actively discuss ${brief.keyword}`,
        summary: "Users are actively searching for and discussing this type of product.",
      },
    ],
    painPoints: ["现有产品舒适度一般", "长期使用体验不稳定"],
    painPointEvidence: [
      {
        sourceName: "Amazon",
        sourceUrl: "https://www.amazon.com/review/example",
        title: "Comfort complaints are frequent",
        summary: "Comfort and long-term wear issues appear repeatedly in reviews.",
      },
    ],
    risks: ["赛道已有不少成熟竞品，需要差异化切口"],
    riskEvidence: [
      {
        sourceName: "Wirecutter",
        sourceUrl: "https://www.nytimes.com/wirecutter/example",
        title: "Category already has established products",
        summary: "Established products exist, so positioning must be differentiated.",
      },
    ],
    opportunities: ["从更舒适、更轻量或更清晰场景切入"],
    preliminaryDecision: "watch",
    reasonSummary: "需求存在，但需要进一步验证切口强度与差异化空间。",
    nextStep: brief.researchGoal || "继续补充需求和竞品证据",
    notes: brief.notes || "",
    tags: ["侦察虾", "mock-research"],
  };
}

export function buildScoutCardFromResearch(summary, meta = {}) {
  const hasDemandEvidence = summary.demandEvidence.length > 0;
  const hasPainEvidence = summary.painPoints.length > 0 && summary.painPointEvidence.length > 0;
  const hasRiskEvidence = summary.risks.length > 0 && summary.riskEvidence.length > 0;
  const evidenceComplete = hasDemandEvidence && hasPainEvidence && hasRiskEvidence;
  const confidence = evidenceComplete ? "high" : "low";
  const preliminaryDecision = evidenceComplete ? meta.preliminaryDecision || "watch" : "watch";
  const now = new Date().toISOString();

  const card = {
    schemaVersion: "scout-card.v1",
    cardId: "pending",
    createdAt: now,
    updatedAt: now,
    topic: {
      keyword: summary.keyword,
      productDirection: summary.productDirection,
      market: summary.market,
      platformFocus: meta.platformFocus || [],
      language: meta.language || "en",
    },
    signals: {
      demandSignal: summary.demandSignal,
      competitionSignal: summary.competitionSignal,
      confidence,
    },
    insights: {
      painPoints: summary.painPoints,
      risks: summary.risks,
      opportunities: meta.opportunities || [],
    },
    decision: {
      preliminaryDecision,
      nextStep: meta.nextStep || "继续补充需求和竞品证据",
      reasonSummary: evidenceComplete
        ? meta.reasonSummary || "需求存在，但需要进一步验证切口强度与差异化空间。"
        : `${meta.reasonSummary || "需求存在，但需要进一步验证切口强度与差异化空间。"}（证据不足，先进入 watch）`,
    },
    evidence: [...summary.demandEvidence, ...summary.painPointEvidence, ...summary.riskEvidence],
    workbench: {
      workflowStatus: preliminaryDecision === "go-deeper" ? "观察池" : preliminaryDecision === "drop" ? "淘汰库" : "待评估",
      notes: meta.notes || "",
      tags: meta.tags || [],
    },
  };

  return {
    ...card,
    cardId: `scout_${hashString([normalizeText(card.topic.market), normalizeText(card.topic.keyword), normalizeText(card.topic.productDirection)].join("|"))}`,
  };
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
  const draft = buildMockResearchDraft(brief);
  const summary = normalizeResearchSummary(draft);
  const card = buildScoutCardFromResearch(summary, {
    platformFocus: brief.platformFocus,
    language: brief.language,
    opportunities: draft.opportunities,
    preliminaryDecision: draft.preliminaryDecision,
    reasonSummary: draft.reasonSummary,
    nextStep: draft.nextStep,
    notes: brief.notes,
    tags: draft.tags,
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(card, null, 2)}\n`, "utf8");

  console.log("[scout] brief loaded:", brief.keyword);
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
