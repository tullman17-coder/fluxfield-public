import { interpolatePrompt, presetDirection, type PromptPreset } from "@/lib/wrappers/catalog";

export type WorkflowKind = "image" | "video" | "pack";

export type WorkflowField = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "file";
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  help?: string;
};

export type WorkflowDefinition = {
  slug: string;
  name: string;
  tagline: string;
  category: "product" | "ads" | "ugc" | "motion" | "marketplace" | "poster";
  kind: WorkflowKind;
  outputKind: "image" | "composition" | "video";
  accent: string;
  durationHint: string;
  inputs: WorkflowField[];
  presets: PromptPreset[];
  promptTemplate: string;
  negativePrompt: string;
  aspectDefault: string;
  comfyMode: "txt2img" | "img2img" | "video";
};

export const WORKFLOWS: WorkflowDefinition[] = [
  {
    slug: "product-shot",
    name: "Product Shot",
    tagline: "Catalogue, lifestyle, and model-held stills from one product brief.",
    category: "product",
    kind: "image",
    outputKind: "image",
    accent: "#e85d04",
    durationHint: "Clean image · no typography",
    inputs: [
      {
        id: "productName",
        label: "Product name",
        type: "text",
        required: true,
        placeholder: "AeroBrew Go Cup",
      },
      {
        id: "productDescription",
        label: "Product details",
        type: "textarea",
        required: true,
        placeholder: "Matte black insulated tumbler, copper lid, 16oz",
      },
      {
        id: "referenceImage",
        label: "Product photo (optional)",
        type: "file",
        help: "Optional reference. Exact product identity is not guaranteed; inspect the result.",
      },
      {
        id: "aspect",
        label: "Aspect",
        type: "select",
        options: [
          { label: "1:1 Square", value: "1:1" },
          { label: "4:5 Feed", value: "4:5" },
          { label: "16:9 Hero", value: "16:9" },
        ],
      },
    ],
    presets: [
      {
        id: "studio",
        label: "Studio",
        description: "Seamless backdrop, catalogue lighting",
        style: "clean product photography",
      },
      {
        id: "lifestyle",
        label: "Lifestyle",
        description: "Real-world scene with soft daylight",
        style: "natural product photography",
      },
      {
        id: "with-model",
        label: "With Model",
        description: "Hands / person using the product",
        style: "natural product photography",
      },
    ],
    promptTemplate:
      "Clean product image of {{productName}}, {{productDescription}}, {{preset}}, crisp detail, controlled lighting, no added poster frame, headline or CTA",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "1:1",
    comfyMode: "img2img",
  },
  {
    slug: "ad-creatives",
    name: "Ad Creatives",
    tagline: "Meta and Google placement packs — volume variants for testing.",
    category: "ads",
    kind: "pack",
    outputKind: "composition",
    accent: "#1d4e89",
    durationHint: "3 variants per run",
    inputs: [
      {
        id: "productName",
        label: "Offer / product",
        type: "text",
        required: true,
        placeholder: "NightShift Focus Gummies",
      },
      {
        id: "productDescription",
        label: "Hook + benefit",
        type: "textarea",
        required: true,
        placeholder: "Stay sharp after 9pm without the crash",
      },
      {
        id: "audience",
        label: "Audience",
        type: "text",
        placeholder: "Remote creatives, 25–40",
      },
      {
        id: "aspect",
        label: "Placement",
        type: "select",
        options: [
          { label: "1:1 Feed", value: "1:1" },
          { label: "4:5 Instagram", value: "4:5" },
          { label: "9:16 Stories / Reels", value: "9:16" },
          { label: "1.91:1 Display", value: "1.91:1" },
        ],
      },
    ],
    presets: [
      {
        id: "benefit-first",
        label: "Benefit First",
        description: "Big claim, product secondary",
      },
      {
        id: "product-hero",
        label: "Product Hero",
        description: "Product fills the frame",
      },
      {
        id: "social-proof",
        label: "Social Proof",
        description: "Testimonial / UGC energy still",
      },
    ],
    promptTemplate:
      "Paid social ad creative for {{productName}}, {{productDescription}}, audience {{audience}}, {{preset}} composition, scroll-stopping commercial advertising still, clean layout space for headline, clear subject separation",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "4:5",
    comfyMode: "txt2img",
  },
  {
    slug: "ugc-ad",
    name: "UGC Ad",
    tagline: "Creator-style motion concepts in the shared video tool; no lip-sync or narration.",
    category: "ugc",
    kind: "video",
    outputKind: "video",
    accent: "#0f7a5f",
    durationHint: "Opens Creator clips · 10–90 seconds",
    inputs: [
      {
        id: "productName",
        label: "Product",
        type: "text",
        required: true,
        placeholder: "GlowKit Vitamin C Serum",
      },
      {
        id: "productDescription",
        label: "What to show / say",
        type: "textarea",
        required: true,
        placeholder: "Morning routine, glass skin in 7 days, bathroom vanity",
      },
      {
        id: "referenceImage",
        label: "Product photo",
        type: "file",
        help: "Strongly recommended for product-in-hand shots.",
      },
      {
        id: "aspect",
        label: "Format",
        type: "select",
        options: [
          { label: "9:16 Vertical", value: "9:16" },
          { label: "1:1 Square", value: "1:1" },
        ],
      },
    ],
    presets: [
      {
        id: "talking-head",
        label: "Talking Head",
        description: "Face-to-camera creator review gestures and product close-ups; silent, no lip-sync",
      },
      {
        id: "faceless",
        label: "Faceless",
        description: "Hands + product POV; no visible host face",
      },
      {
        id: "silent",
        label: "Silent",
        description: "Silent product demonstration with expressive gestures; no generated speech or captions",
      },
    ],
    promptTemplate:
      "Full-bleed candid creator photograph featuring {{productName}}, {{productDescription}}, {{preset}} style, casual bathroom or desk scene, natural skin texture, authentic available-light photography, edge-to-edge composition",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "9:16",
    comfyMode: "img2img",
  },
  {
    slug: "product-motion",
    name: "Product Motion",
    tagline: "Cinematic camera moves and hypermotion product heroes.",
    category: "motion",
    kind: "video",
    outputKind: "video",
    accent: "#7a1f3d",
    durationHint: "Opens Creator clips with product-motion direction",
    inputs: [
      {
        id: "productName",
        label: "Product",
        type: "text",
        required: true,
        placeholder: "Orbit One Wireless Earbuds",
      },
      {
        id: "productDescription",
        label: "Look & materials",
        type: "textarea",
        required: true,
        placeholder: "Pearl white shells, soft-touch case, chrome hinge",
      },
      {
        id: "referenceImage",
        label: "Hero product image",
        type: "file",
      },
      {
        id: "aspect",
        label: "Aspect",
        type: "select",
        options: [
          { label: "16:9 Launch", value: "16:9" },
          { label: "9:16 Social", value: "9:16" },
          { label: "1:1 Loop", value: "1:1" },
        ],
      },
    ],
    presets: [
      {
        id: "hypermotion",
        label: "Hypermotion",
        description: "Dramatic orbits and speed ramps",
      },
      {
        id: "macro-glide",
        label: "Macro Glide",
        description: "Slow material close-ups",
      },
      {
        id: "mixed-media",
        label: "Mixed Media",
        description: "CGI + live product hybrid energy",
      },
    ],
    promptTemplate:
      "Product-motion concept of {{productName}}, {{productDescription}}, {{preset}}, dramatic camera path, premium commercial lighting, reflective surfaces, launch film still",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "16:9",
    comfyMode: "video",
  },
  {
    slug: "marketplace-pack",
    name: "Marketplace Pack",
    tagline: "Listing imagery set: hero, detail, lifestyle, size context.",
    category: "marketplace",
    kind: "pack",
    outputKind: "image",
    accent: "#5b4b8a",
    durationHint: "4 listing frames",
    inputs: [
      {
        id: "productName",
        label: "Listing title",
        type: "text",
        required: true,
        placeholder: "Cedar Desk Organizer — 3 Tray",
      },
      {
        id: "productDescription",
        label: "SKU details",
        type: "textarea",
        required: true,
        placeholder: "Solid cedar, brass pins, fits pens and sticky notes",
      },
      {
        id: "referenceImage",
        label: "Source photo",
        type: "file",
      },
      {
        id: "aspect",
        label: "Frame",
        type: "select",
        options: [
          { label: "1:1 Marketplace", value: "1:1" },
          { label: "4:5 Alternate", value: "4:5" },
        ],
      },
    ],
    presets: [
      {
        id: "hero-white",
        label: "Hero White",
        description: "Pure white background hero",
      },
      {
        id: "detail",
        label: "Detail Crop",
        description: "Material / joinery close-up",
      },
      {
        id: "in-situ",
        label: "In Situ",
        description: "Desk lifestyle context",
      },
    ],
    promptTemplate:
      "Clean marketplace listing image of {{productName}}, {{productDescription}}, {{preset}}, accurate product representation, bright even lighting, conversion-focused product image",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "1:1",
    comfyMode: "img2img",
  },
  {
    slug: "campaign-poster",
    name: "Campaign Poster",
    tagline: "Print and digital posters with room for headline lockups.",
    category: "poster",
    kind: "image",
    outputKind: "composition",
    accent: "#b45309",
    durationHint: "Single key art",
    inputs: [
      {
        id: "productName",
        label: "Campaign / product",
        type: "text",
        required: true,
        placeholder: "SOLSTICE — Summer Drop",
      },
      {
        id: "productDescription",
        label: "Visual direction",
        type: "textarea",
        required: true,
        placeholder: "Golden hour rooftop, linen textures, chilled citrus drink",
      },
      {
        id: "headline",
        label: "Headline (printed literally)",
        type: "text",
        placeholder: "Stay Out Longer",
      },
      {
        id: "aspect",
        label: "Poster size",
        type: "select",
        options: [
          { label: "2:3 Portrait", value: "2:3" },
          { label: "3:4 Portrait", value: "3:4" },
          { label: "16:9 Billboard", value: "16:9" },
        ],
      },
    ],
    presets: [
      {
        id: "editorial",
        label: "Editorial",
        description: "Magazine cover energy",
      },
      {
        id: "bold-type-space",
        label: "Type Space",
        description: "Negative space for big type",
      },
      {
        id: "immersive",
        label: "Immersive",
        description: "Full-bleed atmospheric scene",
      },
    ],
    promptTemplate:
      "Campaign poster key art for {{productName}}, {{productDescription}}, headline concept '{{headline}}', {{preset}}, advertising poster composition with clear focal point and space for typography, print-ready commercial art",
    negativePrompt:
      "watermark, unreadable accidental lettering, low resolution",
    aspectDefault: "2:3",
    comfyMode: "txt2img",
  },
];

