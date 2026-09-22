import type { Image2Wrapper } from "@/lib/wrappers/catalog";
import { IMAGE2_WRAPPERS } from "@/lib/wrappers/catalog";

/** Map marketing desk categories onto Image-2 layout chrome. */
const CATEGORY_LAYOUT: Record<string, Image2Wrapper["layout"]> = {
  ads: "poster-cta",
  poster: "event-stack",
};

/** Clean product/listing images and real video must not acquire layout chrome. */
export function workflowNeedsComposition(category: string) {
  return category in CATEGORY_LAYOUT;
}

export function layoutForWorkflowCategory(
  category: string,
): Image2Wrapper["layout"] {
  return CATEGORY_LAYOUT[category] ?? "poster-cta";
}

/** Synthetic wrapper used when composing marketing / dream campaign wraps. */
export function wrapperForLayout(
  layout: Image2Wrapper["layout"],
  name: string,
  brandSample: string,
  tagline: string,
): Image2Wrapper {
  const base =
    IMAGE2_WRAPPERS.find((w) => w.layout === layout) ?? IMAGE2_WRAPPERS[0];
  return {
    ...base,
    slug: base.slug,
    name,
    brandSample,
    tagline,
    layout,
  };
}
