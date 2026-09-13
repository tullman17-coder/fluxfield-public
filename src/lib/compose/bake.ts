import { createRequire } from "node:module";
import path from "path";

type ResvgCtor = typeof import("@resvg/resvg-js").Resvg;

function loadResvg(): ResvgCtor {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  return require("@resvg/resvg-js").Resvg as ResvgCtor;
}

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

/** Bake an SVG string to PNG bytes using bundled Fluxfield fonts. */
export async function bakeSvgToPng(svg: string): Promise<Buffer> {
  const Resvg = loadResvg();
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
