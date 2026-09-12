import { encodePng } from "@/lib/art/png";
import { subjectFor, type Material, type Subject } from "@/lib/art/subjects";

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

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 1 when x is past `edge0`, 0 before `edge1`, eased between. */
function step(edge0: number, edge1: number, x: number) {
  return smooth(clamp01((x - edge0) / (edge1 - edge0)));
}

type Finish = {
  /** How much the surface buckles into folds. */
  fold: number;
  foldScale: number;
  /** Highlight tightness and strength. */
  shine: number;
  shineAmount: number;
  /** Stitched seam following the outline, for anything made of fabric. */
  seam: boolean;
};

const FINISH: Record<Material, Finish> = {
  cloth: { fold: 0.2, foldScale: 15, shine: 16, shineAmount: 0.09, seam: true },
  knit: { fold: 0.26, foldScale: 22, shine: 10, shineAmount: 0.06, seam: true },
  hard: { fold: 0.04, foldScale: 9, shine: 46, shineAmount: 0.32, seam: false },
  skin: { fold: 0.09, foldScale: 11, shine: 22, shineAmount: 0.14, seam: false },
  glaze: { fold: 0.05, foldScale: 9, shine: 60, shineAmount: 0.42, seam: false },
  glass: { fold: 0.04, foldScale: 7, shine: 86, shineAmount: 0.55, seam: false },
};

const TOON = new Set(["anime", "vaporwave"]);

/**
 * Paints a single object on a studio sweep. Used whenever the brief names a
 * thing — a hoodie, a chair, a mug — so the frame comes back with that object
 * in it rather than weather.
 */
