export interface OpenAiCompatibleLlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

interface FetchLikeResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text?(): Promise<string>;
}

export function getLlmConfigFromEnv(env: Record<string, string | undefined> = process.env): OpenAiCompatibleLlmConfig | null {
  const apiKey = env.OPENAI_API_KEY || env.LLM_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    baseUrl: env.OPENAI_BASE_URL || env.LLM_BASE_URL || "https://api.openai.com/v1",
    model: env.OPENAI_MODEL || env.LLM_MODEL || "gpt-4o-mini",
  };
}

export function createOpenAiCompatibleLlmClient(
  config: OpenAiCompatibleLlmConfig,
  deps?: {
    fetcher?: (url: string, init?: RequestInit) => Promise<FetchLikeResponse>;
  }
) {
  const fetcher =
    deps?.fetcher ||
    (async (url: string, init?: RequestInit) => {
      const response = await fetch(url, init);
      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json(),
        text: () => response.text(),
      };
    });

  return async (prompt: string) => {
    const response = await fetcher(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a strict scout research summarizer. Return only valid JSON matching ScoutResearchDraft. Never invent evidence URLs. If evidence is weak, stay conservative.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("LLM response content is empty");
    }

    return content.trim();
  };
}
