import { describe, expect, it } from "vitest";
import { buildRedditComplaintQueries, cleanRedditThread, discoverRedditThreads, extractRedditUrlsFromSearchMarkdown } from "./redditAdapter";

describe("redditAdapter", () => {
  it("builds poisoned reddit complaint queries from keyword", () => {
    const queries = buildRedditComplaintQueries("posture corrector");

    expect(queries).toEqual(
      expect.arrayContaining([
        'site:reddit.com "posture corrector" reddit "don\'t buy"',
        'site:reddit.com "posture corrector" reddit "waste of money"',
        'site:reddit.com "posture corrector" reddit "stopped using"',
        'site:reddit.com "posture corrector" reddit pain',
      ])
    );
  });

  it("extracts unique reddit thread urls from google-style markdown results", () => {
    const markdown = `# Search Results

[Posture corrector regret thread](https://www.reddit.com/r/Posture/comments/abc123/posture_corrector_regret/)

Some snippet here.

[Waste of money?](https://www.reddit.com/r/BackPain/comments/def456/waste_of_money/)

[Duplicate same URL](https://www.reddit.com/r/Posture/comments/abc123/posture_corrector_regret/)

[Non reddit result](https://www.healthline.com/health/best-posture-corrector)`;

    const urls = extractRedditUrlsFromSearchMarkdown(markdown);

    expect(urls).toEqual([
      "https://www.reddit.com/r/Posture/comments/abc123/posture_corrector_regret/",
      "https://www.reddit.com/r/BackPain/comments/def456/waste_of_money/",
    ]);
  });

  it("cleans reddit thread markdown noise while keeping complaint content", () => {
    const raw = `# Posture corrector regret\n\n> quoted previous reply\n\n*replying to user123 2 hours ago*\n\n*\n\nI stopped using mine after 3 days because it was bulky and uncomfortable.\n\n> another quote\n\nWaste of money for me.`;

    const cleaned = cleanRedditThread(raw);

    expect(cleaned).toContain("I stopped using mine after 3 days because it was bulky and uncomfortable.");
    expect(cleaned).toContain("Waste of money for me.");
    expect(cleaned).not.toContain("> quoted previous reply");
    expect(cleaned).not.toContain("*replying to user123 2 hours ago*");
  });

  it("discovers reddit threads from selected poisoned queries", async () => {
    const urls = await discoverRedditThreads("posture corrector", {
      fetchSearchMarkdown: async (query) => {
        if (query.includes("waste of money")) {
          return `[Waste of money?](https://www.reddit.com/r/BackPain/comments/def456/waste_of_money/)`;
        }
        return `[Stopped using after 3 days](https://www.reddit.com/r/Posture/comments/abc123/posture_corrector_regret/)`;
      },
      pickQueries: (queries) => queries.slice(1, 3),
      limit: 5,
    });

    expect(urls).toEqual([
      "https://www.reddit.com/r/BackPain/comments/def456/waste_of_money/",
      "https://www.reddit.com/r/Posture/comments/abc123/posture_corrector_regret/",
    ]);
  });
});
