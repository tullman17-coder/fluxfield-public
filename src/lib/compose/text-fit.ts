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
};

function normalizedParagraphs(text: string): string[] {
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "));
  while (paragraphs[0] === "") paragraphs.shift();
  while (paragraphs.at(-1) === "") paragraphs.pop();
  return paragraphs;
}

function textWidth(text: string, size: number, options: TextFitOptions) {
  return measureSvgText(text, {
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
    for (const word of paragraph.split(" ")) {
      const next = line ? `${line} ${word}` : word;
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

function ellipsize(text: string, size: number, options: TextFitOptions) {
  const suffix = "…";
  if (textWidth(`${text}${suffix}`, size, options) <= options.maxWidth) {
    return `${text}${suffix}`;
  }
  const chars = [...text];
  let low = 0;
  let high = chars.length;
  let best = suffix;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = `${chars.slice(0, middle).join("").trimEnd()}${suffix}`;
    if (textWidth(candidate, size, options) <= options.maxWidth) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
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
  const paragraphs = normalizedParagraphs(text);
  if (!paragraphs.length) {
    return {
      lines: [],
      fontSize: maxFontSize,
      lineHeight: options.lineHeight ?? 1.2,
      maxLineWidth: 0,
      blockHeight: 0,
      truncated: false,
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
      best = { lines, fontSize, ...metrics, truncated: false };
      low = fontSize + 1;
    } else {
      high = fontSize - 1;
    }
  }
  if (best) return best;

  const fontSize = minFontSize;
  const lineHeight = options.lineHeight ?? 1.2;
  const heightLines = Math.max(
    1,
    Math.floor((options.maxHeight - fontSize) / (fontSize * lineHeight)) + 1,
  );
  const visibleCount = Math.min(maxLines, heightLines);
  const wrapped = wrapAtSize(paragraphs, fontSize, options, visibleCount);
  const lines = wrapped.slice(0, visibleCount).map((line) =>
    textWidth(line, fontSize, options) <= options.maxWidth
      ? line
      : ellipsize(line, fontSize, options),
  );
  const omitted = wrapped.length > visibleCount;
  if (omitted && lines.length) {
    lines[lines.length - 1] = ellipsize(
      lines[lines.length - 1] || "",
      fontSize,
      options,
    );
  }
  const metrics = metricsFor(lines, fontSize, options);
  return {
    lines,
    fontSize,
    ...metrics,
    truncated:
      omitted ||
      lines.some((line, index) => line !== wrapped[index]),
  };
}
