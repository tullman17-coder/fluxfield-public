export type PresetCategory =
  | "ugc"
  | "product"
  | "poster"
  | "marketplace"
  | "editorial"
  | "motion";

export type MarketplacePreset = {
  id: string;
  name: string;
  category: PresetCategory;
  description: string;
  /** Image-2 layout slug, workflow slug, or "key-art" for freeform. */
  layoutId: string;
  defaultStyle: string;
  tagline: string;
  /** Where the browse card should send the user. */
  href: string;
};

export const PRESET_CATEGORIES: {
  id: PresetCategory;
  label: string;
}[] = [
  { id: "ugc", label: "UGC" },
  { id: "product", label: "Product" },
  { id: "poster", label: "Poster" },
  { id: "marketplace", label: "Marketplace" },
  { id: "editorial", label: "Editorial" },
  { id: "motion", label: "Motion" },
];

/**
 * Marketing Studio-style preset catalog. layoutId maps to an Image-2 layout
 * when possible; otherwise to a workflow or a dedicated tool route via href.
 */
export const MARKETPLACE_PRESETS: MarketplacePreset[] = [
  {
    id: "ugc-review",
    name: "Honest review",
    category: "ugc",
    description: "Silent review gestures with product close-ups.",
    layoutId: "virtual-tryon",
    defaultStyle: "photo",
    tagline: "Show the product",
    href: "/ugc?preset=review",
  },
  {
    id: "ugc-unboxing",
    name: "Unboxing",
    category: "ugc",
    description: "Open, reveal and first-impression motion beats.",
    layoutId: "ecommerce-banner",
    defaultStyle: "photo",
    tagline: "The moment the box opens",
    href: "/ugc?preset=unboxing",
  },
  {
    id: "ugc-tryon",
    name: "Outfit concept clip",
    category: "ugc",
    description: "Generated outfit concept motion, not garment transfer or a fitting simulation.",
    layoutId: "virtual-tryon",
    defaultStyle: "photo",
    tagline: "Imagine the outfit",
    href: "/ugc?preset=tryon",
  },
  {
    id: "product-hero",
    name: "Hero still",
    category: "product",
    description: "Clean catalogue image without headline or CTA overlays.",
    layoutId: "ecommerce-banner",
    defaultStyle: "photo",
    tagline: "Shop-ready product art",
    href: "/workflows/product-shot?preset=studio",
  },
  {
    id: "product-lifestyle",
    name: "Lifestyle set",
    category: "product",
    description: "Clean product image in a lived-in scene with soft light.",
    layoutId: "editorial-catalog",
    defaultStyle: "photo",
    tagline: "In the world",
    href: "/workflows/product-shot?preset=lifestyle",
  },
  {
    id: "poster-event",
    name: "Event bill",
    category: "poster",
    description: "Event bill with literal venue copy and bold key art.",
    layoutId: "event-poster",
    defaultStyle: "From preset",
    tagline: "Fill the wall",
    href: "/image-2/event-poster?preset=xerox-punk",
  },
  {
    id: "poster-drop",
    name: "Drop poster",
    category: "poster",
    description: "Playful character art with a bold drop title and CTA.",
    layoutId: "streetwear-drop",
    defaultStyle: "From preset",
    tagline: "Tonight only",
    href: "/image-2/streetwear-drop?preset=silly-cartoon",
  },
  {
    id: "marketplace-pack",
    name: "Listing pack",
    category: "marketplace",
    description: "Hero, detail, lifestyle and scale-context listing images.",
    layoutId: "ecommerce-banner",
    defaultStyle: "photo",
    tagline: "Ready for the feed",
    href: "/workflows/marketplace-pack?preset=hero-white",
  },
  {
    id: "marketplace-banner",
    name: "Shop banner",
    category: "marketplace",
    description: "Wide composed promo with price and CTA.",
    layoutId: "ecommerce-banner",
    defaultStyle: "photo",
    tagline: "Sale strip",
    href: "/image-2/ecommerce-banner?preset=soft-float",
  },
  {
    id: "editorial-spread",
    name: "Catalog spread",
    category: "editorial",
    description: "Magazine-style spread with literal headline and body copy.",
    layoutId: "editorial-catalog",
    defaultStyle: "editorial",
    tagline: "Turn the page",
    href: "/image-2/editorial-catalog?preset=objects",
  },
  {
    id: "editorial-sports",
    name: "Sports lockup",
    category: "editorial",
    description: "Playful athletic art with team name and subject title.",
    layoutId: "sports-lockup",
    defaultStyle: "photo",
    tagline: "Game day type",
    href: "/image-2/sports-lockup?preset=anime-athletic",
  },
  {
    id: "motion-explainer",
    name: "Short explainer",
    category: "motion",
    description: "Script and cartoon motion scenes; managed narration unavailable.",
    layoutId: "key-art",
    defaultStyle: "From preset",
    tagline: "Say it in beats",
    href: "/explainer?preset=stickman-cartoon",
  },
  {
    id: "motion-director",
    name: "Music video",
    category: "motion",
    description: "Animated short cut with a generated or uploaded soundtrack.",
    layoutId: "key-art",
    defaultStyle: "cinematic",
    tagline: "Plan the cut",
    href: "/director?look=animated",
  },
  {
    id: "motion-ads",
    name: "Ad sequence",
    category: "motion",
    description: "One ad sequence per run, not an independent A/B variant pack.",
    layoutId: "key-art",
    defaultStyle: "photo",
    tagline: "One brief, one sequence",
    href: "/ad-multiplier?preset=variants",
  },
  {
    id: "motion-faceless",
    name: "Faceless story",
    category: "motion",
    description: "Silent visual story without an on-camera host.",
    layoutId: "key-art",
    defaultStyle: "From preset",
    tagline: "A story in motion",
    href: "/faceless?preset=story",
  },
];

export function getMarketplacePreset(id: string) {
  return MARKETPLACE_PRESETS.find((p) => p.id === id);
}

export function presetsByCategory(category: PresetCategory) {
  return MARKETPLACE_PRESETS.filter((p) => p.category === category);
}
