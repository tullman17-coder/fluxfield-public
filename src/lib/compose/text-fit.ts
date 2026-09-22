import { measureSvgText } from "@/lib/compose/bake";

export type TextFitOptions = {
  family: string;
  weight?: number;
  letterSpacing?: number;
  maxFontSize: number;
  minFontSize: number;
  maxWidth: number;
  maxHeight: number;
  maxLines?: number;
  lineHeight?: number;
};

export type FittedText = {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  maxLineWidth: number;
  blockHeight: number;
  truncated: boolean;
  overflow: boolean;
};

function literalParagraphs(text: string): string[] {
  return text === "" ? [] : text.split(/\r\n|\r|\n/);
}

function textWidth(text: string, size: number, options: TextFitOptions) {
  return measureSvgText(text.replace(/[ \t]/g, "\u00a0"), {
    family: options.family,
    size,
    weight: options.weight,
    letterSpacing: options.letterSpacing,
  });
}

function wrapAtSize(
  paragraphs: string[],
  size: number,
  options: TextFitOptions,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push("");
      if (lines.length > maxLines) return lines;
      continue;
    }
    let line = "";
    for (const word of paragraph.match(/\s+|\S+/g) ?? []) {
      const next = line + word;
      if (!line || textWidth(next, size, options) <= options.maxWidth) {
        line = next;
      } else {
        lines.push(line);
        if (lines.length > maxLines) return lines;
        line = word;
      }
    }
    if (line) {
      lines.push(line);
      if (lines.length > maxLines) return lines;
    }
  }
  return lines;
}

function metricsFor(lines: string[], size: number, options: TextFitOptions) {
  const lineHeight = options.lineHeight ?? 1.2;
  return {
    lineHeight,
    maxLineWidth: Math.max(
      0,
      ...lines.map((line) => textWidth(line, size, options)),
    ),
    blockHeight:
      lines.length === 0
        ? 0
        : size + Math.max(0, lines.length - 1) * size * lineHeight,
  };
}

/** Fit caller copy to a compositor-owned box without changing copy that fits. */
export function fitTextToBox(
  text: string,
  options: TextFitOptions,
): FittedText {
  const maxLines = Math.max(1, options.maxLines ?? 1);
  const maxFontSize = Math.max(1, Math.floor(options.maxFontSize));
  const minFontSize = Math.min(
    maxFontSize,
    Math.max(1, Math.floor(options.minFontSize)),
  );
  const paragraphs = literalParagraphs(text);
  if (!paragraphs.length) {
    return {
      lines: [],
      fontSize: maxFontSize,
      lineHeight: options.lineHeight ?? 1.2,
      maxLineWidth: 0,
      blockHeight: 0,
      truncated: false,
      overflow: false,
    };
  }

  let low = minFontSize;
  let high = maxFontSize;
  let best: FittedText | undefined;
  while (low <= high) {
    const fontSize = Math.floor((low + high) / 2);
    const lines = wrapAtSize(paragraphs, fontSize, options, maxLines);
    const metrics = metricsFor(lines, fontSize, options);
    const fits =
      lines.length <= maxLines &&
      metrics.maxLineWidth <= options.maxWidth &&
      metrics.blockHeight <= options.maxHeight;
    if (fits) {
      best = { lines, fontSize, ...metrics, truncated: false, overflow: false };
      low = fontSize + 1;
    } else {
      high = fontSize - 1;
    }
  }
  if (best) return best;

  // ponytail: stop bounded fitting at the minimum size; never rewrite the copy.
  // Return original paragraphs for diagnosis; the compositor refuses overflow.
  return {
    lines: paragraphs,
    fontSize: minFontSize,
    ...metricsFor(paragraphs, minFontSize, options),
    truncated: false,
    overflow: true,
  };
}
