export type CampaignCopy = {
  brandName: string;
  productName: string;
  headline: string;
  bodyCopy: string;
  cta: string;
};

function cleanPhrase(value: string = "", fallback = ""): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text;
}

/** Drop a dangling last fragment so body copy ends on a complete phrase. */
export function completeSentences(text: string): string {
  const trimmed = cleanPhrase(text);
  if (!trimmed) return "";
  if (/[.!?…]"?$/.test(trimmed)) return trimmed;
  const parts = trimmed.split(/(?<=[.!?])\s+/);
  if (parts.length > 1) return parts.slice(0, -1).join(" ");
  return trimmed;
}

export function localCohereCopy(values: Record<string, string>): CampaignCopy {
  const brandName = cleanPhrase(values.brandName || values.productName, "Brand");
  const productName = cleanPhrase(values.productName, brandName);
  return {
    brandName,
    productName,
    headline: cleanPhrase(values.headline || values.cta || productName),
    bodyCopy: completeSentences(
      values.bodyCopy || values.productDescription || values.venue || "",
    ),
    cta: cleanPhrase(values.cta, "Shop now"),
  };
}

export function parseMarketingCopy(text: string): Partial<CampaignCopy> {
  const grab = (label: string) => {
    const match = text.match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
    const value = match?.[1]?.trim();
    return value && value !== "—" ? value : undefined;
  };
  return {
    headline: grab("HEADLINE"),
    bodyCopy: grab("SUBHEAD"),
    cta: grab("CTA"),
  };
}

/** Merge model copy onto user fields without inventing a new brand name. */
export function applyMarketingCopy(
  values: Record<string, string>,
  parsed: Partial<CampaignCopy>,
): Record<string, string> {
  const next = { ...values };
  if (!next.headline && parsed.headline) next.headline = parsed.headline;
  if (!next.bodyCopy && parsed.bodyCopy) next.bodyCopy = parsed.bodyCopy;
  if (!next.cta && parsed.cta) next.cta = parsed.cta;
  return next;
}
