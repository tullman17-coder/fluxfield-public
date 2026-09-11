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

/* ---- Dream Studio workbench port: ratios, framing resolve, prompt assist ---- */

export type DreamRatioId =
  | "square"
  | "portrait"
  | "tall"
  | "landscape"
  | "wide"
  | "ultrawide";

export const DREAM_RATIOS: {
  id: DreamRatioId;
  label: string;
  width: number;
  height: number;
  aspect: string;
}[] = [
  { id: "square", label: "Square", width: 1024, height: 1024, aspect: "1:1" },
  { id: "portrait", label: "Portrait", width: 832, height: 1216, aspect: "2:3" },
  { id: "tall", label: "Tall", width: 768, height: 1344, aspect: "9:16" },
  { id: "landscape", label: "Landscape", width: 1216, height: 832, aspect: "3:2" },
  { id: "wide", label: "Wide", width: 1344, height: 768, aspect: "16:9" },
  { id: "ultrawide", label: "Ultrawide", width: 1536, height: 640, aspect: "21:9" },
];

export function dreamRatio(id: string | undefined) {
  return DREAM_RATIOS.find((r) => r.id === id) ?? DREAM_RATIOS[0];
}

/** Auto-detect framing from prompt wording (ported from local-dream-studio). */
export function resolveFraming(prompt: string, requested: string): FramingId {
  if (requested && requested !== "auto") return requested as FramingId;
  const text = prompt.toLowerCase();
  if (/\b(extreme[- ]wide|ultra[- ]?wide|wide[- ]angle|far[- ]out|far away|distant view|long shot|establishing shot|panoramic)\b/.test(text))
    return "extreme-wide";
  if (/\b(wide shot|environmental shot)\b/.test(text)) return "wide";
  if (/\b(full[- ]body|head to toe)\b/.test(text)) return "full";
  if (/\b(medium shot|waist[- ]up)\b/.test(text)) return "medium";
  if (/\b(close[- ]?up|headshot|tight portrait)\b/.test(text)) return "close";
  if (/\b(macro|microscopic|extreme detail)\b/.test(text)) return "macro";
  return "auto";
}

const PERSON_WORDS =
  /\b(person|people|woman|man|girl|boy|child|human|portrait|character|dancer|warrior|astronaut|hands?|feet|face)\b/;
const ENV_WORDS =
  /\b(background|environment|room|street|forest|mountain|city|landscape|interior|exterior|sky|sea|ocean|field|studio|space)\b/;
const LIGHT_WORDS =
  /\b(light|lighting|sun|moon|glow|shadow|dawn|dusk|night|daylight|backlit|rim[- ]light|chiaroscuro)\b/;

/**
 * Deterministic prompt assist (ported): preset suffix + resolved framing +
 * fills for missing environment / lighting / structure.
 */
export function enhancePrompt(
  prompt: string,
  presetId: string,
  requestedFraming: string,
  enabled: boolean,
): string {
  const styled = applyDreamPreset(prompt, presetId);
  const framing =
    requestedFraming === "auto" && !enabled
      ? "auto"
      : resolveFraming(prompt, requestedFraming);
  const framingDef = FRAMINGS.find((f) => f.id === framing) ?? FRAMINGS[0];
  const composed = [styled, framingDef.suffix].filter(Boolean).join(", ");
  if (!enabled) return composed;

  const additions: string[] = [];
  if (!ENV_WORDS.test(prompt.toLowerCase())) {
    additions.push(
      "fully described environment with foreground, middle ground, and background",
    );
  }
  if (!LIGHT_WORDS.test(prompt.toLowerCase())) {
    additions.push(
      "intentional directional lighting with believable shadow direction",
    );
  }
  if (PERSON_WORDS.test(prompt.toLowerCase())) {
    additions.push(
      "anatomically coherent body, natural hands and limbs, consistent facial features",
    );
  } else {
    additions.push(
      "coherent structure, physically plausible geometry, consistent perspective, clean silhouettes",
    );
  }
  return [composed, ...additions].join(", ");
}

export function enhanceNegativePrompt(
  prompt: string,
  negativePrompt: string,
  requestedFraming: string,
  enabled: boolean,
): string {
  const userNegative = negativePrompt.trim();
  const framing =
    requestedFraming === "auto" && !enabled
      ? "auto"
      : resolveFraming(prompt, requestedFraming);
  const framingNegative =
    FRAMINGS.find((f) => f.id === framing)?.negative ?? "";
  if (!enabled)
    return [userNegative, framingNegative].filter(Boolean).join(", ");
  const defects = PERSON_WORDS.test(prompt.toLowerCase())
    ? "mutated anatomy, extra limbs, missing limbs, fused fingers, duplicated features, inconsistent face"
    : "warped geometry, duplicated objects, fused forms, inconsistent perspective, malformed structure";
  const outputArtifacts =
    "text, watermark, logo, signature, caption, UI elements, border";
  return [userNegative, defects, outputArtifacts, framingNegative]
    .filter(Boolean)
    .join(", ");
}
