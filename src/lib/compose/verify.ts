import { promises as fs } from "fs";
import { extname } from "path";
import type { StudioSettings } from "@/lib/adapters/types";
import {
  reviewImageWithVision,
  type ImageReview,
} from "@/lib/adapters/ollama";
import type { CampaignCopy } from "@/lib/compose/copy";
import { promptHasFigure } from "@/lib/dream/presets";
import { resolveOutputFile } from "@/lib/jobs/store";

const REVIEW_SHAPE = `Return JSON only:
{"ok":true,"anatomy":{"ok":true,"issues":[]},"text":{"ok":true,"issues":[]},"repair":""}
repair is a short prompt addendum to fix the picture, empty if ok.
Do not judge clothing, style, branding taste, or adult content.`;

export async function imageDataUriFromUrl(
  url?: string,
): Promise<string | undefined> {
  if (!url) return undefined;
  const name = url.split("/").pop();
  if (!name) return undefined;
  try {
    const filePath = await resolveOutputFile(name);
    if (!filePath) return undefined;
    const buf = await fs.readFile(filePath);
    const ext = extname(name).toLowerCase();
    const mime =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
          ? "image/webp"
          : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function verifySubject(
  settings: StudioSettings,
  args: { imageUrl?: string; prompt: string },
): Promise<ImageReview | null> {
  const image = await imageDataUriFromUrl(args.imageUrl);
  if (!image) return null;
  const figure = promptHasFigure(args.prompt);
  return reviewImageWithVision(settings, {
    imageDataUri: image,
    prompt: `Check this generated subject.
Intended: ${args.prompt.slice(0, 800)}
${
  figure
    ? "A figure or organism is expected. Inspect faces, eyes, limbs, hands, and any anthropomorphic body. Flag extra or missing limbs, fused fingers, crossed or missing eyes, collapsed faces, mismatched pupils."
    : "If a figure or organism appears, inspect faces, eyes, limbs, and hands the same way. Otherwise say anatomy.ok true."
}
Readable words in the picture are fine if they match the subject. Flag only garbled or nonsense lettering.
${REVIEW_SHAPE}`,
  });
}

export async function verifyCreative(
  settings: StudioSettings,
  args: { imageUrl?: string; prompt: string; copy: CampaignCopy },
): Promise<ImageReview | null> {
  const image = await imageDataUriFromUrl(args.imageUrl);
  if (!image) return null;
  return reviewImageWithVision(settings, {
    imageDataUri: image,
    prompt: `Check this finished campaign layout.
Subject: ${args.prompt.slice(0, 500)}
Intended copy — read every visible word against these exact strings:
brand: ${args.copy.brandName}
product: ${args.copy.productName}
headline: ${args.copy.headline}
cta: ${args.copy.cta}
body: ${args.copy.bodyCopy}
Flag misspellings, cut-off words, missing required names, or nonsense phrases.
If a figure or organism is visible, inspect faces, eyes, limbs, and hands. Flag extra or missing limbs, fused fingers, broken eyes or faces.
${REVIEW_SHAPE}`,
  });
}

export function formatReviewNote(
  label: string,
  review: ImageReview | null,
): string {
  if (!review) return `${label}: skipped (no vision model)`;
  const issues = [
    ...review.anatomy.issues.map((item) => `anatomy: ${item}`),
    ...review.text.issues.map((item) => `text: ${item}`),
  ];
  if (review.ok) {
    return `${label}: ok${review.model ? ` · ${review.model}` : ""}`;
  }
  return `${label}: needs work${review.model ? ` · ${review.model}` : ""}${
    issues.length ? `\n- ${issues.join("\n- ")}` : ""
  }`;
}
