import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { Image2Wrapper } from "@/lib/wrappers/catalog";
import { bakeSvgToPng, COMPOSE_FONTS } from "@/lib/compose/bake";
import { fitTextToBox } from "@/lib/compose/text-fit";
import { hexLuminance } from "@/lib/utils";

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

function readableTextColor(preferred: string, background: string) {
  const isHex = (value: string) => /^#[\da-f]{3}([\da-f]{3})?$/i.test(value);
  if (!isHex(preferred) || !isHex(background)) return preferred;
  const contrast = (foreground: string) => {
    const lighter = Math.max(
      hexLuminance(foreground),
      hexLuminance(background),
    );
    const darker = Math.min(
      hexLuminance(foreground),
      hexLuminance(background),
    );
    return (lighter + 0.05) / (darker + 0.05);
  };
  if (contrast(preferred) >= 4.5) return preferred;
  return contrast("#ffffff") >= contrast("#000000") ? "#ffffff" : "#000000";
}

type FittedTextSvgOptions = {
  role: string;
  clipPrefix: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  baselineY: number;
  maxFontSize: number;
  minFontSize: number;
  fill: string;
  family: string;
  maxLines?: number;
  lineHeight?: number;
  weight?: number;
  letterSpacing?: number;
  align?: "left" | "center" | "right";
  baselineMode?: "center" | "first";
};

