import { z } from "zod";

const level4 = z.enum(["低", "中", "高", "极高"]);

const nullableNumber = z.preprocess((value) => {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const normalized = text.replace(/[$,]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}, z.number().nullable());

const textField = z.preprocess((value) => (value == null ? "" : String(value).trim()), z.string());

export const csvRowSchema = z.object({
  调研日期: textField,
  市场: textField,
  平台站点: textField,
  关键词: textField,
  细分方向: textField,
  产品方向: textField,
  ASIN: textField.optional().default(""),
  产品标题: textField.optional().default(""),
  品牌: textField.optional().default(""),
  产品链接: textField.optional().default(""),
  当前价格: nullableNumber,
  当前BSR: nullableNumber,
  当前评分: nullableNumber,
  评论数: nullableNumber,
  "30天评论增长": nullableNumber,
  核心卖点: textField,
  高频差评点: textField,
  高频想要点: textField,
  头部垄断程度: level4.nullable().optional(),
  竞争激烈度: level4.nullable().optional(),
  总体风险等级: level4.nullable().optional(),
  初筛结论: textField,
  下一步动作: textField,
  结论摘要: textField,
});

export type CsvRowInput = z.infer<typeof csvRowSchema>;
