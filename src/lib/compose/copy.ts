export type CampaignCopy = {
  brandName: string;
  productName: string;
  headline: string;
  bodyCopy: string;
  cta: string;
};

/** Literal user copy wins; the compositor reports text that cannot fit. */
export function localCohereCopy(values: Record<string, string>): CampaignCopy {
  const brandName = values.brandName || values.productName || "Brand";
  const productName = values.productName || brandName;
  return {
    brandName,
    productName,
    headline: values.headline || productName,
    bodyCopy: values.bodyCopy || values.venue || values.productDescription || "",
    cta: values.cta || "Shop now",
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
  if (!next.bodyCopy && !next.venue && parsed.bodyCopy) next.bodyCopy = parsed.bodyCopy;
  if (!next.cta && parsed.cta) next.cta = parsed.cta;
  return next;
}
