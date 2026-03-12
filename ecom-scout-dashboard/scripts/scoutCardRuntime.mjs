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
    "Card ID": card.cardId,
    "关键词": card.topic.keyword,
    "产品方向": card.topic.productDirection,
    "市场": card.topic.market,
    "平台焦点": (card.topic.platformFocus || []).join(" / "),
    "语言": card.topic.language || "en",
    "需求信号": card.signals.demandSignal,
    "竞争信号": card.signals.competitionSignal,
    "置信度": card.signals.confidence,
    "用户痛点": multiline(card.insights.painPoints),
    "风险提示": multiline(card.insights.risks),
    "微创新机会": multiline(card.insights.opportunities || []),
    "初步判断": card.decision.preliminaryDecision,
    "下一步": card.decision.nextStep,
    "结论摘要": card.decision.reasonSummary,
    "工作流状态": card.workbench.workflowStatus || "待评估",
    "本地备注": card.workbench.notes || "",
    "标签": (card.workbench.tags || []).join(" / "),
    "证据链接": card.evidence.map((item) => `${item.source} | ${item.title} | ${item.url}`).join("\n"),
    "证据摘要": card.evidence.map((item) => `${item.source}: ${item.summary}`).join("\n"),
    "创建时间": Date.parse(card.createdAt),
    "更新时间": Date.parse(card.updatedAt),
    "Schema 版本": card.schemaVersion,
  };
}
