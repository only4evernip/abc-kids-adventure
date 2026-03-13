// Experimental negative-evidence discovery work is documented in:
// docs/decisions/002-v1.2-negative-evidence-discovery.md
export function extractAmazonAsin(url: string) {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/product-reviews\/([A-Z0-9]{10})/i);
  return match?.[1]?.toUpperCase() || null;
}

export function buildAmazonCriticalReviewsUrl(asin: string) {
  return `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_arp_d_viewopt_sr?filterByStar=critical`;
}

export function cleanAmazonReviewsMarkdown(raw: string, options?: { maxChars?: number }) {
  const maxChars = options?.maxChars ?? 12000;
  let text = raw.replace(/\r\n/g, "\n");

  text = text
    .replace(/^Customer Reviews\s*$/gim, "")
    .replace(/^\d+[\d,]*\s+global ratings\s*$/gim, "")
    .replace(/^Top reviews from.*$/gim, "")
    .replace(/^Reviewed in .*$/gim, "")
    .replace(/^Read more\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trimEnd();
  }

  return text;
}
