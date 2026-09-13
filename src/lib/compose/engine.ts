import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { Image2Wrapper } from "@/lib/wrappers/catalog";
import { bakeSvgToPng, COMPOSE_FONTS } from "@/lib/compose/bake";

export type BrandPalette = {
  primary?: string;
  secondary?: string;
  accent?: string;
  surface?: string;
  text?: string;
};

export type ComposeInput = {
  wrapper: Image2Wrapper;
  values: Record<string, string>;
  presetLabel: string;
  aspect: string;
  jobId: string;
  subjectHint?: string;
  subjectImageDataUri?: string;
  /** Optional brand kit colors override wrapper accent/surface */
  brand?: BrandPalette;
  /** Extra thumbnail data-URIs for try-on outfit grid */
  outfitThumbs?: string[];
};

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fitLine(text: string, maxChars: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars) break;
    line = next;
  }
  return line || words[0]!;
}

function textBlock(
  text: string,
  x: number,
  y: number,
  size: number,
  maxChars: number,
  fill: string,
  family: string,
  maxLines = 4,
  weight = 400,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (!line.length) line = word;
    else if (line.length + word.length + 1 <= maxChars) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const spans = lines
    .map(
      (l, i) =>
        `<tspan x="${x}" dy="${i === 0 ? 0 : size * 1.45}">${esc(l)}</tspan>`,
    )
    .join("");
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}">${spans}</text>`;
}

export function sizeForAspect(aspect: string): { w: number; h: number } {
  const map: Record<string, { w: number; h: number }> = {
    "1:1": { w: 1080, h: 1080 },
    "4:5": { w: 1080, h: 1350 },
    "9:16": { w: 1080, h: 1920 },
    "2:3": { w: 1080, h: 1620 },
    "16:9": { w: 1920, h: 1080 },
    "1.91:1": { w: 1200, h: 628 },
  };
  return map[aspect] ?? { w: 1080, h: 1350 };
}

/** Safe-zone plate as fractions of canvas — subjects should fill this region. */
export function safeZoneForLayout(
  layout: Image2Wrapper["layout"],
): { x: number; y: number; w: number; h: number } {
  switch (layout) {
    case "poster-cta":
      return { x: 0.08, y: 0.22, w: 0.84, h: 0.52 };
    case "editorial-split":
      return { x: 0.06, y: 0.14, w: 0.58, h: 0.62 };
    case "event-stack":
      return { x: 0.05, y: 0.06, w: 0.9, h: 0.52 };
    case "shop-banner":
      return { x: 0.52, y: 0.08, w: 0.44, h: 0.84 };
    case "tryon-ui":
      return { x: 0.06, y: 0.2, w: 0.38, h: 0.55 };
    case "jersey-lockup":
      return { x: 0.12, y: 0.18, w: 0.76, h: 0.58 };
    default:
      return { x: 0.1, y: 0.15, w: 0.8, h: 0.6 };
  }
}

