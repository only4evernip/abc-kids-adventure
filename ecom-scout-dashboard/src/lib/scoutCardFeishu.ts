import type { ScoutCard } from "./scoutCard";

export interface FeishuScoutCardRecord {
  "Card ID": string;
  "关键词": string;
  "产品方向": string;
  "市场": string;
  "平台焦点": string;
  "语言": string;
  "需求信号": string;
  "竞争信号": string;
  "置信度": string;
  "用户痛点": string;
  "风险提示": string;
  "微创新机会": string;
  "初步判断": string;
  "下一步": string;
  "结论摘要": string;
  "工作流状态": string;
  "本地备注": string;
  "标签": string;
  "证据链接": string;
  "证据摘要": string;
  "创建时间": number;
  "更新时间": number;
  "Schema 版本": string;
}

function multiline(items?: string[]) {
  return (items || []).map((item) => `- ${item}`).join("\n");
}

export function scoutCardToFeishuRecord(card: ScoutCard): FeishuScoutCardRecord {
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
