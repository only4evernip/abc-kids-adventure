import { describe, expect, it } from "vitest";
import { csvRowSchema, toProductRow } from "../lib/csvSchema";
import type { ProductRecord, ProductRow } from "../types/product";
import { buildRecord, emptyImportStats, mergeImportedRecord, mergeStats, stableProductId, summarizeParseError } from "./score.worker";

function makeRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    researchDate: "2026-03-12",
    market: "US",
    platformSite: "Amazon.com",
    keyword: "portable blender",
    nicheDirection: "kitchen gadgets",
    productDirection: "Portable Blender",
    bigCategory: "Kitchen",
    asin: "B012345678",
    title: "Portable Blender for Smoothies",
    brand: "BlendGo",
    productUrl: "https://www.amazon.com/dp/B012345678?ref=abc",
    currentPrice: 29.99,
    currentBsr: 1200,
    currentRating: 4.3,
    reviewCount: 320,
    reviewGrowth30d: 24,
    coreSellingPoints: "USB-C 充电",
    topComplaintPoints: "电池一般",
    desiredPoints: "更轻",
    headMonopoly: "中",
    competitionLevel: "中",
    overallRisk: "低",
    initialConclusion: "看好",
    nextAction: "联系供应链",
    conclusionSummary: "可继续跟进",
    ...overrides,
  };
}

function makeRecord(overrides: Partial<ProductRecord> = {}): ProductRecord {
  const base = buildRecord(makeRow(), "batch-1");
  return {
    ...base,
    ...overrides,
    rps: overrides.rps ?? base.rps,
  };
}

describe("stableProductId", () => {
  it("ignores URL query string and text case differences for the same product", () => {
    const a = makeRow({
      title: "Portable Blender For Smoothies",
      productUrl: "https://www.amazon.com/dp/B012345678?ref=abc&utm_source=test",
    });
    const b = makeRow({
      title: "portable blender for smoothies",
      productUrl: "https://www.amazon.com/dp/B012345678?ref=xyz",
    });

    expect(stableProductId(a)).toBe(stableProductId(b));
  });

  it("reduces collision risk for no-ASIN products by including normalized URL/title", () => {
    const a = makeRow({ asin: undefined, productUrl: "https://shop.example.com/products/blender-a", title: "Portable Blender A" });
    const b = makeRow({ asin: undefined, productUrl: "https://shop.example.com/products/blender-b", title: "Portable Blender B" });

    expect(stableProductId(a)).not.toBe(stableProductId(b));
  });
});

describe("mergeImportedRecord", () => {
  it("preserves manual workflow status and notes on re-import", () => {
    const existing = makeRecord({
      workflowStatus: "观察池",
      workflowStatusSource: "manual",
      workflowStatusUpdatedAt: "2026-03-12T01:00:00.000Z",
      notes: "人工判断：先观察",
    });
    const incoming = makeRecord({
      workflowStatus: "供应链核价",
      workflowStatusSource: "system",
      notes: "",
      importedAt: "2026-03-12T02:00:00.000Z",
      rps: { ...existing.rps, suggestedStatus: "供应链核价" },
    });

    const result = mergeImportedRecord(existing, incoming);

    expect(result.record.workflowStatus).toBe("观察池");
    expect(result.record.workflowStatusSource).toBe("manual");
    expect(result.record.notes).toBe("人工判断：先观察");
    expect(result.stats.preservedManualStatusCount).toBe(1);
    expect(result.stats.preservedNotesCount).toBe(1);
    expect(result.stats.updatedCount).toBe(1);
  });

  it("lets workflow status follow the latest suggestion when not manually locked", () => {
    const existing = makeRecord({
      workflowStatus: "观察池",
      workflowStatusSource: "system",
      notes: "",
    });
    const incoming = makeRecord({
      importedAt: "2026-03-12T03:00:00.000Z",
      rps: { ...existing.rps, suggestedStatus: "供应链核价" },
    });

    const result = mergeImportedRecord(existing, incoming);

    expect(result.record.workflowStatus).toBe("供应链核价");
    expect(result.record.workflowStatusSource).toBe("system");
    expect(result.record.workflowStatusUpdatedAt).toBe("2026-03-12T03:00:00.000Z");
    expect(result.stats.preservedManualStatusCount).toBe(0);
  });

  it("counts new records as inserted", () => {
    const incoming = makeRecord();
    const result = mergeImportedRecord(undefined, incoming);

    expect(result.record).toEqual(incoming);
    expect(result.stats.insertedCount).toBe(1);
    expect(result.stats.updatedCount).toBe(0);
  });
});

