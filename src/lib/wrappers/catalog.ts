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
      "Streetwear product photo for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, centered subject with clean margins, fashion editorial flash photography, bold graphic apparel, high contrast, correct anatomy if a person is present: matching eyes, intact face, natural hands and limbs",
    negativePrompt:
      "blurry, watermark, low-res, extra limbs, missing limbs, fused fingers, crossed eyes, collapsed face",
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
      "Editorial product still for {{brandName}} featuring {{productName}}, {{productDescription}}, {{preset}}, clean magazine lighting, object centered left-of-frame with soft negative space, premium brand still, correct hands and face if a person appears",
    negativePrompt:
      "clutter, harsh flash, watermark, comic style, neon, extra limbs, fused fingers, collapsed face",
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
      "Event key art portrait for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, strong silhouette, print-ready photographic subject, matching eyes and intact face, the right number of limbs",
    negativePrompt:
      "soft lifestyle stock, pastel gradients, watermark, extra limbs, missing limbs, fused fingers, crossed eyes, collapsed face",
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
      "Ecommerce product hero for {{brandName}} {{productName}}, {{productDescription}}, {{preset}}, soft commercial lighting, floating product on a clean field, correct hands if someone is holding the product",
    negativePrompt:
      "busy background, harsh shadows, watermark, unreadably small props, extra limbs, fused fingers",
    aspectDefault: "1.91:1",
    copyHints: ["Price chip", "Shop CTA", "Collection title"],
  },
  {
    slug: "virtual-tryon",
    name: "Virtual Try-On",
    brandSample: "FITTING ROOM",
    tagline: "Fitting-room screen with a model and a rail of outfits.",
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
      "Full-body fashion avatar for {{brandName}}, avatar {{productName}}, {{productDescription}}, {{preset}}, clean studio character plate, soft studio lighting, correct anthropomorphic anatomy: two matching eyes, intact face, two arms, two legs, natural hands",
    negativePrompt:
      "extra limbs, missing limbs, fused fingers, extra digits, crossed eyes, collapsed face, watermark",
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
      "Sports portrait for {{brandName}}, {{productName}}, {{productDescription}}, {{preset}}, bold athletic key art, strong silhouette, matching eyes, intact face, natural hands and the right number of limbs",
    negativePrompt:
      "weak contrast, watermark, muddy colors, extra limbs, missing limbs, fused fingers, crossed eyes, collapsed face",
    aspectDefault: "1:1",
    copyHints: ["Wordmark", "Name and number", "Season mark"],
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
