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
    styleAlias: "Flux.1 · Soft 3D",
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
    styleAlias: "Flux.1 · Stickman",
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
    styleAlias: "Flux.1 · Watercolor",
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
    styleAlias: "Flux.1 · Storybook",
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
    styleAlias: "Flux.1 · Paper Diorama",
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
    styleAlias: "Flux.1 · Pastel 2D",
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
  { id: "30s", label: "30s", beats: 4, sec: 30 },
  { id: "1m", label: "1 min", beats: 6, sec: 60 },
  { id: "2m", label: "2 min", beats: 8, sec: 120 },
  { id: "3m", label: "3 min", beats: 10, sec: 180 },
  { id: "5m", label: "5 min", beats: 12, sec: 300 },
  { id: "10m", label: "10 min", beats: 12, sec: 600 },
  { id: "15m", label: "15 min", beats: 12, sec: 900 },
];

export function getExplainerPreset(id: string) {
  return EXPLAINER_PRESETS.find((p) => p.id === id) ?? EXPLAINER_PRESETS[0];
}

export function getDurationBeats(id: string) {
  return EXPLAINER_DURATIONS.find((d) => d.id === id)?.beats ?? 6;
}

export function getDurationSeconds(id: string) {
  return EXPLAINER_DURATIONS.find((d) => d.id === id)?.sec ?? 60;
}
