import { describe, expect, it, vi } from "vitest";
import { fetchDocumentWithJina } from "./scoutWebAdapter";

describe("scoutWebAdapter", () => {
  it("builds the Jina Reader URL and parses markdown into title/content", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe("https://r.jina.ai/http://example.com/review");
      return {
        ok: true,
        status: 200,
        text: async () => "# Best Posture Corrector\n\nThis is the real article body.",
      };
    });

    const result = await fetchDocumentWithJina("http://example.com/review", { fetcher });

    expect(result.url).toBe("http://example.com/review");
    expect(result.title).toBe("Best Posture Corrector");
    expect(result.content).toContain("This is the real article body.");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("throws a clear error when Jina returns non-2xx", async () => {
    const fetcher = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    }));

    await expect(fetchDocumentWithJina("http://example.com/broken", { fetcher })).rejects.toThrow(
      "Jina fetch failed with status: 500"
    );
  });

  it("rethrows network failures loudly", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network timeout");
    });

    await expect(fetchDocumentWithJina("http://example.com/timeout", { fetcher })).rejects.toThrow("network timeout");
  });

  it("rejects empty content even when Jina responds 200", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "   \n\n  ",
    }));

    await expect(fetchDocumentWithJina("http://example.com/empty", { fetcher })).rejects.toThrow(
      "Document content is empty"
    );
  });
});
