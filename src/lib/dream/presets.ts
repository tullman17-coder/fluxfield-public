/**
 * Style presets + framing suffixes ported from local-dream-studio.
 * Used to enrich Fieldbench prompts before Comfy / Local Studio / mock.
 */

export type DreamPresetId =
  | "dream"
  | "photo"
  | "anime"
  | "fantasy"
  | "cinematic"
  | "pixel"
  | "line"
  | "vaporwave"
  | "documentary"
  | "editorial"
  | "noir"
  | "watercolor"
  | "gouache"
  | "concept"
  | "product"
  | "surreal";

export type FramingId =
  | "auto"
  | "extreme-wide"
  | "wide"
  | "full"
  | "medium"
  | "close"
  | "macro";

export const DREAM_PRESETS: {
  id: DreamPresetId;
  label: string;
  suffix: string;
}[] = [
  { id: "dream", label: "Dream", suffix: "soft dreamlike atmosphere, luminous details" },
  { id: "photo", label: "Photo", suffix: "natural light, realistic texture, photographic composition" },
  { id: "anime", label: "Anime", suffix: "expressive anime illustration, clean cel shading" },
  { id: "fantasy", label: "Fantasy", suffix: "mythic fantasy art, intricate worldbuilding" },
  { id: "cinematic", label: "Cinematic", suffix: "cinematic lighting, dramatic composition, rich color grading" },
  { id: "pixel", label: "Pixel", suffix: "pixel art, crisp clusters, limited color palette" },
  { id: "line", label: "Line", suffix: "refined line art, confident contours, minimal shading" },
  { id: "vaporwave", label: "Vaporwave", suffix: "vaporwave palette, retro-futurist atmosphere, geometric accents" },
  { id: "documentary", label: "Documentary", suffix: "observational documentary photography, candid naturalism" },
  { id: "editorial", label: "Editorial", suffix: "polished editorial photography, magazine composition" },
  { id: "noir", label: "Film Noir", suffix: "film noir, hard chiaroscuro, deep shadows, monochrome mood" },
  { id: "watercolor", label: "Watercolor", suffix: "expressive watercolor, translucent washes, textured paper" },
  { id: "gouache", label: "Gouache", suffix: "hand-painted gouache, opaque color shapes, tactile brushwork" },
  { id: "concept", label: "Concept Art", suffix: "production concept art, readable silhouettes" },
  { id: "product", label: "Product", suffix: "premium product photography, controlled studio light" },
  { id: "surreal", label: "Surreal", suffix: "surreal visual logic, unexpected scale, coherent impossible scene" },
];

export const FRAMINGS: {
  id: FramingId;
  label: string;
  suffix: string;
  negative: string;
}[] = [
  { id: "auto", label: "Auto", suffix: "", negative: "" },
  {
    id: "extreme-wide",
    label: "Extreme wide",
    suffix:
      "extreme wide establishing shot, subject occupies 10–20% of frame, expansive environment",
    negative: "close-up, tight framing, cropped subject",
  },
  {
    id: "wide",
    label: "Wide",
    suffix: "wide environmental shot, complete subject with ample surroundings",
    negative: "close-up, tight framing",
  },
  {
    id: "full",
    label: "Full body",
    suffix: "full-body composition, head to toe with breathing room",
    negative: "cropped head, cropped feet, close-up",
  },
  {
    id: "medium",
    label: "Medium",
    suffix: "medium shot with balanced subject and context",
    negative: "extreme close-up",
  },
  {
    id: "close",
    label: "Close-up",
    suffix: "intentional close-up, primary detail fills the frame",
    negative: "distant subject",
  },
  {
    id: "macro",
    label: "Macro",
    suffix: "true macro detail, extreme material texture",
    negative: "distant view",
  },
];

export function applyDreamPreset(
  prompt: string,
  presetId: string | undefined,
): string {
  const preset = DREAM_PRESETS.find((p) => p.id === presetId);
  if (!preset) return prompt.trim();
  const base = prompt.trim();
  const suffix = `, ${preset.suffix}`;
  return base.endsWith(suffix) ? base : `${base}${suffix}`;
}

export function applyFraming(
  prompt: string,
  framingId: string | undefined,
): { prompt: string; negativeExtra: string } {
  const framing = FRAMINGS.find((f) => f.id === framingId) ?? FRAMINGS[0];
  if (!framing.suffix) return { prompt: prompt.trim(), negativeExtra: "" };
  return {
    prompt: `${prompt.trim()}, ${framing.suffix}`,
    negativeExtra: framing.negative,
  };
}
