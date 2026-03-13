import { describe, expect, it, vi } from "vitest";
import { createOpenAiCompatibleLlmClient, getLlmConfigFromEnv } from "./scoutLlmAdapter";

describe("scoutLlmAdapter", () => {
  it("loads config from env when required variables exist", () => {
    const config = getLlmConfigFromEnv({
      OPENAI_API_KEY: "sk-demo",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "gpt-4o-mini",
    });

    expect(config).toEqual({
      apiKey: "sk-demo",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
    });
  });

  it("returns null config when api key is missing", () => {
    const config = getLlmConfigFromEnv({
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "gpt-4o-mini",
    });

    expect(config).toBeNull();
  });

  it("calls openai-compatible chat completions endpoint and returns content", async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || "{}"));
      expect(body.model).toBe("gpt-4o-mini");
      expect(body.response_format).toEqual({ type: "json_object" });
      expect(body.messages[1].content).toContain("Summarize fetched scout evidence");

      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"keyword":"posture corrector","market":"US","productDirection":"comfortable posture corrector","demandSignal":"medium","competitionSignal":"high","demandEvidence":[],"painPoints":[],"painPointEvidence":[],"risks":[],"riskEvidence":[],"preliminaryDecision":"watch","reasonSummary":"ok","nextStep":"continue"}',
              },
            },
          ],
        }),
      };
    });

    const client = createOpenAiCompatibleLlmClient(
      {
        apiKey: "sk-demo",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
      { fetcher }
    );

    const result = await client("Summarize fetched scout evidence into ScoutResearchDraft JSON");
    expect(result).toContain('"keyword":"posture corrector"');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fails loudly on non-2xx responses", async () => {
    const client = createOpenAiCompatibleLlmClient(
      {
        apiKey: "sk-demo",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
      {
        fetcher: async () => ({
          ok: false,
          status: 401,
          json: async () => ({}),
          text: async () => "unauthorized",
        }),
      }
    );

    await expect(client("hello")).rejects.toThrow("LLM request failed with status: 401");
  });

  it("fails loudly when response content is empty", async () => {
    const client = createOpenAiCompatibleLlmClient(
      {
        apiKey: "sk-demo",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
      {
        fetcher: async () => ({
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "   " } }] }),
        }),
      }
    );

    await expect(client("hello")).rejects.toThrow("LLM response content is empty");
  });
});