function fittedTextSvg(options: FittedTextSvgOptions) {
  const fit = fitTextToBox(options.text, {
    family: options.family,
    weight: options.weight,
    letterSpacing: options.letterSpacing,
    maxFontSize: options.maxFontSize,
    minFontSize: options.minFontSize,
    maxWidth: options.width,
    maxHeight: options.height,
    maxLines: options.maxLines,
    lineHeight: options.lineHeight,
  });
  if (!fit.lines.length) return "";

  const align = options.align ?? "left";
  const textX =
    align === "center"
      ? options.x + options.width / 2
      : align === "right"
        ? options.x + options.width
        : options.x;
  const anchor =
    align === "center" ? "middle" : align === "right" ? "end" : "start";
  const lineAdvance = fit.fontSize * fit.lineHeight;
  const firstBaseline =
    options.baselineMode === "first"
      ? options.baselineY
      : options.baselineY - ((fit.lines.length - 1) * lineAdvance) / 2;
  const clipId = `${options.clipPrefix}-${options.role}`;
  const spans = fit.lines
    .map(
      (line, index) =>
        `<tspan x="${textX}" dy="${index === 0 ? 0 : lineAdvance}">${esc(line)}</tspan>`,
    )
    .join("");
  return `
    <defs><clipPath id="${clipId}"><rect x="${options.x}" y="${options.y}" width="${options.width}" height="${options.height}"/></clipPath></defs>
    <g data-role="${options.role}" data-truncated="${fit.truncated}" clip-path="url(#${clipId})">
      <text x="${textX}" y="${firstBaseline}" text-anchor="${anchor}" fill="${options.fill}" font-family="${options.family}" font-size="${fit.fontSize}" font-weight="${options.weight ?? 400}"${options.letterSpacing === undefined ? "" : ` letter-spacing="${options.letterSpacing}"`}>${spans}</text>
    </g>`;
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

export function renderCreativeSvg(args: ComposeInput): string {
  const { w, h } = sizeForAspect(args.aspect);
  const brand = args.values.brandName || args.wrapper.brandSample;
  const product = args.values.productName || "Product";
  const headline =
    args.values.headline ||
    args.values.cta ||
    args.wrapper.copyHints[0] ||
    args.values.productName ||
    "Product";
  const bodyRaw =
    args.values.bodyCopy ||
    args.values.productDescription ||
    args.values.venue ||
    args.wrapper.tagline;
  const cta = args.values.cta || "Shop now";
  const price = args.values.price || "";
  const preset = args.presetLabel;
  const accent = args.brand?.accent || args.wrapper.accent;
  const surface = args.brand?.surface || args.wrapper.surface;
  const textColor = readableTextColor(
    args.brand?.text || "#111111",
    surface,
  );
  const lightTextColor = readableTextColor("#ffffff", surface);
  const bodyTextColor = readableTextColor("#444444", surface);
  const mutedTextColor = readableTextColor("#555555", surface);
  const subtleTextColor = readableTextColor("#666666", surface);
  const accentTextColor = readableTextColor("#111111", accent);
  const accentOnDark = readableTextColor(accent, "#0b0b0b");
  const shopButtonColor = readableTextColor("#111111", surface);
  const shopButtonTextColor = readableTextColor("#ffffff", shopButtonColor);
  const sans = COMPOSE_FONTS.sans;
  const display = COMPOSE_FONTS.display;
  const mono = COMPOSE_FONTS.mono;

  const clipId = `subj-${args.jobId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const textClipPrefix = `copy-${args.jobId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const copyText = (
    options: Omit<FittedTextSvgOptions, "clipPrefix">,
  ) => fittedTextSvg({ ...options, clipPrefix: textClipPrefix });
  const img = args.subjectImageDataUri;
  const subjectAspectFit =
    args.wrapper.slug === "sports-lockup" && args.presetLabel === "Logo Mark"
      ? "xMidYMid meet"
      : "xMidYMid slice";
  const subjectImage = (
    x: number,
    y: number,
    sw: number,
    sh: number,
    rx = 18,
  ) =>
    img
      ? `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${rx}"/></clipPath></defs>
         <image href="${img}" x="${x}" y="${y}" width="${sw}" height="${sh}" preserveAspectRatio="${subjectAspectFit}" clip-path="url(#${clipId})"/>
         <rect x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${rx}" fill="none" stroke="#ffffff33" stroke-width="2"/>`
      : `<rect x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${rx}" fill="#00000022"/>`;

  let chrome = "";
  switch (args.wrapper.layout) {
    case "poster-cta":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.08, h * 0.22, w * 0.84, h * 0.52, 28)}
        <circle cx="${w * 0.82}" cy="${h * 0.16}" r="${Math.min(w, h) * 0.09}" fill="${accent}"/>
        <text x="${w * 0.82}" y="${h * 0.175}" text-anchor="middle" fill="${accentTextColor}" font-family="${sans}" font-size="${Math.round(w * 0.032)}" font-weight="700" transform="rotate(-14 ${w * 0.82} ${h * 0.16})">NEW</text>
        ${copyText({ role: "poster-brand", text: brand, x: w * 0.1, y: h * 0.04, width: w * 0.6, height: h * 0.12, baselineY: h * 0.12, maxFontSize: Math.round(w * 0.07), minFontSize: Math.round(w * 0.025), fill: lightTextColor, family: sans, weight: 700 })}
        <rect x="${w * 0.08}" y="${h * 0.8}" width="${w * 0.84}" height="${h * 0.14}" rx="20" fill="#0b0b0bee"/>
        ${copyText({ role: "poster-product", text: product, x: w * 0.12, y: h * 0.81, width: w * 0.76, height: h * 0.075, baselineY: h * 0.87, maxFontSize: Math.round(w * 0.048), minFontSize: Math.round(w * 0.02), fill: "#fff", family: sans, weight: 700 })}
        ${copyText({ role: "poster-cta", text: cta, x: w * 0.12, y: h * 0.885, width: w * 0.76, height: h * 0.05, baselineY: h * 0.915, maxFontSize: Math.round(w * 0.03), minFontSize: Math.round(w * 0.014), fill: accentOnDark, family: sans, weight: 600 })}
      `;
      break;
    case "editorial-split":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${copyText({ role: "editorial-brand", text: brand, x: w * 0.08, y: h * 0.025, width: w * 0.84, height: h * 0.08, baselineY: h * 0.08, maxFontSize: Math.round(w * 0.045), minFontSize: Math.round(w * 0.018), fill: textColor, family: display, letterSpacing: 6 })}
        ${subjectImage(w * 0.06, h * 0.14, w * 0.58, h * 0.62, 6)}
        ${copyText({ role: "editorial-headline", text: headline, x: w * 0.68, y: h * 0.2, width: w * 0.26, height: h * 0.13, baselineY: h * 0.28, maxFontSize: Math.round(w * 0.042), minFontSize: Math.round(w * 0.018), fill: textColor, family: display, maxLines: 2, lineHeight: 1.12, weight: 700 })}
        ${copyText({ role: "editorial-body", text: bodyRaw, x: w * 0.68, y: h * 0.34, width: w * 0.26, height: h * 0.4, baselineY: h * 0.36, maxFontSize: Math.round(w * 0.022), minFontSize: Math.round(w * 0.014), fill: bodyTextColor, family: sans, maxLines: 8, lineHeight: 1.45, baselineMode: "first" })}
        ${copyText({ role: "editorial-product", text: product, x: w * 0.08, y: h * 0.88, width: w * 0.84, height: h * 0.065, baselineY: h * 0.92, maxFontSize: Math.round(w * 0.022), minFontSize: Math.round(w * 0.012), fill: subtleTextColor, family: sans, weight: 600 })}
      `;
      break;
    case "event-stack":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.05, h * 0.06, w * 0.9, h * 0.52, 0)}
        <rect x="${w * 0.06}" y="${h * 0.62}" width="${w * 0.72}" height="${h * 0.08}" fill="${accent}"/>
        ${copyText({ role: "event-product", text: product.toUpperCase(), x: w * 0.08, y: h * 0.625, width: w * 0.68, height: h * 0.07, baselineY: h * 0.675, maxFontSize: Math.round(w * 0.045), minFontSize: Math.round(w * 0.018), fill: accentTextColor, family: sans, weight: 800 })}
        ${copyText({ role: "event-brand", text: brand, x: w * 0.08, y: h * 0.705, width: w * 0.84, height: h * 0.1, baselineY: h * 0.78, maxFontSize: Math.round(w * 0.09), minFontSize: Math.round(w * 0.025), fill: readableTextColor(accent, surface), family: sans, weight: 800 })}
        ${copyText({ role: "event-body", text: bodyRaw, x: w * 0.08, y: h * 0.84, width: w * 0.84, height: h * 0.1, baselineY: h * 0.88, maxFontSize: Math.round(w * 0.028), minFontSize: Math.round(w * 0.016), fill: readableTextColor("#dddddd", surface), family: mono, maxLines: 2, lineHeight: 1.45, weight: 500, baselineMode: "first" })}
      `;
      break;
    case "shop-banner":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.52, h * 0.08, w * 0.44, h * 0.84, 24)}
        ${copyText({ role: "shop-brand", text: brand, x: w * 0.06, y: h * 0.11, width: w * 0.42, height: h * 0.14, baselineY: h * 0.22, maxFontSize: Math.round(h * 0.1), minFontSize: Math.round(Math.min(w, h) * 0.025), fill: textColor, family: sans, weight: 700 })}
        ${copyText({ role: "shop-product", text: product, x: w * 0.06, y: h * 0.28, width: w * 0.42, height: h * 0.12, baselineY: h * 0.36, maxFontSize: Math.round(h * 0.07), minFontSize: Math.round(Math.min(w, h) * 0.024), fill: mutedTextColor, family: display })}
        ${
          price
            ? `<circle cx="${w * 0.14}" cy="${h * 0.52}" r="${h * 0.09}" fill="${accent}"/>${copyText({ role: "shop-price", text: price, x: w * 0.07, y: h * 0.45, width: w * 0.14, height: h * 0.14, baselineY: h * 0.535, maxFontSize: Math.round(h * 0.04), minFontSize: Math.round(Math.min(w, h) * 0.016), fill: accentTextColor, family: sans, weight: 700, align: "center" })}`
            : ""
        }
        <rect data-role="shop-cta-button" x="${w * 0.06}" y="${h * 0.7}" width="${w * 0.34}" height="${h * 0.14}" rx="14" fill="${shopButtonColor}"/>
        ${copyText({ role: "shop-cta", text: cta, x: w * 0.09, y: h * 0.715, width: w * 0.28, height: h * 0.11, baselineY: h * 0.79, maxFontSize: Math.round(h * 0.05), minFontSize: Math.round(Math.min(w, h) * 0.018), fill: shopButtonTextColor, family: sans, maxLines: 2, lineHeight: 1.15, weight: 600 })}
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
        ${copyText({ role: "tryon-product", text: product, x: w * 0.08, y: h * 0.11, width: w * 0.34, height: h * 0.07, baselineY: h * 0.16, maxFontSize: Math.round(w * 0.032), minFontSize: Math.round(w * 0.014), fill: "#fff", family: sans, weight: 700 })}
        <rect x="${w * 0.08}" y="${h * 0.8}" width="${w * 0.34}" height="${h * 0.08}" rx="12" fill="${accent}"/>
        ${copyText({ role: "tryon-cta", text: cta, x: w * 0.1, y: h * 0.81, width: w * 0.3, height: h * 0.06, baselineY: h * 0.855, maxFontSize: Math.round(w * 0.026), minFontSize: Math.round(w * 0.012), fill: readableTextColor("#052e16", accent), family: sans, weight: 700 })}
        ${copyText({ role: "tryon-brand", text: brand, x: w * 0.52, y: h * 0.11, width: w * 0.42, height: h * 0.07, baselineY: h * 0.16, maxFontSize: Math.round(w * 0.036), minFontSize: Math.round(w * 0.014), fill: readableTextColor("#e2e8f0", surface), family: sans, weight: 700 })}
        ${grid}
      `;
      break;
    }
    default:
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.12, h * 0.18, w * 0.76, h * 0.58, 20)}
        ${copyText({ role: "lockup-brand", text: brand, x: w * 0.08, y: h * 0.035, width: w * 0.84, height: h * 0.12, baselineY: h * 0.12, maxFontSize: Math.round(w * 0.08), minFontSize: Math.round(w * 0.025), fill: readableTextColor(accent, surface), family: sans, weight: 800 })}
        ${copyText({ role: "lockup-product", text: product, x: w * 0.08, y: h * 0.85, width: w * 0.84, height: h * 0.07, baselineY: h * 0.9, maxFontSize: Math.round(w * 0.036), minFontSize: Math.round(w * 0.016), fill: lightTextColor, family: sans, weight: 600 })}
      `;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  ${chrome}
  ${copyText({ role: "footer", text: `${args.wrapper.name} · ${preset}`, x: w * 0.06, y: h * 0.95, width: w * 0.88, height: h * 0.035, baselineY: h * 0.975, maxFontSize: Math.round(Math.min(w, h) * 0.016), minFontSize: Math.round(Math.min(w, h) * 0.008), fill: subtleTextColor, family: mono })}
</svg>`;
}

/**
 * Compose a finished campaign creative: layout chrome + subject → baked PNG.
 * Primary deliverable for Image-2 / marketing wrap paths.
 */
export async function composeCreative(
  args: ComposeInput,
): Promise<{ filename: string; url: string; bytes: number }> {
  const svg = renderCreativeSvg(args);
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
