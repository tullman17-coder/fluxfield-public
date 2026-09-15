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
  accent: string;
  durationHint: string;
  inputs: WorkflowField[];
  presets: { id: string; label: string; description: string }[];
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
    accent: "#e85d04",
    durationHint: "Usually under a minute",
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
        help: "Optional. The result will follow this image.",
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
      },
      {
        id: "lifestyle",
        label: "Lifestyle",
        description: "Real-world scene with soft daylight",
      },
      {
        id: "with-model",
        label: "With Model",
        description: "Hands / person using the product",
      },
    ],
    promptTemplate:
      "Professional advertising product photography of {{productName}}, {{productDescription}}, {{preset}}, commercial brand campaign, crisp detail, controlled lighting, high-end ecommerce still",
    negativePrompt:
      "blurry, low quality, watermark, extra limbs, missing limbs, fused fingers, collapsed face",
    aspectDefault: "1:1",
    comfyMode: "img2img",
  },
  {
    slug: "ad-creatives",
    name: "Ad Creatives",
    tagline: "Meta and Google placement packs — volume variants for testing.",
    category: "ads",
    kind: "pack",
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
      "Paid social ad creative for {{productName}}, {{productDescription}}, audience {{audience}}, {{preset}} composition, scroll-stopping commercial advertising still, clean layout space for headline, brand photography",
    negativePrompt:
      "watermark, low contrast, amateur snapshot, extra limbs, fused fingers, crossed eyes",
    aspectDefault: "4:5",
    comfyMode: "txt2img",
  },
  {
    slug: "ugc-ad",
    name: "UGC Ad",
    tagline: "Phone-shot creator energy: talking head, faceless, or silent.",
    category: "ugc",
    kind: "video",
    accent: "#0f7a5f",
    durationHint: "Script plus key frames",
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
        description: "Face-to-camera creator review",
      },
      {
        id: "faceless",
        label: "Faceless",
        description: "Hands + product POV",
      },
      {
        id: "silent",
        label: "Silent",
        description: "Caption-led, no spoken VO needed",
      },
    ],
    promptTemplate:
      "Full-bleed candid creator photograph featuring {{productName}}, {{productDescription}}, {{preset}} style, casual bathroom or desk scene, natural skin texture, authentic available-light photography, edge-to-edge composition",
    negativePrompt:
      "studio softbox, cinematic anamorphic, celebrity face, heavy makeup glam, CGI plastic look",
    aspectDefault: "9:16",
    comfyMode: "img2img",
  },
  {
    slug: "product-motion",
    name: "Product Motion",
    tagline: "Cinematic camera moves and hypermotion product heroes.",
    category: "motion",
    kind: "video",
    accent: "#7a1f3d",
    durationHint: "Keyframe board + motion brief",
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
      "Cinematic product motion keyframe of {{productName}}, {{productDescription}}, {{preset}}, dramatic camera path, premium commercial lighting, reflective surfaces, launch film still",
    negativePrompt:
      "static snapshot, flat lighting, busy background clutter, soft focus fail",
    aspectDefault: "16:9",
    comfyMode: "video",
  },
  {
    slug: "marketplace-pack",
    name: "Marketplace Pack",
    tagline: "Listing imagery set: hero, detail, lifestyle, size context.",
    category: "marketplace",
    kind: "pack",
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
      "Ecommerce marketplace listing photo of {{productName}}, {{productDescription}}, {{preset}}, accurate product representation, bright even lighting, conversion-focused product image",
    negativePrompt:
      "misleading props, heavy stylization, watermark, extra limbs, fused fingers",
    aspectDefault: "1:1",
    comfyMode: "img2img",
  },
  {
    slug: "campaign-poster",
    name: "Campaign Poster",
    tagline: "Print and digital posters with room for headline lockups.",
    category: "poster",
    kind: "image",
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
        label: "Headline (leave space)",
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
      "stock photo watermark, muddy colors, extra limbs, missing limbs, collapsed face",
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
  return template
    .replaceAll("{{productName}}", values.productName?.trim() || "the product")
    .replaceAll(
      "{{productDescription}}",
      values.productDescription?.trim() || "featured product",
    )
    .replaceAll("{{audience}}", values.audience?.trim() || "general audience")
    .replaceAll("{{headline}}", values.headline?.trim() || "campaign headline")
    .replaceAll("{{preset}}", presetLabel);
}
