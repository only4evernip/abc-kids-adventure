export interface GeminiLlmConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

interface FetchLikeResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
  text?(): Promise<string>;
}

export function getGeminiConfigFromEnv(env: Record<string, string | undefined> = process.env): GeminiLlmConfig | null {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  return {
    apiKey,
    model: env.GEMINI_MODEL || "gemini-2.5-flash",
    baseUrl: env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
  };
}

export function createGeminiLlmClient(
  config: GeminiLlmConfig,
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
    const url = `${config.baseUrl.replace(/\/$/, "")}/models/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const response = await fetcher(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text: "You are a strict scout research summarizer. Return only valid JSON matching ScoutResearchDraft. Never invent evidence URLs. If evidence is weak, stay conservative. Enum fields MUST BE EXACTLY lowercase strings. DO NOT capitalize demandSignal, competitionSignal, or preliminaryDecision.",
            },
          ],
        },
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini request failed with status: ${response.status}`);
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content?.parts?.map((part: any) => part?.text || "").join("").trim();
    if (!content) {
      throw new Error("Gemini response content is empty");
    }

    return content;
  };
}
