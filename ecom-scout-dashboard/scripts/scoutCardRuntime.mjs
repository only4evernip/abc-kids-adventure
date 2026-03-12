export function parseScoutCard(input) {
  const card = input;
  if (!card || card.schemaVersion !== "scout-card.v1") {
    throw new Error("无效的侦察卡：schemaVersion 不正确");
  }
  if (!card.cardId || !card.topic?.keyword || !card.topic?.productDirection || !card.topic?.market) {
    throw new Error("无效的侦察卡：缺少核心 topic 字段");
  }
  if (!Array.isArray(card.insights?.painPoints) || !Array.isArray(card.insights?.risks) || !Array.isArray(card.evidence)) {
    throw new Error("无效的侦察卡：insights/evidence 结构错误");
  }
  return card;
}

function multiline(items = []) {
  return items.map((item) => `- ${item}`).join("\n");
}

export function scoutCardToFeishuRecord(card) {
  return {
    cardId: card.cardId,
    keyword: card.topic.keyword,
    productDirection: card.topic.productDirection,
    market: card.topic.market,
    platformFocus: (card.topic.platformFocus || []).join(" / "),
    language: card.topic.language || "en",
    demandSignal: card.signals.demandSignal,
    competitionSignal: card.signals.competitionSignal,
    confidence: card.signals.confidence,
    painPoints: multiline(card.insights.painPoints),
    risks: multiline(card.insights.risks),
    opportunities: multiline(card.insights.opportunities || []),
    preliminaryDecision: card.decision.preliminaryDecision,
    nextStep: card.decision.nextStep,
    reasonSummary: card.decision.reasonSummary,
    workflowStatus: card.workbench.workflowStatus || "待评估",
    notes: card.workbench.notes || "",
    tags: (card.workbench.tags || []).join(" / "),
    evidenceLinks: card.evidence.map((item) => `${item.source} | ${item.title} | ${item.url}`).join("\n"),
    evidenceSummary: card.evidence.map((item) => `${item.source}: ${item.summary}`).join("\n"),
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    schemaVersion: card.schemaVersion,
  };
}
