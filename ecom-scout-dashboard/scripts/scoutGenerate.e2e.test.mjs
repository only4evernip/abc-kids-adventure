import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { main } from "./scoutGenerate.mjs";

describe("scoutGenerate CLI e2e", () => {
  it("writes a valid scout-card.v1 json file through the CLI entry", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scout-generate-e2e-"));
    const briefPath = path.join(tempDir, "brief.json");
    const outPath = path.join(tempDir, "out.json");
    const cacheRoot = path.join(tempDir, "cache");

    fs.writeFileSync(
      briefPath,
      JSON.stringify(
        {
          version: 1,
          keyword: "posture corrector",
          market: "US",
          language: "en",
          platformFocus: ["Amazon US", "Reddit"],
          researchGoal: "需求验证 + 风险排查",
          notes: "优先看办公场景",
        },
        null,
        2
      )
    );

    await main(["--file", briefPath, "--out", outPath, "--cache-root", cacheRoot]);

    expect(fs.existsSync(outPath)).toBe(true);
    const card = JSON.parse(fs.readFileSync(outPath, "utf8"));

    expect(card.schemaVersion).toBe("scout-card.v1");
    expect(card.cardId).toMatch(/^scout_/);
    expect(["go-deeper", "watch", "drop"]).toContain(card.decision?.preliminaryDecision);
    expect(Array.isArray(card.evidence)).toBe(true);
    expect(card.evidence.length).toBeGreaterThan(0);
  });

  it("keeps conservative downgrade alive at e2e level when evidence is incomplete", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scout-generate-degrade-e2e-"));
    const briefPath = path.join(tempDir, "brief.json");
    const outPath = path.join(tempDir, "out.json");
    const cacheRoot = path.join(tempDir, "cache");

    fs.writeFileSync(
      briefPath,
      JSON.stringify(
        {
          version: 1,
          keyword: "anti snoring device",
          market: "US",
          language: "en",
          platformFocus: ["Amazon US", "Reddit"],
          researchGoal: "需求验证 + 风险排查",
          notes: "验证保守降级",
        },
        null,
        2
      )
    );

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const fetchCachePath = path.join(cacheRoot, "fetch", "us", "anti-snoring-device");
      fs.mkdirSync(fetchCachePath, { recursive: true });

      fs.writeFileSync(
        path.join(fetchCachePath, "web.json"),
        JSON.stringify(
          {
            version: 1,
            documents: [
              {
                sourceType: "web",
                sourceName: "Example Blog",
                sourceUrl: "https://example.com/snoring-demand",
                title: "Demand exists",
                fetchedAt: "2026-03-13T00:00:00.000Z",
                keyword: "anti snoring device",
                market: "US",
                content: "People are actively searching for solutions.",
              },
            ],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(fetchCachePath, "reddit.json"),
        JSON.stringify(
          {
            version: 1,
            documents: [],
          },
          null,
          2
        )
      );

      const draftCachePath = path.join(cacheRoot, "draft", "us", "anti-snoring-device");
      fs.mkdirSync(draftCachePath, { recursive: true });
      fs.writeFileSync(
        path.join(draftCachePath, "draft.json"),
        JSON.stringify(
          {
            keyword: "anti snoring device",
            market: "US",
            productDirection: "comfortable anti-snoring mouthpiece",
            platformFocus: ["Amazon US", "Reddit"],
            language: "en",
            demandSignal: "high",
            competitionSignal: "medium",
            demandEvidence: [
              {
                sourceName: "Example Blog",
                sourceUrl: "https://example.com/snoring-demand",
                title: "Demand exists",
                summary: "Users are actively looking for solutions.",
              },
            ],
            painPoints: ["佩戴不舒服"],
            painPointEvidence: [],
            risks: ["舒适度门槛高"],
            riskEvidence: [],
            opportunities: ["更轻量设计"],
            preliminaryDecision: "go-deeper",
            reasonSummary: "LLM 想激进一点，但证据并不完整。",
            nextStep: "继续补证据",
            notes: "故意制造残缺证据",
            tags: ["degrade-check"],
          },
          null,
          2
        )
      );

      await main(["--file", briefPath, "--out", outPath, "--cache-root", cacheRoot]);
    } finally {
      process.chdir(originalCwd);
    }

    const card = JSON.parse(fs.readFileSync(outPath, "utf8"));
    expect(card.schemaVersion).toBe("scout-card.v1");
    expect(card.decision.preliminaryDecision).toBe("watch");
    expect(card.signals.confidence).toBe("low");
    expect(card.evidence).toHaveLength(1);
    expect(card.decision.reasonSummary).toContain("证据不足");
  });
});
