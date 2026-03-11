import { z } from "zod";
import type { Level4, ProductRow } from "../types/product";

const LEVEL4_VALUES = ["低", "中", "高", "极高"] as const;

function normalizeText(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function normalizeNullableNumber(value: unknown) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.replace(/[$,，\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLevel4(value: unknown): Level4 | null {
  const text = normalizeText(value).replace(/\s+/g, "");
  if (!text) return null;
  return (LEVEL4_VALUES.includes(text as Level4) ? text : null) as Level4 | null;
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  if (!text) return "";

  const dashLike = text.replace(/[./]/g, "-");
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dashLike)) {
    const [y, m, d] = dashLike.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (!Number.isNaN(date.getTime())) {
      return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
    }
  }

  // Excel serial date fallback
  const maybeSerial = Number(text);
  if (Number.isFinite(maybeSerial) && maybeSerial > 20000 && maybeSerial < 80000) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + maybeSerial * 86400000);
    return date.toISOString().slice(0, 10);
  }

  return "";
}

export const csvRowSchema = z.object({
  调研日期: z.preprocess(normalizeDate, z.string()),
  市场: z.preprocess(normalizeText, z.string()),
  平台站点: z.preprocess(normalizeText, z.string()),
  关键词: z.preprocess(normalizeText, z.string()),
  细分方向: z.preprocess(normalizeText, z.string()),
  产品方向: z.preprocess(normalizeText, z.string()),
  大类目: z.preprocess(normalizeText, z.string()).optional().default(""),
  ASIN: z.preprocess(normalizeText, z.string()).optional().default(""),
  产品标题: z.preprocess(normalizeText, z.string()).optional().default(""),
  品牌: z.preprocess(normalizeText, z.string()).optional().default(""),
  产品链接: z.preprocess(normalizeText, z.string()).optional().default(""),
  当前价格: z.preprocess(normalizeNullableNumber, z.number().nullable()),
  当前BSR: z.preprocess(normalizeNullableNumber, z.number().nullable()),
  当前评分: z.preprocess(normalizeNullableNumber, z.number().nullable()),
  评论数: z.preprocess(normalizeNullableNumber, z.number().nullable()),
  "30天评论增长": z.preprocess(normalizeNullableNumber, z.number().nullable()),
  核心卖点: z.preprocess(normalizeText, z.string()),
  高频差评点: z.preprocess(normalizeText, z.string()),
  高频想要点: z.preprocess(normalizeText, z.string()),
  头部垄断程度: z.preprocess(normalizeLevel4, z.enum(LEVEL4_VALUES).nullable()),
  竞争激烈度: z.preprocess(normalizeLevel4, z.enum(LEVEL4_VALUES).nullable()),
  总体风险等级: z.preprocess(normalizeLevel4, z.enum(LEVEL4_VALUES).nullable()),
  初筛结论: z.preprocess(normalizeText, z.string()),
  下一步动作: z.preprocess(normalizeText, z.string()),
  结论摘要: z.preprocess(normalizeText, z.string()),
});

export type CsvRowInput = z.infer<typeof csvRowSchema>;

export function toProductRow(input: CsvRowInput): ProductRow {
  return {
    researchDate: input.调研日期,
    market: input.市场,
    platformSite: input.平台站点,
    keyword: input.关键词,
    nicheDirection: input.细分方向,
    productDirection: input.产品方向,
    bigCategory: input.大类目 || undefined,
    asin: input.ASIN || undefined,
    title: input.产品标题 || undefined,
    brand: input.品牌 || undefined,
    productUrl: input.产品链接 || undefined,
    currentPrice: input.当前价格,
    currentBsr: input.当前BSR,
    currentRating: input.当前评分,
    reviewCount: input.评论数,
    reviewGrowth30d: input["30天评论增长"],
    coreSellingPoints: input.核心卖点,
    topComplaintPoints: input.高频差评点,
    desiredPoints: input.高频想要点,
    headMonopoly: input.头部垄断程度,
    competitionLevel: input.竞争激烈度,
    overallRisk: input.总体风险等级,
    initialConclusion: input.初筛结论,
    nextAction: input.下一步动作,
    conclusionSummary: input.结论摘要,
  };
}
