import path from "path";
import { Resvg } from "@resvg/resvg-js";

const FONT_DIR = path.join(process.cwd(), "public", "fonts");

export const COMPOSE_FONTS = {
  sans: "Inter",
  display: "Fraunces",
  mono: "Geist Mono",
} as const;

const FONT_FILES = [
  "Inter-Regular.ttf",
  "Inter-Bold.ttf",
  "Fraunces-Bold.ttf",
  "GeistMono-Regular.ttf",
].map((file) => path.join(FONT_DIR, file));

const textWidthCache = new Map<string, number>();

export type SvgTextMeasureOptions = {
  family: string;
  size: number;
  weight?: number;
  letterSpacing?: number;
};

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Measure the rendered text bounds with the same SVG engine and fonts as bake. */
export function measureSvgText(
  text: string,
  options: SvgTextMeasureOptions,
): number {
  if (!text) return 0;
  const key = JSON.stringify([text, options]);
  const cached = textWidthCache.get(key);
  if (cached !== undefined) return cached;

  const size = Math.max(1, options.size);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="${Math.ceil(size * 4)}"><text x="0" y="${Math.ceil(size * 2)}" font-family="${escapeSvgText(options.family)}" font-size="${size}" font-weight="${options.weight ?? 400}"${options.letterSpacing === undefined ? "" : ` letter-spacing="${options.letterSpacing}"`}>${escapeSvgText(text)}</text></svg>`;
  const bbox = new Resvg(svg, {
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: COMPOSE_FONTS.sans,
    },
  }).getBBox();
  const width = bbox
    ? Math.max(0, bbox.x + bbox.width) - Math.min(0, bbox.x)
    : 0;
  if (textWidthCache.size >= 2_000) {
    const oldestKey = textWidthCache.keys().next().value;
    if (oldestKey !== undefined) textWidthCache.delete(oldestKey);
  }
  textWidthCache.set(key, width);
  return width;
}

/** Bake an SVG string to PNG bytes using bundled Fluxfield fonts. */
export async function bakeSvgToPng(svg: string): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: true,
      defaultFontFamily: COMPOSE_FONTS.sans,
    },
  });
  return Buffer.from(resvg.render().asPng());
}
