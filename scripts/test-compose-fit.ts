import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import { bakeSvgToPng, measureSvgText } from "../src/lib/compose/bake";
import {
  composeCreative,
  renderCreativeSvg,
  sizeForAspect,
} from "../src/lib/compose/engine";
import { fitTextToBox } from "../src/lib/compose/text-fit";
import { hexLuminance } from "../src/lib/utils";
import {
  getImage2Wrapper,
  IMAGE2_WRAPPERS,
  sampleValues,
} from "../src/lib/wrappers/catalog";

function textGroup(svg: string, role: string) {
  const group = svg.match(
    new RegExp(`<g[^>]*data-role="${role}"[^>]*>([\\s\\S]*?)<\\/g>`),
  )?.[1];
  assert.ok(group, `missing ${role} text group`);

  const textTag = group.match(/<text\b([^>]*)>([\s\S]*?)<\/text>/);
  assert.ok(textTag, `missing ${role} text node`);
  const attrs = textTag[1];
  const content = textTag[2];
  const attr = (name: string) => {
    const value = attrs.match(new RegExp(`${name}="([^"]+)"`))?.[1];
    assert.ok(value, `missing ${name} on ${role}`);
    return value;
  };
  const spans = [...content.matchAll(/<tspan\b[^>]*>([\s\S]*?)<\/tspan>/g)].map(
    (match) => match[1],
  );

  return {
    fontSize: Number(attr("font-size")),
    x: Number(attr("x")),
    fill: attr("fill"),
    family: attr("font-family"),
    weight: Number(attr("font-weight")),
    lines: spans.length ? spans : [content],
  };
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(hexLuminance(foreground), hexLuminance(background));
  const darker = Math.min(hexLuminance(foreground), hexLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function roleFill(svg: string, role: string) {
  const tag = svg.match(new RegExp(`<[^>]+data-role="${role}"[^>]*>`))?.[0];
  assert.ok(tag, `missing ${role}`);
  const fill = tag.match(/\bfill="([^"]+)"/)?.[1];
  assert.ok(fill, `missing fill on ${role}`);
  return fill;
}

function subjectImageFit(svg: string) {
  const image = svg.match(/<image\b[^>]*clip-path="url\(#subj-[^"]+\)"[^>]*>/)?.[0];
  assert.ok(image, "missing clipped subject image");
  const fit = image.match(/\bpreserveAspectRatio="([^"]+)"/)?.[1];
  assert.ok(fit, "missing subject image aspect fit");
  return fit;
}

function assertFitsWidth(
  group: ReturnType<typeof textGroup>,
  maxRight: number,
  label: string,
) {
  for (const line of group.lines) {
    const width = measureSvgText(line, {
      family: group.family,
      size: group.fontSize,
      weight: group.weight,
    });
    assert.ok(
      group.x + width <= maxRight + 1,
      `${label} line crosses its region: ${group.x} + ${width} > ${maxRight}`,
    );
  }
}

