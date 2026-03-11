import { describe, expect, it } from "vitest";
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
