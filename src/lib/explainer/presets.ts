export type ExplainerPreset = {
  id: string;
  name: string;
  blurb: string;
  /** Visual prompt fragment injected into every beat */
  stylePrompt: string;
  negativePrompt: string;
  accent: string;
  /** Static, generated still; never generate media while reading a card. */
  previewImage: string;
  styleAlias: string;
  example: string;
  overlayHint: string;
};

export const EXPLAINER_PRESETS: ExplainerPreset[] = [
  {
    id: "editorial-motion",
    name: "Soft 3D Editorial",
    blurb: "Panel frames, soft 3D characters, magazine pacing.",
    stylePrompt:
      "editorial motion graphics still, framed panel composition, soft stylized 3D character, clean graphic design, tasteful type space",
    negativePrompt: "messy collage, low contrast, watermark",
    accent: "#e77ae6",
    previewImage: "/examples/explainer/editorial-motion.webp",
    styleAlias: "Chroma · Soft 3D",
    example: "A clay-like guide beside editorial panels",
    overlayHint: "Panel frame",
  },
  {
    id: "stickman-cartoon",
    name: "Stickman Cartoon",
    blurb: "Hand-drawn gag pacing with caption energy.",
    stylePrompt:
      "stickman cartoon explainer frame, bold ink outlines, flat color fills, humorous educational illustration",
    negativePrompt: "photoreal, oily paint, watermark",
    accent: "#86efac",
    previewImage: "/examples/explainer/stickman-cartoon.webp",
    styleAlias: "Chroma · Stickman",
    example: "An ink character explaining a simple idea",
    overlayHint: "Gag caption",
  },
  {
    id: "watercolor-chronicle",
    name: "Watercolor Chronicle",
    blurb: "Painterly documentary beats.",
    stylePrompt:
      "watercolor chronicle illustration, wet-on-wet pigment, documentary explainer keyframe, paper tooth visible",
    negativePrompt: "vector flat, neon UI, watermark",
    accent: "#93c5fd",
    previewImage: "/examples/explainer/watercolor-chronicle.webp",
    styleAlias: "Chroma · Watercolor",
    example: "A harbor story in translucent watercolor",
    overlayHint: "Documentary wash",
  },
  {
    id: "fairy-tale-myth",
    name: "Fairy Tale & Myth",
    blurb: "Storybook vistas and mythic scale.",
    stylePrompt:
      "fairy tale mythic explainer frame, storybook lighting, epic landscape, illustrated fable energy",
    negativePrompt: "modern office, UI chrome, watermark",
    accent: "#fcd34d",
    previewImage: "/examples/explainer/fairy-tale-myth.webp",
    styleAlias: "Chroma · Storybook",
    example: "A lantern-lit castle in a painted valley",
    overlayHint: "Storybook beat",
  },
  {
    id: "paper-diorama",
    name: "Paper Diorama",
    blurb: "Cut-paper stages and cardboard depth.",
    stylePrompt:
      "paper diorama explainer scene, layered cardboard depth, craft lighting, miniature stage set",
    negativePrompt: "photoreal skin, glossy CGI, watermark",
    accent: "#fdba74",
    previewImage: "/examples/explainer/paper-diorama.webp",
    styleAlias: "Chroma · Paper Diorama",
    example: "A paper-cut forest on a miniature stage",
    overlayHint: "Stage card",
  },
  {
    id: "pastel-flat-2d",
    name: "Pastel Flat 2D",
    blurb: "Architectural flat color and calm geometry.",
    stylePrompt:
      "pastel flat 2d explainer illustration, architectural geometry, soft pastel palette, clean vector shading",
    negativePrompt: "gritty texture, horror, watermark",
    accent: "#e9d5ff",
    previewImage: "/examples/explainer/pastel-flat-2d.webp",
    styleAlias: "Chroma · Pastel 2D",
    example: "A calm city in flat pastel shapes",
    overlayHint: "Flat geometry",
  },
];

export const EXPLAINER_VOICES = [
  { id: "narrator-warm", label: "Warm Narrator" },
  { id: "narrator-f", label: "Narrator F" },
  { id: "narrator-m", label: "Narrator M" },
  { id: "bright", label: "Bright" },
];

export const EXPLAINER_DURATIONS = [
  { id: "30s", label: "30s", beats: 4 },
  { id: "1m", label: "1m", beats: 6 },
  { id: "2m", label: "2m", beats: 10 },
];

export function getExplainerPreset(id: string) {
  return EXPLAINER_PRESETS.find((p) => p.id === id) ?? EXPLAINER_PRESETS[0];
}

export function getDurationBeats(id: string) {
  return EXPLAINER_DURATIONS.find((d) => d.id === id)?.beats ?? 6;
}
