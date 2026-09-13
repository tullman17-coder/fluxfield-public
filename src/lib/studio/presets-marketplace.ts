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
    description: "Talking-head review beats with product close-ups.",
    layoutId: "virtual-tryon",
    defaultStyle: "photo",
    tagline: "Real talk, real product",
    href: "/ugc",
  },
  {
    id: "ugc-unboxing",
    name: "Unboxing",
    category: "ugc",
    description: "Open, reveal, and first-impression cuts.",
    layoutId: "ecommerce-banner",
    defaultStyle: "photo",
    tagline: "The moment the box opens",
    href: "/ugc",
  },
  {
    id: "ugc-tryon",
    name: "Try-on",
    category: "ugc",
    description: "Fitting-room energy with before and after frames.",
    layoutId: "virtual-tryon",
    defaultStyle: "photo",
    tagline: "See it on",
    href: "/ugc",
  },
  {
    id: "product-hero",
    name: "Hero still",
    category: "product",
    description: "Clean catalogue hero with room for the nameplate.",
    layoutId: "ecommerce-banner",
    defaultStyle: "photo",
    tagline: "Shop-ready product art",
    href: "/image-2/ecommerce-banner",
  },
  {
    id: "product-lifestyle",
    name: "Lifestyle set",
    category: "product",
    description: "Product in a lived-in scene, soft light.",
    layoutId: "editorial-catalog",
    defaultStyle: "photo",
    tagline: "In the world",
    href: "/workflows/product-shot",
  },
  {
    id: "poster-event",
    name: "Event bill",
    category: "poster",
    description: "Bold type, date block, and a full-bleed image.",
    layoutId: "event-poster",
    defaultStyle: "graphic",
    tagline: "Fill the wall",
    href: "/image-2/event-poster",
  },
  {
    id: "poster-drop",
    name: "Drop poster",
    category: "poster",
    description: "Streetwear drop with loud type and a key color.",
    layoutId: "streetwear-drop",
    defaultStyle: "graphic",
    tagline: "Tonight only",
    href: "/image-2/streetwear-drop",
  },
  {
    id: "marketplace-pack",
    name: "Listing pack",
    category: "marketplace",
    description: "Main image plus detail tiles for a shop listing.",
    layoutId: "ecommerce-banner",
    defaultStyle: "photo",
    tagline: "Ready for the feed",
    href: "/workflows/marketplace-pack",
  },
  {
    id: "marketplace-banner",
    name: "Shop banner",
    category: "marketplace",
    description: "Wide promo strip with price and CTA space.",
    layoutId: "ecommerce-banner",
    defaultStyle: "photo",
    tagline: "Sale strip",
    href: "/image-2/ecommerce-banner",
  },
  {
    id: "editorial-spread",
    name: "Catalog spread",
    category: "editorial",
    description: "Magazine-style spread with body copy columns.",
    layoutId: "editorial-catalog",
    defaultStyle: "editorial",
    tagline: "Turn the page",
    href: "/image-2/editorial-catalog",
  },
  {
    id: "editorial-sports",
    name: "Sports lockup",
    category: "editorial",
    description: "Athlete lockup with jersey number and tagline.",
    layoutId: "sports-lockup",
    defaultStyle: "photo",
    tagline: "Game day type",
    href: "/image-2/sports-lockup",
  },
  {
    id: "motion-explainer",
    name: "Short explainer",
    category: "motion",
    description: "Keyframe storyboard with narration for a short film.",
    layoutId: "key-art",
    defaultStyle: "illustration",
    tagline: "Say it in beats",
    href: "/explainer",
  },
  {
    id: "motion-director",
    name: "Music video plan",
    category: "motion",
    description: "Shot list, score bed, and key frames for a cut.",
    layoutId: "key-art",
    defaultStyle: "cinematic",
    tagline: "Plan the cut",
    href: "/director",
  },
  {
    id: "motion-ads",
    name: "Ad variants",
    category: "motion",
    description: "Several cuts from one brief for paid social.",
    layoutId: "key-art",
    defaultStyle: "photo",
    tagline: "One brief, many cuts",
    href: "/ad-multiplier",
  },
  {
    id: "motion-faceless",
    name: "Faceless story",
    category: "motion",
    description: "Narrated story or explainer without an on-camera host.",
    layoutId: "key-art",
    defaultStyle: "illustration",
    tagline: "Voice over pictures",
    href: "/faceless",
  },
];

export function getMarketplacePreset(id: string) {
  return MARKETPLACE_PRESETS.find((p) => p.id === id);
}

export function presetsByCategory(category: PresetCategory) {
  return MARKETPLACE_PRESETS.filter((p) => p.category === category);
}
