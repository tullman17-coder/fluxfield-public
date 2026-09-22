/**
 * Composed art layouts; stable slugs are retained for saved jobs.
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

export type PromptPreset = { id: string; label: string; description: string; style?: string };

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
  presets: PromptPreset[];
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
        placeholder: "A grinning raccoon in an oversized hoodie, playful exaggerated pose",
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
        id: "silly-cartoon",
        label: "Silly & flattering",
        description: "Cheerful character pose, sticker-shaped accents, bold clothing silhouette",
        style: "playful cartoon illustration, flattering kind caricature, silly expressive gesture",
      },
      {
        id: "new-drop",
        label: "New Drop",
        description: "Sticker-shaped callouts, punchy contrast and bold apparel",
        style: "direct-flash fashion photography",
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
      "Streetwear key art for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, complete subject with clean margins, bold apparel silhouette",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "9:16",
    copyHints: ["Drop badge", "Shop CTA", "Sticker overlays"],
  },
  {
    slug: "editorial-catalog",
    name: "Editorial Catalog",
    brandSample: "ATELIER NORD",
    tagline: "Magazine spread — one hero object beside long brand copy.",
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
      "Editorial key art for {{brandName}} featuring {{productName}}, {{productDescription}}, {{preset}}, subject with generous margins, soft negative space",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "4:5",
    copyHints: ["Split layout", "Room for long copy", "Brand masthead"],
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
      "Event key art for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, strong silhouette, generous margins for the separate printed copy",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "2:3",
    copyHints: ["Venue stack", "Date and time", "Ticket line"],
  },
  {
    slug: "ecommerce-banner",
    name: "Ecommerce Banner",
    brandSample: "KILN HOUSE",
    tagline: "Shop banner with a floating product and a price chip.",
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
        description: "Products hovering on pastel field, soft shadows beneath each object",
      },
      {
        id: "grid-shelf",
        label: "Grid Shelf",
        description: "Catalogue shelf arrangement, orderly rows resting on shelves",
      },
      {
        id: "hero-single",
        label: "Hero Single",
        description: "One SKU dominates, isolated single object, uncluttered backdrop",
      },
    ],
    promptTemplate:
      "Product hero for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, clear material detail and clean margins",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "1.91:1",
    copyHints: ["Price chip", "Shop CTA", "Collection title"],
  },
  {
    slug: "virtual-tryon",
    name: "Outfit Board",
    brandSample: "FITTING ROOM",
    tagline: "Fashion concept art with outfit notes — not garment transfer or a fitting simulation.",
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
        label: "Character / outfit title",
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
        placeholder: "Explore the look",
      },
    ],
    presets: [
      {
        id: "fitting-room",
        label: "Fitting Room",
        description: "Full-body character with a coordinated outfit, relaxed fitting-room pose",
      },
      {
        id: "runway",
        label: "Runway",
        description: "Full-body walk pose",
      },
      {
        id: "closet",
        label: "Closet",
        description: "Coordinated wardrobe beside the character, hanging clothes on a rail",
      },
    ],
    promptTemplate:
      "Full-body outfit concept for {{brandName}}, character {{productName}}, {{productDescription}}, {{preset}}, complete outfit and character in frame, generous margins",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "16:9",
    copyHints: ["Fashion concept", "Outfit notes", "No garment transfer"],
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
        description: "Energetic athletic portrait, triumphant silly pose, flattering expression",
        style: "expressive anime illustration, clean cel shading",
      },
      {
        id: "photo-real",
        label: "Photo Real",
        description: "Stadium setting, dramatic flash, athletic portrait",
        style: "photorealistic sports photography",
      },
      {
        id: "logo-mark",
        label: "Logo Mark",
        description: "Emblem-first composition, isolated team symbol, no portrait",
      },
    ],
    promptTemplate:
      "Sports key art for {{brandName}}, {{productName}}, {{productDescription}}, {{preset}}, strong silhouette with generous margins",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "1:1",
    copyHints: ["Team name", "Subject title", "Athletic key art"],
  },
];

export function getImage2Wrapper(slug: string) {
  return IMAGE2_WRAPPERS.find((w) => w.slug === slug);
}

/**
 * Example values for a layout, taken from the hints already shown in its form.
 * Running these gives a card a genuine sample of what the layout makes rather
 * than a decorative background.
 */
export function sampleValues(wrapper: Image2Wrapper): Record<string, string> {
  const values: Record<string, string> = {
    brandName: wrapper.brandSample,
  };
  for (const field of wrapper.inputs) {
    if (field.type === "file") continue;
    if (field.type === "select") {
      const first = field.options?.[0]?.value;
      if (first) values[field.id] = first;
      continue;
    }
    if (field.placeholder) values[field.id] = field.placeholder;
  }
  values.brandName = wrapper.brandSample;
  return values;
}

/** Replace original tokens once; user values are literal, never templates. */
export function interpolatePrompt(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (token, key: string) => values[key] ?? token);
}

/** Style defaults yield to a selected Look or a rendering style stated in the brief. */
export function presetDirection(preset: PromptPreset, values: Record<string, string>) {
  const brief = [values.productDescription, values.prompt, values.brief].filter(Boolean).join(" ");
  // ponytail: conservative style vocabulary; select Look explicitly for ambiguous briefs.
  const explicitStyle = (values.dreamStyle && values.dreamStyle !== "auto") || /\b(?:photo\w*|realis(?:m|tic)|anime|cartoon|caricature|illustrat\w*|watercolou?r|gouache|pixel|line art|oil paint\w*|3d|clay)\b/i.test(brief);
  return [preset.description, !explicitStyle && preset.style].filter(Boolean).join(". ");
}

export function fillWrapperPrompt(
  template: string,
  values: Record<string, string>,
  presetLabel: string,
) {
  const wrapper = IMAGE2_WRAPPERS.find((w) => w.promptTemplate === template);
  const preset = wrapper?.presets.find((p) => p.label === presetLabel || p.id === presetLabel);
  return interpolatePrompt(template, {
    brandName: "Brand",
    productName: "Product",
    productDescription: "featured subject",
    ...values,
    preset: preset ? presetDirection(preset, values) : presetLabel,
  });
}