export function getWorkflow(slug: string) {
  return WORKFLOWS.find((w) => w.slug === slug);
}

export function fillPrompt(
  template: string,
  values: Record<string, string>,
  presetLabel: string,
) {
  const workflow = WORKFLOWS.find((w) => w.promptTemplate === template);
  const preset = workflow?.presets.find((p) => p.label === presetLabel || p.id === presetLabel);
  return interpolatePrompt(template, {
    productName: "the product",
    productDescription: "featured product",
    audience: "general audience",
    headline: "campaign headline",
    ...values,
    preset: preset ? presetDirection(preset, values) : presetLabel,
  });
}

/** Managed motion lengths. UI sends both the legacy token and numeric seconds. */
export const MANAGED_MOTION_LENGTHS = [
  { id: "10s", label: "10 sec", seconds: 10 },
  { id: "15s", label: "15 sec", seconds: 15 },
  { id: "30s", label: "30 sec", seconds: 30 },
  { id: "1m", label: "60 sec", seconds: 60 },
  { id: "90s", label: "90 sec", seconds: 90 },
];

/** Compatibility only: use the real motion adapter, retaining the original direction. */
export function legacyVideoEntry(slug: string, presetId: string, inputs: Record<string, string> = {}) {
  const workflow = getWorkflow(slug);
  if (!workflow || !["ugc-ad", "product-motion"].includes(slug)) return undefined;
  const preset = workflow.presets.find((p) => p.id === presetId) ?? workflow.presets[0];
  return {
    tool: "ugc" as const,
    workflowSlug: "ugc",
    presetId: slug === "ugc-ad" && preset.id === "talking-head" ? "review" : "product",
    inputs: {
      ...inputs,
      aspect: inputs.aspect || workflow.aspectDefault,
      brief: [inputs.brief, inputs.productName, inputs.productDescription, presetDirection(preset, inputs)].filter(Boolean).join("\n"),
    },
  };
}

export function formQueryValues(query: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(query).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}
