import { encodePng } from "@/lib/art/png";

/* ------------------------------------------------------------------ noise */

function hash2(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = smooth(xf);
  const v = smooth(yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

function fbm(x: number, y: number, seed: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.07;
  }
  return sum / norm;
}

/* ---------------------------------------------------------------- palette */

type Rgb = [number, number, number];

function hslToRgb(h: number, s: number, l: number): Rgb {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Hex for a hue, so callers can hold one palette across a set of frames. */
export function hueToHex(hue: number, sat = 0.62, light = 0.55) {
  const [r, g, b] = hslToRgb(hue, sat, light);
  return `#${[r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60
    : max === g ? ((b - r) / d + 2) * 60
    : ((r - g) / d + 4) * 60;
  return [h, s, l];
}

/**
 * Five-stop ramp from shadow to light. The hue spread stays tight so the result
 * still reads as the accent colour instead of drifting to its neighbours.
 */
function buildRamp(baseHue: number, sat: number, mood: number): Rgb[] {
  const warm = baseHue + 14;
  const cool = baseHue - 18;
  return [
    hslToRgb(cool, sat * 0.6, 0.04 + mood * 0.02),
    hslToRgb(cool + 6, sat * 0.72, 0.14 + mood * 0.04),
    hslToRgb(baseHue, sat * 0.9, 0.36 + mood * 0.05),
    hslToRgb(warm, sat * 0.82, 0.62 + mood * 0.06),
    hslToRgb(warm + 8, sat * 0.4, 0.9),
  ];
}

/** Ridged noise reads as strata and cloud edges rather than soft blur. */
function ridged(x: number, y: number, seed: number, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(valueNoise(x * freq, y * freq, seed + i * 71) * 2 - 1);
    sum += n * n * amp;
    norm += amp;
    amp *= 0.55;
    freq *= 2.13;
  }
  return sum / norm;
}

function sampleRamp(ramp: Rgb[], t: number): Rgb {
  const clamped = Math.min(0.9999, Math.max(0, t));
  const scaled = clamped * (ramp.length - 1);
  const i = Math.floor(scaled);
  const f = scaled - i;
  const a = ramp[i];
  const b = ramp[i + 1];
  return [
    a[0] + (b[0] - a[0]) * f,
    a[1] + (b[1] - a[1]) * f,
    a[2] + (b[2] - a[2]) * f,
  ];
}

function seedFrom(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100000;
}

/* --------------------------------------------------------------- composition */

export type ArtSpec = {
  width: number;
  height: number;
  prompt: string;
  /** Hex like #d565d6. When present it anchors the palette hue. */
  accent?: string;
  /** Preset id — shifts structure and saturation. */
  style?: string;
  seed?: number;
};

const STRUCTURE: Record<string, { horizon: number; bloom: number; grain: number; sat: number }> = {
  photo: { horizon: 0.62, bloom: 0.5, grain: 0.05, sat: 0.5 },
  cinematic: { horizon: 0.58, bloom: 0.85, grain: 0.08, sat: 0.62 },
  documentary: { horizon: 0.6, bloom: 0.35, grain: 0.1, sat: 0.42 },
  anime: { horizon: 0.66, bloom: 0.7, grain: 0.02, sat: 0.8 },
  fantasy: { horizon: 0.55, bloom: 0.95, grain: 0.04, sat: 0.78 },
  vaporwave: { horizon: 0.5, bloom: 1.0, grain: 0.03, sat: 0.9 },
  noir: { horizon: 0.56, bloom: 0.4, grain: 0.14, sat: 0.12 },
  watercolor: { horizon: 0.64, bloom: 0.45, grain: 0.06, sat: 0.55 },
  concept: { horizon: 0.57, bloom: 0.75, grain: 0.06, sat: 0.65 },
  product: { horizon: 0.72, bloom: 0.6, grain: 0.03, sat: 0.45 },
  surreal: { horizon: 0.45, bloom: 0.9, grain: 0.05, sat: 0.82 },
  dream: { horizon: 0.55, bloom: 0.9, grain: 0.05, sat: 0.7 },
};

/**
 * Paints a frame from a prompt. Deterministic for a given prompt + seed, so the
 * same settings always reproduce the same image.
 */
export function renderArt(spec: ArtSpec): Buffer {
  const { width: w, height: h } = spec;
  const seed = spec.seed ?? seedFrom(spec.prompt);
  const s = STRUCTURE[spec.style || "dream"] ?? STRUCTURE.dream;

  const accentHsl = spec.accent ? hexToHsl(spec.accent) : null;
  const baseHue = accentHsl ? accentHsl[0] : (seed % 360);
  const sat = Math.min(0.95, s.sat + ((seed % 17) / 17) * 0.15);
  const mood = (seed % 23) / 23;
  const ramp = buildRamp(baseHue, sat, mood);

  // Four composition archetypes keep a set of cards from looking like one image.
  const archetype = (["atmosphere", "monolith", "horizon", "bloom"] as const)[
    (seed >> 19) % 4
  ];

  // Light source position, nudged off-centre by the seed.
  const lx = 0.22 + ((seed >> 3) % 56) / 100;
  const ly = 0.14 + ((seed >> 7) % 34) / 100;

  // Subject mass. Small and offset — it anchors the frame, it is not the frame.
  const sx = archetype === "monolith" ? (((seed >> 11) % 2) ? 0.28 : 0.72) : 0.5 + (((seed >> 11) % 34) - 17) / 100;
  const sy = s.horizon - 0.06;
  const sr = archetype === "bloom" ? 0.05 : 0.09 + ((seed >> 5) % 9) / 100;

  const horizon = s.horizon + (((seed >> 13) % 10) - 5) / 100;
  const warpAmt = 0.55 + ((seed >> 9) % 45) / 100;
  const scale = 2.6 + ((seed >> 17) % 26) / 10;
  const strata = archetype === "horizon" || archetype === "atmosphere";

  const rgb = new Uint8Array(w * h * 3);
  const aspect = w / h;

  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const ux = u * aspect;

      // Domain warp: run the field through a displaced copy of itself so the
      // structure curls instead of reading as straight gradient bands.
      const wx = fbm(ux * scale + 11.3, v * scale, seed + 7, 3);
      const wy = fbm(ux * scale, v * scale + 5.1, seed + 23, 3);
      const fx = ux * scale + (wx - 0.5) * warpAmt * 2;
      const fy = v * scale + (wy - 0.5) * warpAmt * 2;

      let field = fbm(fx, fy, seed, 5);

      // Ridged layer adds cloud edges and rock strata over the soft base.
      if (strata) {
        field = field * 0.62 + ridged(fx * 1.4, fy * 2.2, seed + 313, 4) * 0.38;
      }

      // Vertical atmosphere — denser toward the ground, open toward the light.
      const depth = Math.pow(Math.max(0, v - horizon + 0.5), 1.4);
      field = field * 0.72 + (1 - depth) * 0.28;

      // Key light falloff, stretched into a shaft rather than a perfect disc.
      const dlx = (u - lx) * aspect;
      const dly = (v - ly) * (archetype === "bloom" ? 1 : 1.9);
      const dl = Math.hypot(dlx, dly);
      const light = Math.exp(-dl * dl * (archetype === "bloom" ? 3.4 : 5.2)) * s.bloom;

      // Only the monolith carries a solid form. A radial blob in every frame
      // reads as a hole punched in the picture, so the rest stay atmospheric.
      let inside = 0;
      let rim = 0;
      if (archetype === "monolith") {
        const edge = Math.abs(u - sx) * aspect;
        const lean = (v - sy) * 0.06;
        const halfWidth = sr * (0.9 + v * 0.35) + lean;
        inside = 1 - smooth(Math.min(1, Math.max(0, (edge - halfWidth) / (sr * 0.3))));
        inside *= smooth(Math.min(1, Math.max(0, (v - (sy - 0.42)) / 0.16)));
        rim = Math.exp(-Math.pow((edge - halfWidth) / (sr * 0.16), 2)) * 0.34;
      }

      let t = field * 0.82 + light * 0.42 + rim;
      t -= inside * 0.5;

      // Ground plane sits darker and flatter than the sky.
      if (v > horizon) {
        const g = (v - horizon) / Math.max(0.0001, 1 - horizon);
        t = t * (1 - g * 0.55) - g * 0.12;
      }

      // Vignette.
      const dv = Math.hypot((u - 0.5) * aspect, v - 0.5);
      t -= Math.pow(dv * 0.95, 2.2) * 0.3;

      let [r, g, b] = sampleRamp(ramp, t);

      // Warm the lit side, cool the shadows — cheap but it reads as film.
      const grade = light * 26;
      r += grade;
      g += grade * 0.55;
      b -= grade * 0.18;
      b += (1 - t) * 14;

      // Grain on a 2px cell. Per-pixel noise is incompressible and triples the
      // PNG size for no visible gain at the sizes these are displayed at.
      if (s.grain > 0) {
        const n = (hash2(x >> 1, y >> 1, seed + 991) - 0.5) * 255 * s.grain;
        r += n;
        g += n;
        b += n;
      }

      const o = (y * w + x) * 3;
      rgb[o] = r < 0 ? 0 : r > 255 ? 255 : r;
      rgb[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      rgb[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  }

  return encodePng(w, h, rgb);
}
