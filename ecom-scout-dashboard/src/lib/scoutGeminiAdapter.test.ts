import { describe, expect, it, vi } from "vitest";
import { createGeminiLlmClient, getGeminiConfigFromEnv } from "./scoutGeminiAdapter";

describe("scoutGeminiAdapter", () => {
  it("loads config from env when GEMINI_API_KEY exists", () => {
    const config = getGeminiConfigFromEnv({
      GEMINI_API_KEY: "demo-key",
      GEMINI_MODEL: "gemini-2.5-flash",
    });

    expect(config).toEqual({
      apiKey: "demo-key",
      model: "gemini-2.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    });
  });

  it("returns null when GEMINI_API_KEY is missing", () => {
    expect(getGeminiConfigFromEnv({ GEMINI_MODEL: "gemini-2.5-flash" })).toBeNull();
  });

  it("calls Gemini generateContent with application/json output", async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/models/gemini-2.5-flash:generateContent?key=demo-key");
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body.generationConfig.responseMimeType).toBe("application/json");
      expect(body.contents[0].parts[0].text).toContain("Summarize fetched scout evidence");

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: '{"keyword":"posture corrector","market":"US","productDirection":"comfortable posture corrector","demandSignal":"medium","competitionSignal":"high","demandEvidence":[],"painPoints":[],"painPointEvidence":[],"risks":[],"riskEvidence":[],"preliminaryDecision":"watch","reasonSummary":"ok","nextStep":"continue"}',
                  },
                ],
              },
            },
          ],
        }),
      };
    });

    const client = createGeminiLlmClient(
      { apiKey: "demo-key", model: "gemini-2.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
      { fetcher }
    );

    const result = await client("Summarize fetched scout evidence into ScoutResearchDraft JSON");
    expect(result).toContain('"keyword":"posture corrector"');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails loudly on non-2xx responses", async () => {
    const client = createGeminiLlmClient(
      { apiKey: "demo-key", model: "gemini-2.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
      {
        fetcher: async () => ({
          ok: false,
          status: 429,
          json: async () => ({}),
          text: async () => "rate limited",
        }),
      }
    );

    await expect(client("hello")).rejects.toThrow("Gemini request failed with status: 429");
  });

  it("fails loudly when response text is empty", async () => {
    const client = createGeminiLlmClient(
      { apiKey: "demo-key", model: "gemini-2.5-flash", baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
      {
        fetcher: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: "  " }] } }] }),
        }),
      }
    );

    await expect(client("hello")).rejects.toThrow("Gemini response content is empty");
  });
});