describe("mergeStats", () => {
  it("accumulates import statistics across chunks", () => {
    const total = mergeStats(
      { insertedCount: 1, updatedCount: 2, preservedManualStatusCount: 1, preservedNotesCount: 0 },
      { insertedCount: 3, updatedCount: 4, preservedManualStatusCount: 0, preservedNotesCount: 2 }
    );

    expect(total).toEqual({ insertedCount: 4, updatedCount: 6, preservedManualStatusCount: 1, preservedNotesCount: 2 });
  });

  it("starts from an empty stats object", () => {
    expect(emptyImportStats()).toEqual({
      insertedCount: 0,
      updatedCount: 0,
      preservedManualStatusCount: 0,
      preservedNotesCount: 0,
    });
  });
});

describe("summarizeParseError", () => {
  it("extracts row number, field and preview from zod issues", () => {
    const summary = summarizeParseError(7, { 市场: "", 关键词: "abc" }, [
      { path: ["市场"], message: "Required" },
      { path: ["关键词"], message: "Too short" },
    ]);

    expect(summary.rowNumber).toBe(7);
    expect(summary.field).toBe("市场");
    expect(summary.valuePreview).toBe("");
    expect(summary.reason).toContain("Required");
    expect(summary.reason).toContain("Too short");
  });
});

describe("minimal workflow loop", () => {
  it("preserves manual decisions after re-importing a real CSV-shaped row", () => {
    const rawSample = {
      调研日期: "2026-03-11",
      市场: "美国",
      平台站点: "Amazon US",
      关键词: "anti snoring mouthpiece",
      细分方向: "核心交易词",
      产品方向: "止鼾口腔装置",
      ASIN: "",
      产品标题: "",
      品牌: "",
      产品链接: "",
      当前价格: "",
      当前BSR: "",
      当前评分: "",
      评论数: "",
      "30天评论增长": "",
      核心卖点: "用户目标明确；睡眠场景强；属于问题驱动型购买；可围绕舒适度/适配性/佩戴体验做差异化",
      高频差评点: "佩戴不舒服；下巴疼；功效不明显；适配困难；容易半夜摘掉",
      高频想要点: "更舒适；更容易适配；更稳固；更轻薄；不影响睡眠",
      头部垄断程度: "中",
      竞争激烈度: "高",
      总体风险等级: "高",
      初筛结论: "先观察",
      下一步动作: "挖细分",
      结论摘要: "需求真实存在，但用户对功效和舒适度预期很高；赛道成熟且竞争偏强，直接打大词风险高；建议继续拆分 mandibular advancement device / boil and bite 等细分方向后再判断是否深入",
    };

    const parsed = csvRowSchema.parse(rawSample);
    const row = toProductRow(parsed);
    const firstImport = buildRecord(row, "batch-a");

    const manuallyReviewed: ProductRecord = {
      ...firstImport,
      workflowStatus: "观察池",
      workflowStatusSource: "manual",
      workflowStatusUpdatedAt: "2026-03-12T08:00:00.000Z",
      notes: "先拆 mandibular advancement device 子词，再看是否有舒适度切口",
    };

    const secondImport = buildRecord(row, "batch-b");
    const merged = mergeImportedRecord(manuallyReviewed, secondImport);

    expect(merged.record.id).toBe(firstImport.id);
    expect(merged.record.notes).toBe(manuallyReviewed.notes);
    expect(merged.record.workflowStatus).toBe("观察池");
    expect(merged.record.workflowStatusSource).toBe("manual");
    expect(merged.record.rps.suggestedStatus).toBe(secondImport.rps.suggestedStatus);
    expect(merged.stats.updatedCount).toBe(1);
    expect(merged.stats.preservedManualStatusCount).toBe(1);
    expect(merged.stats.preservedNotesCount).toBe(1);
  });
});
