import { describe, expect, it, vi } from "vitest";
import { cleanJinaMarkdown, fetchDocumentWithJina } from "./scoutWebAdapter";

describe("scoutWebAdapter", () => {
  it("cuts away Jina header metadata and starts from the real article body", () => {
    const raw = `Title: The 4 Best Posture Correctors and How to Choose

URL Source: https://www.healthline.com/health/best-posture-corrector

Published Time: 2020-04-08T11:45:00Z

Markdown Content:
# 4 Best Posture Correctors

This is the real article body.`;

    const cleaned = cleanJinaMarkdown(raw);

    expect(cleaned).not.toContain("Title:");
    expect(cleaned).not.toContain("URL Source:");
    expect(cleaned).not.toContain("Markdown Content:");
    expect(cleaned.startsWith("# 4 Best Posture Correctors")).toBe(true);
  });

  it("top-cuts noisy prelude before the first real heading", () => {
    const raw = `Home > Health > Posture
* Men
* Women

# 4 Best Posture Correctors

Real body starts here.`;

    const cleaned = cleanJinaMarkdown(raw);

    expect(cleaned.startsWith("# 4 Best Posture Correctors")).toBe(true);
    expect(cleaned).not.toContain("Home > Health > Posture");
    expect(cleaned).not.toContain("* Men");
  });

  it("bottom-cuts tail clutter once footer markers appear", () => {
    const raw = `# 4 Best Posture Correctors

Useful article body.

## Related Stories
1. Article A
2. Article B`;

    const cleaned = cleanJinaMarkdown(raw);

    expect(cleaned).toContain("Useful article body.");
    expect(cleaned).not.toContain("Related Stories");
    expect(cleaned).not.toContain("Article A");
  });

  it("falls back safely when no heading or footer marker exists", () => {
    const raw = `Plain text page with no markdown heading.

![Hero](https://example.com/a.png)

Still useful body.`;

    const cleaned = cleanJinaMarkdown(raw, { maxChars: 500 });

    expect(cleaned).toContain("Plain text page with no markdown heading.");
    expect(cleaned).toContain("Still useful body.");
    expect(cleaned).not.toContain("![Hero]");
  });

  it("strips image markdown, compresses excessive blank lines, and removes link-only clutter lines", () => {
    const raw = `# Article Title

![Hero](https://example.com/image.png)



[](https://example.com)

Some useful paragraph.



Another useful paragraph.`;

    const cleaned = cleanJinaMarkdown(raw);

    expect(cleaned).not.toContain("![Hero]");
    expect(cleaned).not.toContain("[](https://example.com)");
    expect(cleaned).toContain("Some useful paragraph.");
    expect(cleaned).toContain("Another useful paragraph.");
    expect(cleaned).not.toContain("\n\n\n");
  });

  it("hard truncates extremely long content to the failsafe limit", () => {
    const longBody = `# Article Title\n\n${"A".repeat(25000)}`;
    const cleaned = cleanJinaMarkdown(longBody, { maxChars: 15000 });

    expect(cleaned.length).toBeLessThanOrEqual(15000);
    expect(cleaned.startsWith("# Article Title")).toBe(true);
  });

  it("builds the Jina Reader URL and parses markdown into title/content", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe("https://r.jina.ai/http://example.com/review");
      return {
        ok: true,
        status: 200,
        text: async () => "Title: Best Posture Corrector\n\nURL Source: http://example.com/review\n\nMarkdown Content:\n# Best Posture Corrector\n\nThis is the real article body.",
      };
    });

    const result = await fetchDocumentWithJina("http://example.com/review", { fetcher });

    expect(result.url).toBe("http://example.com/review");
    expect(result.title).toBe("Best Posture Corrector");
    expect(result.content).toContain("This is the real article body.");
    expect(result.content).not.toContain("URL Source:");
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
