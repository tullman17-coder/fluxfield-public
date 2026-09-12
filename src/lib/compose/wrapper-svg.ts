import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { Image2Wrapper } from "@/lib/wrappers/catalog";

function esc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Wrap a paragraph into tspans. Browsers drop foreignObject when an SVG is
 * shown through an <img>, so body copy has to be laid out here.
 */
function textBlock(
  text: string,
  x: number,
  y: number,
  size: number,
  maxChars: number,
  fill: string,
  family: string,
  maxLines = 4,
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
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}">${spans}</text>`;
}

function sizeForAspect(aspect: string): { w: number; h: number } {
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

/** Compose a marketing wrapper shell around a generated (or mock) subject. */
export async function composeWrapperSvg(args: {
  wrapper: Image2Wrapper;
  values: Record<string, string>;
  presetLabel: string;
  aspect: string;
  jobId: string;
  subjectHint?: string;
  /** data: URI of the real generated image — embedded into the chrome when present */
  subjectImageDataUri?: string;
}): Promise<{ filename: string; url: string }> {
  const { w, h } = sizeForAspect(args.aspect);
  const brand = esc(args.values.brandName || args.wrapper.brandSample);
  const product = esc(args.values.productName || "Product");
  const headline = esc(
    args.values.headline ||
      args.values.cta ||
      args.wrapper.copyHints[0] ||
      product,
  );
  const bodyRaw = (
    args.values.bodyCopy ||
    args.values.productDescription ||
    args.values.venue ||
    args.wrapper.tagline
  ).slice(0, 280);
  const body = esc(bodyRaw);
  const cta = esc(args.values.cta || "Shop now");
  const price = esc(args.values.price || "");
  const preset = esc(args.presetLabel);
  const accent = args.wrapper.accent;
  const surface = args.wrapper.surface;

  // True generated subject, clipped into each layout's image zone
  const clipId = `subj-${args.jobId}`;
  const img = args.subjectImageDataUri;
  const subjectImage = (x: number, y: number, sw: number, sh: number, rx = 18) =>
    img
      ? `<clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${rx}"/></clipPath>
         <image href="${img}" x="${x}" y="${y}" width="${sw}" height="${sh}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
         <rect x="${x}" y="${y}" width="${sw}" height="${sh}" rx="${rx}" fill="none" stroke="#ffffff22"/>`
      : "";

  let chrome = "";
  switch (args.wrapper.layout) {
    case "poster-cta":
      chrome = `
        <rect x="0" y="0" width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.08, h * 0.24, w * 0.84, h * 0.5, 24)}
        <circle cx="${w * 0.82}" cy="${h * 0.18}" r="${Math.min(w, h) * 0.16}" fill="${accent}" opacity="0.95"/>
        <text x="${w * 0.72}" y="${h * 0.2}" fill="#111" font-family="Impact, sans-serif" font-size="${Math.round(w * 0.045)}" transform="rotate(-12 ${w * 0.82} ${h * 0.18})">NEW</text>
        <rect x="${w * 0.08}" y="${h * 0.12}" width="${w * 0.55}" height="${h * 0.08}" rx="8" fill="#00000055"/>
        <text x="${w * 0.11}" y="${h * 0.175}" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="${Math.round(w * 0.055)}" font-weight="700">${brand}</text>
        <rect x="${w * 0.08}" y="${h * 0.78}" width="${w * 0.84}" height="${h * 0.14}" rx="18" fill="#0b0b0bcc"/>
        <text x="${w * 0.12}" y="${h * 0.86}" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="${Math.round(w * 0.045)}" font-weight="700">${product}</text>
        <text x="${w * 0.12}" y="${h * 0.91}" fill="${accent}" font-family="ui-sans-serif,system-ui" font-size="${Math.round(w * 0.032)}">${cta}</text>
      `;
      break;
    case "editorial-split":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        <text x="${w * 0.08}" y="${h * 0.08}" fill="#111" font-family="Georgia, serif" font-size="${Math.round(w * 0.035)}" letter-spacing="4">${brand}</text>
        ${img ? subjectImage(w * 0.08, h * 0.12, w * 0.84, h * 0.48, 4) : `<rect x="${w * 0.08}" y="${h * 0.12}" width="${w * 0.84}" height="${h * 0.48}" rx="4" fill="#dbe4ee"/>`}
        <text x="${w * 0.08}" y="${h * 0.7}" fill="#111" font-family="Georgia, serif" font-size="${Math.round(w * 0.055)}" font-weight="700">${headline}</text>
        ${textBlock(bodyRaw, w * 0.08, h * 0.76, Math.round(w * 0.028), 48, "#333", "Georgia, serif")}
      `;
      break;
    case "event-stack":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${img ? subjectImage(w * 0.06, h * 0.08, w * 0.88, h * 0.55, 0) : `<rect x="${w * 0.06}" y="${h * 0.08}" width="${w * 0.88}" height="${h * 0.55}" fill="#222"/>`}
        <text x="${w * 0.08}" y="${h * 0.72}" fill="${accent}" font-family="Impact, sans-serif" font-size="${Math.round(w * 0.07)}">${brand}</text>
        <text x="${w * 0.08}" y="${h * 0.78}" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="${Math.round(w * 0.035)}">${product}</text>
        <text x="${w * 0.08}" y="${h * 0.86}" fill="#ccc" font-family="ui-monospace,monospace" font-size="${Math.round(w * 0.028)}">${body}</text>
      `;
      break;
    case "shop-banner":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.55, h * 0.1, w * 0.4, h * 0.8, 20)}
        <text x="${w * 0.06}" y="${h * 0.22}" fill="#111" font-family="ui-sans-serif,system-ui" font-size="${Math.round(h * 0.12)}" font-weight="700">${brand}</text>
        <text x="${w * 0.06}" y="${h * 0.4}" fill="#444" font-family="ui-sans-serif,system-ui" font-size="${Math.round(h * 0.06)}">${product}</text>
        ${price ? `<rect x="${w * 0.06}" y="${h * 0.48}" width="${w * 0.22}" height="${h * 0.14}" rx="999" fill="#111"/><text x="${w * 0.09}" y="${h * 0.575}" fill="#fff" font-size="${Math.round(h * 0.055)}" font-family="ui-sans-serif,system-ui">${price}</text>` : ""}
        <rect x="${w * 0.06}" y="${h * 0.72}" width="${w * 0.32}" height="${h * 0.16}" rx="12" fill="#111"/>
        <text x="${w * 0.1}" y="${h * 0.825}" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="${Math.round(h * 0.055)}">${cta}</text>
        ${img ? "" : `<circle cx="${w * 0.72}" cy="${h * 0.5}" r="${Math.min(w, h) * 0.22}" fill="${accent}55"/>`}
      `;
      break;
    case "tryon-ui":
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        <rect x="${w * 0.04}" y="${h * 0.08}" width="${w * 0.42}" height="${h * 0.84}" rx="24" fill="#1e293b"/>
        ${subjectImage(w * 0.06, h * 0.24, w * 0.38, h * 0.5, 16)}
        <text x="${w * 0.08}" y="${h * 0.18}" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="${Math.round(w * 0.035)}" font-weight="700">${product}</text>
        <rect x="${w * 0.08}" y="${h * 0.78}" width="${w * 0.34}" height="${h * 0.08}" rx="12" fill="${accent}"/>
        <text x="${w * 0.12}" y="${h * 0.835}" fill="#052e16" font-family="ui-sans-serif,system-ui" font-size="${Math.round(w * 0.028)}" font-weight="700">${cta}</text>
        <text x="${w * 0.52}" y="${h * 0.16}" fill="#e2e8f0" font-family="ui-sans-serif,system-ui" font-size="${Math.round(w * 0.04)}" font-weight="700">${brand}</text>
        ${[0, 1, 2, 3].map((i) => {
          const x = w * 0.52 + (i % 2) * w * 0.2;
          const y = h * 0.24 + Math.floor(i / 2) * h * 0.28;
          return `<rect x="${x}" y="${y}" width="${w * 0.18}" height="${h * 0.22}" rx="16" fill="#334155"/>`;
        }).join("")}
      `;
      break;
    default:
      chrome = `
        <rect width="${w}" height="${h}" fill="${surface}"/>
        ${subjectImage(w * 0.15, h * 0.2, w * 0.7, h * 0.5, 24)}
        <text x="${w * 0.08}" y="${h * 0.14}" fill="${accent}" font-family="Impact, sans-serif" font-size="${Math.round(w * 0.09)}">${brand}</text>
        <text x="${w * 0.08}" y="${h * 0.9}" fill="#fff" font-family="ui-sans-serif,system-ui" font-size="${Math.round(w * 0.04)}">${product} · ${preset}</text>
      `;
  }

  const subject = esc(args.subjectHint || args.values.productDescription || product);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="subject" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  ${chrome}
  ${
    img
      ? ""
      : `<rect x="${w * 0.18}" y="${h * 0.22}" width="${w * 0.64}" height="${h * 0.4}" rx="28" fill="url(#subject)" opacity="0.85"/>
  <text x="${w * 0.22}" y="${h * 0.44}" fill="#ffffffcc" font-family="ui-sans-serif,system-ui" font-size="${Math.round(Math.min(w, h) * 0.028)}">${subject.slice(0, 64)}</text>`
  }
  <text x="${w * 0.06}" y="${h * 0.985}" fill="#ffffff66" font-family="ui-monospace,monospace" font-size="14">${esc(args.wrapper.name)} · ${preset}</text>
</svg>`;

  const id = nanoid(8);
  const filename = `${args.jobId}-${id}.svg`;
  const outDir = path.join(process.cwd(), ".data", "outputs");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, filename), svg);
  return { filename, url: `/api/outputs/${filename}` };
}