function buildLayoutSvg(args: ComposeInput): string {
  const { w, h } = sizeForAspect(args.aspect);
  const brand = esc(
    fitLine(args.values.brandName || args.wrapper.brandSample, 28),
  );
  const product = esc(fitLine(args.values.productName || "Product", 36));
  const headline = esc(
    fitLine(
      args.values.headline ||
        args.values.cta ||
        args.wrapper.copyHints[0] ||
        args.values.productName ||
        "Product",
      32,
    ),
  );
  const bodyRaw = (
    args.values.bodyCopy ||
    args.values.productDescription ||
    args.values.venue ||
    args.wrapper.tagline
  )
    .split(/\s+/)
    .reduce((acc, word) => {
      const next = acc ? `${acc} ${word}` : word;
      return next.length <= 280 ? next : acc;
    }, "");
  const cta = esc(args.values.cta || "Shop now");
  const price = esc(args.values.price || "");
  const preset = esc(args.presetLabel);
  const accent = args.brand?.accent || args.wrapper.accent;
  const surface = args.brand?.surface || args.wrapper.surface;
  const textColor = args.brand?.text || "#111111";
  const sans = COMPOSE_FONTS.sans;
  const display = COMPOSE_FONTS.display;
  const mono = COMPOSE_FONTS.mono;

  const clipId = `subj-${args.jobId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const img = args.subjectImageDataUri;
  const subjectImage = (
    x: number,
    y: number,
    sw: number,
    sh: number,
    rx = 18,
  ) =>
    img
      ? `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${rx}"/></clipPath></defs>
         <image href="${img}" x="${x}" y="${y}" width="${sw}" height="${sh}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
         <rect x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${rx}" fill="none" stroke="#ffffff33" stroke-width="2"/>`
      : `<rect x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${rx}" fill="#00000022"/>`;

  let chrome = "";
  switch (args.wrapper.layout) {
    case "poster-cta":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.08, h * 0.22, w * 0.84, h * 0.52, 28)}
        <circle cx="${w * 0.82}" cy="${h * 0.16}" r="${Math.min(w, h) * 0.09}" fill="${accent}"/>
        <text x="${w * 0.82}" y="${h * 0.175}" text-anchor="middle" fill="#111" font-family="${sans}" font-size="${Math.round(w * 0.032)}" font-weight="700" transform="rotate(-14 ${w * 0.82} ${h * 0.16})">NEW</text>
        <text x="${w * 0.1}" y="${h * 0.12}" fill="#fff" font-family="${sans}" font-size="${Math.round(w * 0.07)}" font-weight="700">${brand}</text>
        <rect x="${w * 0.08}" y="${h * 0.8}" width="${w * 0.84}" height="${h * 0.14}" rx="20" fill="#0b0b0bee"/>
        <text x="${w * 0.12}" y="${h * 0.87}" fill="#fff" font-family="${sans}" font-size="${Math.round(w * 0.048)}" font-weight="700">${product}</text>
        <text x="${w * 0.12}" y="${h * 0.915}" fill="${accent}" font-family="${sans}" font-size="${Math.round(w * 0.03)}" font-weight="600">${cta}</text>
      `;
      break;
    case "editorial-split":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        <text x="${w * 0.08}" y="${h * 0.08}" fill="${textColor}" font-family="${display}" font-size="${Math.round(w * 0.045)}" letter-spacing="6">${brand}</text>
        ${subjectImage(w * 0.06, h * 0.14, w * 0.58, h * 0.62, 6)}
        <text x="${w * 0.68}" y="${h * 0.28}" fill="${textColor}" font-family="${display}" font-size="${Math.round(w * 0.042)}" font-weight="700">${headline}</text>
        ${textBlock(bodyRaw, w * 0.68, h * 0.36, Math.round(w * 0.022), 28, "#444", sans, 8)}
        <text x="${w * 0.08}" y="${h * 0.92}" fill="#666" font-family="${sans}" font-size="${Math.round(w * 0.022)}" font-weight="600">${product}</text>
      `;
      break;
    case "event-stack":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.05, h * 0.06, w * 0.9, h * 0.52, 0)}
        <rect x="${w * 0.06}" y="${h * 0.62}" width="${w * 0.72}" height="${h * 0.08}" fill="${accent}"/>
        <text x="${w * 0.08}" y="${h * 0.675}" fill="#111" font-family="${sans}" font-size="${Math.round(w * 0.045)}" font-weight="800">${product.toUpperCase()}</text>
        <text x="${w * 0.08}" y="${h * 0.78}" fill="${accent}" font-family="${sans}" font-size="${Math.round(w * 0.09)}" font-weight="800">${brand}</text>
        ${textBlock(bodyRaw, w * 0.08, h * 0.88, Math.round(w * 0.028), 36, "#ddd", mono, 2, 500)}
      `;
      break;
    case "shop-banner":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.52, h * 0.08, w * 0.44, h * 0.84, 24)}
        <text x="${w * 0.06}" y="${h * 0.22}" fill="${textColor}" font-family="${sans}" font-size="${Math.round(h * 0.1)}" font-weight="700">${brand}</text>
        <text x="${w * 0.06}" y="${h * 0.36}" fill="#555" font-family="${display}" font-size="${Math.round(h * 0.07)}">${product}</text>
        ${
          price
            ? `<circle cx="${w * 0.14}" cy="${h * 0.52}" r="${h * 0.09}" fill="${accent}"/><text x="${w * 0.14}" y="${h * 0.535}" text-anchor="middle" fill="#111" font-family="${sans}" font-size="${Math.round(h * 0.04)}" font-weight="700">${price}</text>`
            : ""
        }
        <rect x="${w * 0.06}" y="${h * 0.7}" width="${w * 0.34}" height="${h * 0.14}" rx="14" fill="#111"/>
        <text x="${w * 0.1}" y="${h * 0.79}" fill="#fff" font-family="${sans}" font-size="${Math.round(h * 0.05)}" font-weight="600">${cta}</text>
      `;
      break;
    case "tryon-ui": {
      const thumbs = args.outfitThumbs ?? [];
      const grid = [0, 1, 2, 3]
        .map((i) => {
          const x = w * 0.52 + (i % 2) * w * 0.2;
          const y = h * 0.24 + Math.floor(i / 2) * h * 0.28;
          const thumb = thumbs[i];
          if (thumb) {
            return `<image href="${thumb}" x="${x}" y="${y}" width="${w * 0.18}" height="${h * 0.22}" preserveAspectRatio="xMidYMid slice" rx="16"/>
              <rect x="${x}" y="${y}" width="${w * 0.18}" height="${h * 0.22}" rx="16" fill="none" stroke="#ffffff44"/>`;
          }
          return `<rect x="${x}" y="${y}" width="${w * 0.18}" height="${h * 0.22}" rx="16" fill="#334155"/>`;
        })
        .join("");
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        <rect x="${w * 0.04}" y="${h * 0.08}" width="${w * 0.42}" height="${h * 0.84}" rx="24" fill="#1e293b"/>
        ${subjectImage(w * 0.06, h * 0.2, w * 0.38, h * 0.55, 16)}
        <text x="${w * 0.08}" y="${h * 0.16}" fill="#fff" font-family="${sans}" font-size="${Math.round(w * 0.032)}" font-weight="700">${product}</text>
        <rect x="${w * 0.08}" y="${h * 0.8}" width="${w * 0.34}" height="${h * 0.08}" rx="12" fill="${accent}"/>
        <text x="${w * 0.12}" y="${h * 0.855}" fill="#052e16" font-family="${sans}" font-size="${Math.round(w * 0.026)}" font-weight="700">${cta}</text>
        <text x="${w * 0.52}" y="${h * 0.16}" fill="#e2e8f0" font-family="${sans}" font-size="${Math.round(w * 0.036)}" font-weight="700">${brand}</text>
        ${grid}
      `;
      break;
    }
    default:
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.12, h * 0.18, w * 0.76, h * 0.58, 20)}
        <text x="${w * 0.08}" y="${h * 0.12}" fill="${accent}" font-family="${sans}" font-size="${Math.round(w * 0.08)}" font-weight="800">${brand}</text>
        <text x="${w * 0.08}" y="${h * 0.9}" fill="#fff" font-family="${sans}" font-size="${Math.round(w * 0.036)}" font-weight="600">${product}</text>
      `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${chrome}
  <text x="${w * 0.06}" y="${h * 0.975}" fill="#ffffff66" font-family="${mono}" font-size="${Math.round(Math.min(w, h) * 0.016)}">${esc(args.wrapper.name)} · ${preset}</text>
</svg>`;
}

/**
 * Compose a finished campaign creative: layout chrome + subject → baked PNG.
 * Primary deliverable for Image-2 / marketing wrap paths.
 */
export async function composeCreative(
  args: ComposeInput,
): Promise<{ filename: string; url: string; bytes: number }> {
  const svg = buildLayoutSvg(args);
  const png = await bakeSvgToPng(svg);
  const id = nanoid(8);
  const filename = `${args.jobId}-${id}.png`;
  const outDir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, filename), png);
  return {
    filename,
    url: `/api/outputs/${filename}`,
    bytes: png.byteLength,
  };
}

/** @deprecated Prefer composeCreative — kept for callers mid-migration. */
export async function composeWrapperSvg(args: ComposeInput) {
  return composeCreative(args);
}
