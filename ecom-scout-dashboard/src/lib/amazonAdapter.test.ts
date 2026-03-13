import { describe, expect, it } from "vitest";
import { buildAmazonCriticalReviewsUrl, cleanAmazonReviewsMarkdown, extractAmazonAsin } from "./amazonAdapter";

describe("amazonAdapter", () => {
  it("extracts asin from amazon product url", () => {
    expect(extractAmazonAsin("https://www.amazon.com/dp/B07DKHTKP3")).toBe("B07DKHTKP3");
    expect(extractAmazonAsin("https://www.amazon.com/Posture-Corrector-Men-Women-Truweo/dp/B07DKHTKP3/")).toBe(
      "B07DKHTKP3"
    );
  });

  it("builds critical reviews url from asin", () => {
    expect(buildAmazonCriticalReviewsUrl("B07DKHTKP3")).toBe(
      "https://www.amazon.com/product-reviews/B07DKHTKP3/ref=cm_cr_arp_d_viewopt_sr?filterByStar=critical"
    );
  });

  it("cleans amazon review markdown noise while keeping complaint text", () => {
    const raw = `# Reviews\n\nCustomer Reviews\n\n5 global ratings\n\nTop reviews from the United States\n\nReviewed in the United States on Jan 1, 2025\n\nTerrible fit\n\nIt dug into my armpits and I stopped using it after two days.\n\nRead more\n\nReviewed in the United States on Jan 2, 2025\n\nBroke quickly\n\nThe strap snapped in less than a week.`;

    const cleaned = cleanAmazonReviewsMarkdown(raw);

    expect(cleaned).toContain("Terrible fit");
    expect(cleaned).toContain("It dug into my armpits and I stopped using it after two days.");
    expect(cleaned).toContain("Broke quickly");
    expect(cleaned).toContain("The strap snapped in less than a week.");
    expect(cleaned).not.toContain("5 global ratings");
    expect(cleaned).not.toContain("Read more");
  });
});