function renderSubjectScene(
  spec: ArtSpec,
  subject: Subject,
  seed: number,
  s: (typeof STRUCTURE)[string],
  baseHue: number,
  sat: number,
  mood: number,
): Buffer {
  const { width: w, height: h } = spec;
  const aspect = w / h;

  // The backdrop stays muted so the object is the thing you look at. The object
  // itself sits below full saturation — pushed any higher it stops reading as a
  // material and starts reading as coloured glass.
  const backdrop = buildRamp(baseHue - 8, sat * 0.28, mood * 0.6);
  const surface = buildRamp(baseHue, Math.min(0.7, sat * 0.72), mood);

  const finish = FINISH[subject.material];
  const toon = TOON.has(spec.style || "");

  // Object placement, nudged off dead centre so the frame has somewhere to
  // breathe for type.
  const fitH = 0.66 + ((seed >> 5) % 8) / 100;
  const cx = 0.5 + (((seed >> 11) % 13) - 6) / 100;
  const cy = 0.5 + (((seed >> 15) % 7) - 3) / 100;

  // Key light, upper left by default.
  const jitter = (((seed >> 3) % 40) - 20) / 100;
  let Lx = -0.46 + jitter;
  let Ly = -0.62;
  let Lz = 0.64;
  const Ll = Math.hypot(Lx, Ly, Lz);
  Lx /= Ll;
  Ly /= Ll;
  Lz /= Ll;

  // Half vector against a viewer straight on, for highlights.
  let Hx = Lx;
  let Hy = Ly;
  let Hz = Lz + 1;
  const Hl = Math.hypot(Hx, Hy, Hz);
  Hx /= Hl;
  Hy /= Hl;
  Hz /= Hl;

  const px = 1 / (h * fitH);
  const grad = Math.max(px * 1.5, 0.0035);
  const floorY = cy + fitH * 0.47;

  const rgb = new Uint8Array(w * h * 3);

  for (let y = 0; y < h; y++) {
    const v = y / h;
    const sy = (v - cy) / fitH;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const sx = ((u - cx) * aspect) / fitH;

      /* ---------------------------------------------------------- backdrop */

      const poolX = (u - 0.5) * aspect;
      const poolY = v - 0.36;
      const pool = Math.exp(-(poolX * poolX * 2.2 + poolY * poolY * 3)) * s.bloom;
      let bt = 0.17 + pool * 0.4;
      if (v > floorY) bt -= ((v - floorY) / Math.max(0.0001, 1 - floorY)) * 0.2;
      bt += (fbm(u * 3 * aspect, v * 3, seed + 55, 3) - 0.5) * 0.05;

      // Shadow cast by the object's own outline, offset with the key light.
      const shd = subject.sdf(sx - 0.035, sy - 0.03);
      bt -= (1 - step(-0.02, 0.14, shd)) * 0.17;

      // Where it meets the floor.
      const contactX = (u - cx) * aspect;
      const contactY = (v - floorY) * 5.5;
      bt -= Math.exp(-(contactX * contactX * 7 + contactY * contactY)) * 0.16;

      let [r, g, b] = sampleRamp(backdrop, bt);

      /* ------------------------------------------------------------ object */

      const d = subject.sdf(sx, sy);
      const cover = 1 - step(-px * 1.2, px * 1.2, d);

      if (cover > 0.002) {
        // Outward normal from the field gradient.
        const bx = subject.sdf(sx + grad, sy) - subject.sdf(sx - grad, sy);
        const by = subject.sdf(sx, sy + grad) - subject.sdf(sx, sy - grad);
        const bl = Math.hypot(bx, by) || 1;

        // Where two parts merge the field flattens out, which is exactly where
        // a real object would be in shadow. Read this off the plain shape —
        // measuring it after the folds go on turns fabric texture into blotches.
        const crease = clamp01(1 - bl / (2 * grad));

        let nx = bx / bl;
        let ny = by / bl;

        // Folds and weave ride on top of the surface normal.
        if (finish.fold > 0) {
          const fs = finish.foldScale;
          nx += (fbm(sx * fs + 3.1, sy * fs, seed + 17, 3) - 0.5) * finish.fold;
          ny += (fbm(sx * fs, sy * fs + 7.7, seed + 41, 3) - 0.5) * finish.fold;
          const fl = Math.hypot(nx, ny) || 1;
          nx /= fl;
          ny /= fl;
        }

        // Treat the outline as the edge of a rounded body: dead-on at the
        // centre, turning away toward the silhouette.
        const depth = clamp01(-d / subject.puff);
        const Nz = Math.sqrt(depth);
        const lat = Math.sqrt(Math.max(0, 1 - depth));
        const Nx = nx * lat;
        const Ny = ny * lat;

        let diffuse = Math.max(0, Nx * Lx + Ny * Ly + Nz * Lz);
        if (toon) diffuse = Math.round(diffuse * 3) / 3;

        const specDot = Math.max(0, Nx * Hx + Ny * Hy + Nz * Hz);
        const spec = Math.pow(specDot, finish.shine) * finish.shineAmount;

        // A broad falloff across the whole object. Without this a flat panel
        // lights evenly and comes out looking like a picture frame: bright in
        // the middle, dark band all round.
        const across = sx * Lx + sy * Ly;
        const form = clamp01(0.5 + across * 0.85);

        // Light catching the edge that faces away from the key, which is what
        // lifts the object off the backdrop.
        const facing = clamp01(-(Nx * Lx + Ny * Ly));
        const rim = Math.pow(1 - depth, 3.5) * (0.12 + facing * 0.42);

        // Wide enough a spread that the object carries real shadow and real
        // highlight, instead of sitting in a narrow band of one colour.
        let t = 0.04 + diffuse * 0.5 + form * 0.34 + spec + rim * 0.32;

        if (finish.seam) {
          // A stitch line just inside the outline.
          const inner = Math.abs(d + 0.018);
          t -= (1 - step(0.003, 0.009, inner)) * 0.09;
        }

        t -= crease * 0.14;

        const [sr, sg, sb] = sampleRamp(surface, t);
        r += (sr - r) * cover;
        g += (sg - g) * cover;
        b += (sb - b) * cover;
      }

      /* ------------------------------------------------------------ finish */

      const dv = Math.hypot((u - 0.5) * aspect, v - 0.5);
      const vig = Math.pow(dv * 0.9, 2.4) * 0.28;
      r -= vig * 255 * 0.35;
      g -= vig * 255 * 0.35;
      b -= vig * 255 * 0.35;

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

  // When the brief names an object, paint the object. Only briefs about places
  // and moods fall through to the atmospheric treatment below.
  const subject = subjectFor(spec.prompt);
  if (subject) {
    return renderSubjectScene(spec, subject, seed, s, baseHue, sat, mood);
  }

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