async function imageDataUri(filePath: string) {
  const bytes = await fs.readFile(filePath);
  const mime = filePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/webp";
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

async function renderRegressionArtifacts() {
  const wrapper = getImage2Wrapper("ecommerce-banner");
  assert.ok(wrapper);
  const fixturePath =
    process.env.COMPOSE_FIXTURE ||
    path.join(process.cwd(), "public/examples/explainer/pastel-flat-2d.webp");
  const subjectImageDataUri = await imageDataUri(fixturePath);
  const common = {
    wrapper,
    presetLabel: "Studio",
    aspect: "1:1",
    jobId: "compose-fit-regression",
    subjectImageDataUri,
  };
  const longSvg = renderCreativeSvg({
    ...common,
    values: {
      brandName: "STUDIO SAMPLE",
      productName: "AeroBrew Go Cup",
      cta: "Shop the AeroBrew Go Cup",
    },
  });
  const controlSvg = renderCreativeSvg({
    ...common,
    jobId: "compose-fit-control",
    values: {
      brandName: "KILN",
      productName: "Cup",
      cta: "Shop now",
    },
  });

  const { w } = sizeForAspect(common.aspect);
  const brand = textGroup(longSvg, "shop-brand");
  const product = textGroup(longSvg, "shop-product");
  const cta = textGroup(longSvg, "shop-cta");
  assert.equal(brand.lines.join(" "), "STUDIO SAMPLE");
  assert.equal(product.lines.join(" "), "AeroBrew Go Cup");
  assert.equal(cta.lines.join(" "), "Shop the AeroBrew Go Cup");
  assertFitsWidth(brand, w * 0.48, "brand");
  assertFitsWidth(product, w * 0.48, "product");
  assertFitsWidth(cta, w * 0.37, "CTA");
  assert.equal(brand.lines.length, 1);
  assert.equal(product.lines.length, 1);
  assert.equal(cta.lines.length, 2);

  const controlBrand = textGroup(controlSvg, "shop-brand");
  const controlProduct = textGroup(controlSvg, "shop-product");
  const controlCta = textGroup(controlSvg, "shop-cta");
  assert.equal(controlBrand.fontSize, Math.round(1080 * 0.1));
  assert.equal(controlProduct.fontSize, Math.round(1080 * 0.07));
  assert.equal(controlCta.fontSize, Math.round(1080 * 0.05));
  assert.deepEqual(controlCta.lines, ["Shop now"]);

  const darkSurfaceSvg = renderCreativeSvg({
    ...common,
    jobId: "compose-fit-dark-surface",
    brand: { surface: "#111111" },
    values: {
      brandName: "KILN",
      productName: "Cup",
      cta: "Shop now",
    },
  });
  for (const role of ["shop-brand", "shop-product"]) {
    assert.ok(
      contrastRatio(textGroup(darkSurfaceSvg, role).fill, "#111111") >= 4.5,
      `${role} must keep WCAG text contrast on a brand surface`,
    );
  }
  const darkButton = roleFill(darkSurfaceSvg, "shop-cta-button");
  assert.ok(
    contrastRatio(darkButton, "#111111") >= 3,
    "CTA button must remain distinct from the brand surface",
  );
  assert.ok(
    contrastRatio(textGroup(darkSurfaceSvg, "shop-cta").fill, darkButton) >= 4.5,
    "CTA text must remain readable on its button",
  );

  const midSurface = "#777777";
  const midSurfaceSvg = renderCreativeSvg({
    ...common,
    jobId: "compose-fit-mid-surface",
    brand: { surface: midSurface },
    values: {
      brandName: "KILN",
      productName: "Cup",
      cta: "Shop now",
    },
  });
  for (const role of ["shop-brand", "shop-product", "footer"]) {
    const fill = textGroup(midSurfaceSvg, role).fill;
    assert.match(fill, /^#[\da-f]{6}$/i, `${role} must use an opaque hex color`);
    assert.ok(
      contrastRatio(fill, midSurface) >= 4.5,
      `${role} must keep WCAG text contrast on a mid-tone surface`,
    );
  }

  const deliberateLines = fitTextToBox("First promised line\nSecond promised line", {
    family: "Inter",
    weight: 400,
    maxFontSize: 30,
    minFontSize: 18,
    maxWidth: 500,
    maxHeight: 100,
    maxLines: 4,
  });
  assert.deepEqual(deliberateLines.lines, [
    "First promised line",
    "Second promised line",
  ]);
  assert.equal(deliberateLines.truncated, false);

  const excessiveCopy = Array.from(
    { length: 2_000 },
    (_, index) => `word${index}`,
  ).join(" ");
  const excessiveStartedAt = performance.now();
  const excessiveFit = fitTextToBox(excessiveCopy, {
    family: "Inter",
    weight: 400,
    maxFontSize: 30,
    minFontSize: 18,
    maxWidth: 500,
    maxHeight: 80,
    maxLines: 2,
  });
  const excessiveDuration = performance.now() - excessiveStartedAt;
  assert.ok(excessiveFit.lines.length <= 2);
  assert.equal(excessiveFit.truncated, true);
  assert.ok(
    excessiveDuration < 750,
    `bounded copy fitting took ${excessiveDuration.toFixed(0)}ms`,
  );

  const editorialWrapper = getImage2Wrapper("editorial-catalog");
  assert.ok(editorialWrapper);
  const editorialSvg = renderCreativeSvg({
    ...common,
    wrapper: editorialWrapper,
    jobId: "compose-fit-explicit-lines",
    values: {
      brandName: "Editions",
      productName: "Field Notes",
      headline: "A measured headline",
      bodyCopy: "First promised line\nSecond promised line",
    },
  });
  assert.deepEqual(textGroup(editorialSvg, "editorial-body").lines, [
    "First promised line",
    "Second promised line",
  ]);

  const sportsWrapper = getImage2Wrapper("sports-lockup");
  assert.ok(sportsWrapper);
  const logoSubjectImageDataUri = await imageDataUri(
    process.env.COMPOSE_LOGO_FIXTURE || fixturePath,
  );
  const logoMarkSvg = renderCreativeSvg({
    ...common,
    wrapper: sportsWrapper,
    jobId: "compose-fit-logo-mark",
    presetLabel: "Logo Mark",
    subjectImageDataUri: logoSubjectImageDataUri,
    values: {
      brandName: "STUDIO SAMPLE",
      productName: "Club Emblem",
    },
  });
  const sportsPortraitSvg = renderCreativeSvg({
    ...common,
    wrapper: sportsWrapper,
    jobId: "compose-fit-sports-portrait",
    presetLabel: "Photo Real",
    subjectImageDataUri: logoSubjectImageDataUri,
    values: {
      brandName: "STUDIO SAMPLE",
      productName: "Home kit portrait",
    },
  });
  assert.equal(subjectImageFit(logoMarkSvg), "xMidYMid meet");
  assert.equal(subjectImageFit(sportsPortraitSvg), "xMidYMid slice");

  for (const candidate of IMAGE2_WRAPPERS) {
    const svg = renderCreativeSvg({
      ...common,
      wrapper: candidate,
      jobId: `compose-fit-${candidate.slug}`,
      aspect: candidate.aspectDefault,
      values: sampleValues(candidate),
    });
    assert.equal((await bakeSvgToPng(svg)).subarray(1, 4).toString(), "PNG");
  }

  const composed = await composeCreative({
    ...common,
    jobId: "compose-fit-public-boundary",
    values: {
      brandName: "STUDIO SAMPLE",
      productName: "AeroBrew Go Cup",
      cta: "Shop the AeroBrew Go Cup",
    },
  });
  const composedPath = path.join(
    process.cwd(),
    ".data",
    "outputs",
    composed.filename,
  );
  const composedPng = await fs.readFile(composedPath);
  assert.equal(composed.bytes, composedPng.byteLength);
  assert.equal(composedPng.subarray(1, 4).toString(), "PNG");
  await fs.rm(composedPath);

  const artifactDir = path.join(
    process.cwd(),
    ".data",
    "compositor-regression",
  );
  await fs.mkdir(artifactDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(artifactDir, "shop-banner-long.svg"), longSvg),
    fs.writeFile(path.join(artifactDir, "shop-banner-long.png"), composedPng),
    fs.writeFile(path.join(artifactDir, "shop-banner-control.svg"), controlSvg),
    fs.writeFile(
      path.join(artifactDir, "shop-banner-control.png"),
      await bakeSvgToPng(controlSvg),
    ),
    fs.writeFile(path.join(artifactDir, "editorial-lines.svg"), editorialSvg),
    fs.writeFile(
      path.join(artifactDir, "editorial-lines.png"),
      await bakeSvgToPng(editorialSvg),
    ),
    fs.writeFile(path.join(artifactDir, "shop-banner-dark.svg"), darkSurfaceSvg),
    fs.writeFile(
      path.join(artifactDir, "shop-banner-dark.png"),
      await bakeSvgToPng(darkSurfaceSvg),
    ),
    fs.writeFile(path.join(artifactDir, "logo-mark-contain.svg"), logoMarkSvg),
    fs.writeFile(
      path.join(artifactDir, "logo-mark-contain.png"),
      await bakeSvgToPng(logoMarkSvg),
    ),
    fs.writeFile(
      path.join(artifactDir, "sports-portrait-cover.svg"),
      sportsPortraitSvg,
    ),
    fs.writeFile(
      path.join(artifactDir, "sports-portrait-cover.png"),
      await bakeSvgToPng(sportsPortraitSvg),
    ),
  ]);
}

renderRegressionArtifacts()
  .then(() => console.log("PASS: measured compositor copy fitting and rendered fixtures"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
