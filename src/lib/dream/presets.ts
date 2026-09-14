/**
 * Style presets + framing suffixes ported from local-dream-studio.
 * Used to enrich Fluxfield prompts before Comfy / Local Studio / mock.
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
  example: string;
}[] = [
  { id: "dream", example: "A moonlit observatory above a quiet sea", label: "Dream", suffix: "soft dreamlike atmosphere, luminous details" },
  { id: "photo", example: "A ceramic cup beside a sunlit window", label: "Photo", suffix: "natural light, realistic texture, photographic composition" },
  { id: "anime", example: "A traveler at a rain-lit train station", label: "Anime", suffix: "expressive anime illustration, clean cel shading" },
  { id: "fantasy", example: "A stone bridge over a dragon valley", label: "Fantasy", suffix: "mythic fantasy art, intricate worldbuilding" },
  { id: "cinematic", example: "A coastal workshop lit by molten glass", label: "Cinematic", suffix: "cinematic lighting, dramatic composition, rich color grading" },
  { id: "pixel", example: "A tiny arcade beside a night market", label: "Pixel", suffix: "pixel art, crisp clusters, limited color palette" },
  { id: "line", example: "An ink city scene with clean contours", label: "Line", suffix: "refined line art, confident contours, minimal shading" },
  { id: "vaporwave", example: "A pink sunset over a retro arcade", label: "Vaporwave", suffix: "vaporwave palette, retro-futurist atmosphere, geometric accents" },
  { id: "documentary", example: "A baker opening a neighborhood shop", label: "Documentary", suffix: "observational documentary photography, candid naturalism" },
  { id: "editorial", example: "A sculptural chair on a magazine set", label: "Editorial", suffix: "polished editorial photography, magazine composition" },
  { id: "noir", example: "A detective under a streetlamp", label: "Film Noir", suffix: "film noir, hard chiaroscuro, deep shadows, monochrome mood" },
  { id: "watercolor", example: "A harbor painted in translucent washes", label: "Watercolor", suffix: "expressive watercolor, translucent washes, textured paper" },
  { id: "gouache", example: "A fruit market in opaque painted shapes", label: "Gouache", suffix: "hand-painted gouache, opaque color shapes, tactile brushwork" },
  { id: "concept", example: "A research outpost on an icy moon", label: "Concept Art", suffix: "production concept art, readable silhouettes" },
  { id: "product", example: "A studio product photograph of a watch", label: "Product", suffix: "premium product photography, controlled studio light" },
  { id: "surreal", example: "A staircase floating above a still lake", label: "Surreal", suffix: "surreal visual logic, unexpected scale, coherent impossible scene" },
];

/**
 * Adult style descriptions, shown only after explicit category opt-in.
 * These are prompt styles, not separate models or capability guarantees.
 */
export const MATURE_PRESETS: {
  id: string;
  label: string;
  suffix: string;
  example: string;
}[] = [
  {
    id: "boudoir",
    example: "An adult portrait in a softly lit dressing room",
    label: "Boudoir",
    suffix:
      "boudoir photography, low warm light, intimate interior, shallow depth of field",
  },
  {
    id: "figure",
    example: "An adult pose study with sculptural lighting",
    label: "Figure study",
    suffix:
      "classical figure study, sculptural form, single directional light, art academy tone",
  },
  {
    id: "pinup",
    example: "An adult in a vintage fashion illustration",
    label: "Pin-up",
    suffix:
      "mid-century pin-up illustration, bold flat colour, playful posing, painted highlights",
  },
  {
    id: "grindhouse",
    example: "A weathered midnight cinema poster",
    label: "Grindhouse",
    suffix:
      "grindhouse film still, heavy grain, blown highlights, scratched print, lurid colour",
  },
  {
    id: "body-horror",
    example: "An unsettling practical-effects creature silhouette",
    label: "Body horror",
    suffix:
      "practical-effects body horror, latex and resin texture, clinical light, unsettling anatomy",
  },
];

/**
 * Content terms Fluxfield adds on its own. With unrestricted mode on these
 * come back out, including any the layout catalog carries.
 */
const CONTENT_FILTER_TERMS = [
  "nsfw",
  "nude",
  "nudity",
  "explicit",
  "sexual",
  "suggestive",
  "gore",
  "blood",
];

export function stripContentFilters(negative: string): string {
  return negative
    .split(",")
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        !CONTENT_FILTER_TERMS.includes(part.toLowerCase()),
    )
    .join(", ");
}

export function dreamPresets(unrestricted: boolean) {
  return unrestricted ? [...DREAM_PRESETS, ...MATURE_PRESETS] : DREAM_PRESETS;
}

export function visibleDreamPresets(unrestricted: boolean, adult = false) {
  return unrestricted && adult ? MATURE_PRESETS : DREAM_PRESETS;
}

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
  const preset = [...DREAM_PRESETS, ...MATURE_PRESETS].find(
    (p) => p.id === presetId,
  );
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
  /\b(person|people|woman|man|girl|boy|child|human|portrait|character|dancer|warrior|astronaut|hands?|feet|face|avatar|model|athlete|creature|organism|anthropomorphic|humanoid|being|figure|android|elf|orc|goblin|mermaid|centaur|furry)\b/;

export function promptHasFigure(prompt: string): boolean {
  return PERSON_WORDS.test(prompt.toLowerCase());
}
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
      "correct anthropomorphic anatomy: matching pair of eyes, intact face, the right number of limbs, natural hands and fingers",
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
    ? "extra limbs, missing limbs, fused fingers, extra digits, crossed or missing eyes, collapsed face, mismatched pupils, broken jaw"
    : "warped geometry, duplicated objects, fused forms, inconsistent perspective, malformed structure";
  return [userNegative, defects, "watermark, blurry, low-res", framingNegative]
    .filter(Boolean)
    .join(", ");
}
