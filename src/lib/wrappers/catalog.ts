/**
 * GPT Image-2 style marketing wrappers.
 * Each wrapper is a composed mini-app: layout chrome + generated hero art + copy zones.
 */

export type WrapperField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "file";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  help?: string;
};

export type Image2Wrapper = {
  slug: string;
  name: string;
  brandSample: string;
  tagline: string;
  category:
    | "streetwear"
    | "editorial"
    | "event"
    | "ecommerce"
    | "tryon"
    | "sports"
    | "surreal";
  /** Masonry span hint for the launcher grid */
  span: "tall" | "wide" | "square" | "compact";
  accent: string;
  surface: string;
  layout:
    | "poster-cta"
    | "editorial-split"
    | "event-stack"
    | "shop-banner"
    | "tryon-ui"
    | "jersey-lockup";
  inputs: WrapperField[];
  presets: { id: string; label: string; description: string }[];
  promptTemplate: string;
  negativePrompt: string;
  aspectDefault: string;
  copyHints: string[];
};

export const IMAGE2_WRAPPERS: Image2Wrapper[] = [
  {
    slug: "streetwear-drop",
    name: "Streetwear Drop",
    brandSample: "DROP 04",
    tagline: "Vertical drop poster with sticker energy and shop CTA.",
    category: "streetwear",
    span: "tall",
    accent: "#f5d90a",
    surface: "#1d4ed8",
    layout: "poster-cta",
    inputs: [
      {
        id: "brandName",
        label: "Brand",
        type: "text",
        required: true,
        placeholder: "Your label",
      },
      {
        id: "productName",
        label: "Drop / product",
        type: "text",
        required: true,
        placeholder: "Heavyweight hoodie",
      },
      {
        id: "productDescription",
        label: "Look + vibe",
        type: "textarea",
        required: true,
        placeholder: "Heavyweight hoodie, puff-print graphic, night flash photo",
      },
      {
        id: "cta",
        label: "CTA",
        type: "text",
        placeholder: "Shop the drop →",
      },
      {
        id: "referenceImage",
        label: "Model / product ref",
        type: "file",
      },
    ],
    presets: [
      {
        id: "new-drop",
        label: "New Drop",
        description: "Sticker callouts + flash photography",
      },
      {
        id: "archive",
        label: "Archive",
        description: "Faded paste-up poster",
      },
      {
        id: "night-market",
        label: "Night Market",
        description: "Neon street ambient",
      },
    ],
    promptTemplate:
      "Streetwear campaign photo for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, vertical advertising poster subject, fashion editorial flash photography, bold graphic apparel, high contrast",
    negativePrompt:
      "blurry, watermark, low-res, deformed hands, busy unreadable text baked in",
    aspectDefault: "9:16",
    copyHints: ["Drop badge", "Shop CTA", "Sticker overlays"],
  },
  {
    slug: "editorial-catalog",
    name: "Editorial Catalog",
    brandSample: "ATELIER NORD",
    tagline: "Magazine-split layout: hero object + long-form brand copy.",
    category: "editorial",
    span: "tall",
    accent: "#0ea5e9",
    surface: "#f4f1ec",
    layout: "editorial-split",
    inputs: [
      {
        id: "brandName",
        label: "Brand",
        type: "text",
        required: true,
        placeholder: "Atelier Nord",
      },
      {
        id: "productName",
        label: "Hero object",
        type: "text",
        required: true,
        placeholder: "Lounge Chair 02",
      },
      {
        id: "productDescription",
        label: "Scene + materials",
        type: "textarea",
        required: true,
        placeholder: "Powder-blue lounge chair, soft daylight loft, wool throw",
      },
      {
        id: "headline",
        label: "Headline",
        type: "text",
        placeholder: "Made to be sat in.",
      },
      {
        id: "bodyCopy",
        label: "Body copy",
        type: "textarea",
        placeholder: "Built for rooms that refuse compromise…",
      },
    ],
    presets: [
      {
        id: "furniture",
        label: "Furniture",
        description: "Object + pet/lifestyle beat",
      },
      {
        id: "objects",
        label: "Objects",
        description: "Still-life catalogue page",
      },
      {
        id: "apparel",
        label: "Apparel",
        description: "Quiet luxury lookbook",
      },
    ],
    promptTemplate:
      "Editorial catalogue photography for {{brandName}} featuring {{productName}}, {{productDescription}}, {{preset}}, clean magazine lighting, generous negative space for typography, premium brand still",
    negativePrompt: "clutter, harsh flash, watermark, comic style, neon",
    aspectDefault: "4:5",
    copyHints: ["Split layout", "Long-form copy block", "Brand masthead"],
  },
  {
    slug: "event-poster",
    name: "Event Poster",
    brandSample: "HALL 4 LIVE",
    tagline: "Punk/print exhibition poster with venue stack.",
    category: "event",
    span: "tall",
    accent: "#facc15",
    surface: "#111111",
    layout: "event-stack",
    inputs: [
      {
        id: "brandName",
        label: "Artist / title",
        type: "text",
        required: true,
        placeholder: "Headliner name",
      },
      {
        id: "productName",
        label: "Show name",
        type: "text",
        required: true,
        placeholder: "One-night show",
      },
      {
        id: "productDescription",
        label: "Visual subject",
        type: "textarea",
        required: true,
        placeholder: "Spotlit performer silhouette, xerox texture",
      },
      {
        id: "venue",
        label: "Venue details",
        type: "textarea",
        placeholder: "Hall 4 · Friday · 21:00",
      },
    ],
    presets: [
      {
        id: "xerox-punk",
        label: "Xerox Punk",
        description: "Halftone, paste-up, high contrast",
      },
      {
        id: "gallery-clean",
        label: "Gallery Clean",
        description: "Minimal white cube energy",
      },
      {
        id: "festival",
        label: "Festival",
        description: "Loud stacked type zones",
      },
    ],
    promptTemplate:
      "Event poster hero portrait for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, print-ready promotional key art, strong silhouette, space for venue typography",
    negativePrompt: "soft lifestyle stock, pastel gradients, watermark",
    aspectDefault: "2:3",
    copyHints: ["Venue stack", "Date/time", "Ticket CTA zone"],
  },
  {
    slug: "ecommerce-banner",
    name: "Ecommerce Banner",
    brandSample: "KILN HOUSE",
    tagline: "Shop collection banner with price chip and product float.",
    category: "ecommerce",
    span: "wide",
    accent: "#fb7185",
    surface: "#ffe4d6",
    layout: "shop-banner",
    inputs: [
      {
        id: "brandName",
        label: "Shop name",
        type: "text",
        required: true,
        placeholder: "Kiln House",
      },
      {
        id: "productName",
        label: "Collection",
        type: "text",
        required: true,
        placeholder: "Breakfast Set",
      },
      {
        id: "productDescription",
        label: "Products in frame",
        type: "textarea",
        required: true,
        placeholder: "Hand-thrown bowl and mug, soft peach backdrop",
      },
      {
        id: "price",
        label: "From price",
        type: "text",
        placeholder: "from $24",
      },
      {
        id: "cta",
        label: "CTA",
        type: "text",
        placeholder: "Shop the set →",
      },
    ],
    presets: [
      {
        id: "soft-float",
        label: "Soft Float",
        description: "Products hovering on pastel field",
      },
      {
        id: "grid-shelf",
        label: "Grid Shelf",
        description: "Catalogue shelf arrangement",
      },
      {
        id: "hero-single",
        label: "Hero Single",
        description: "One SKU dominates",
      },
    ],
    promptTemplate:
      "Ecommerce collection hero for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, soft commercial product lighting, floating product arrangement, clean web banner subject",
    negativePrompt: "busy background, harsh shadows, watermark, unreadably small props",
    aspectDefault: "1.91:1",
    copyHints: ["Price chip", "Shop CTA", "Collection title"],
  },
  {
    slug: "virtual-tryon",
    name: "Virtual Try-On",
    brandSample: "FITTING ROOM",
    tagline: "Fitting-room UI wrapper with avatar + outfit grid.",
    category: "tryon",
    span: "wide",
    accent: "#22c55e",
    surface: "#0f172a",
    layout: "tryon-ui",
    inputs: [
      {
        id: "brandName",
        label: "App / brand",
        type: "text",
        required: true,
        placeholder: "Fitting Room",
      },
      {
        id: "productName",
        label: "Avatar name",
        type: "text",
        required: true,
        placeholder: "AVATAR 01",
      },
      {
        id: "productDescription",
        label: "Look + wardrobe",
        type: "textarea",
        required: true,
        placeholder: "Capsule rail: denim, bomber, sneakers",
      },
      {
        id: "cta",
        label: "Primary CTA",
        type: "text",
        placeholder: "Start Fitting",
      },
    ],
    presets: [
      {
        id: "fitting-room",
        label: "Fitting Room",
        description: "Avatar + grid of outfits",
      },
      {
        id: "runway",
        label: "Runway",
        description: "Full-body walk pose",
      },
      {
        id: "closet",
        label: "Closet",
        description: "Wardrobe rail UI energy",
      },
    ],
    promptTemplate:
      "Virtual try-on UI hero character for {{brandName}}, avatar {{productName}}, {{productDescription}}, {{preset}}, clean character sheet, fashion tech product screenshot subject, soft studio lighting",
    negativePrompt: "nsfw, deformed anatomy, cluttered desktop chrome, watermark",
    aspectDefault: "16:9",
    copyHints: ["Outfit grid", "Start Fitting", "How it works"],
  },
  {
    slug: "sports-lockup",
    name: "Sports Lockup",
    brandSample: "CLUB 11",
    tagline: "Jersey / team graphic with calligraphic accent.",
    category: "sports",
    span: "square",
    accent: "#ef4444",
    surface: "#111827",
    layout: "jersey-lockup",
    inputs: [
      {
        id: "brandName",
        label: "Team / brand",
        type: "text",
        required: true,
        placeholder: "Club Eleven",
      },
      {
        id: "productName",
        label: "Subject",
        type: "text",
        required: true,
        placeholder: "Home kit portrait",
      },
      {
        id: "productDescription",
        label: "Look",
        type: "textarea",
        required: true,
        placeholder: "Athlete in home kit, bold brush mark",
      },
    ],
    presets: [
      {
        id: "anime-athletic",
        label: "Anime Athletic",
        description: "Illustrated sports portrait",
      },
      {
        id: "photo-real",
        label: "Photo Real",
        description: "Stadium flash portrait",
      },
      {
        id: "logo-mark",
        label: "Logo Mark",
        description: "Emblem-first composition",
      },
    ],
    promptTemplate:
      "Sports brand lockup hero for {{brandName}}, {{productName}}, {{productDescription}}, {{preset}}, bold athletic advertising key art, strong silhouette, room for calligraphy mark",
    negativePrompt: "weak contrast, watermark, muddy colors",
    aspectDefault: "1:1",
    copyHints: ["Wordmark", "Number/name plate", "Season mark"],
  },
];

export function getImage2Wrapper(slug: string) {
  return IMAGE2_WRAPPERS.find((w) => w.slug === slug);
}

export function fillWrapperPrompt(
  template: string,
  values: Record<string, string>,
  presetLabel: string,
) {
  return template
    .replaceAll("{{brandName}}", values.brandName?.trim() || "Brand")
    .replaceAll("{{productName}}", values.productName?.trim() || "Product")
    .replaceAll(
      "{{productDescription}}",
      values.productDescription?.trim() || "featured subject",
    )
    .replaceAll("{{preset}}", presetLabel);
}
