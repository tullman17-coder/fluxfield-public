import assert from "node:assert/strict";
import * as React from "react";
import { PassThrough } from "node:stream";
import { renderToPipeableStream, renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import * as workflows from "../src/lib/workflows";
import { JobRunner } from "../src/components/studio/job-runner";
import { EXPLAINER_PRESETS } from "../src/lib/explainer/presets";
import { LOOKS } from "../src/lib/director/plan";
import { MARKETPLACE_PRESETS } from "../src/lib/studio/presets-marketplace";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
import { IMAGE2_WRAPPERS, fillWrapperPrompt, sampleValues } from "../src/lib/wrappers/catalog";
import { WORKFLOWS, fillPrompt } from "../src/lib/workflows";
import { localCohereCopy, applyMarketingCopy } from "../src/lib/compose/copy";
import { fitTextToBox } from "../src/lib/compose/text-fit";
import { renderCreativeSvg, sizeForAspect } from "../src/lib/compose/engine";

let checks = 0;
let failures = 0;
function check(name: string, test: () => void) {
  checks++;
  try { test(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : error}`); }
}

check("one-pass interpolation preserves dollars and inserted braces", () => {
  const values = {
    brandName: "$& $$ $` $' {{productName}}",
    productName: "Cup {{preset}}",
    productDescription: "  A $5 cup with {{headline}} on it  ",
    headline: "Buy $& {{audience}}",
    audience: "friends",
  };
  assert.equal(
    fillWrapperPrompt("{{brandName}} | {{productName}} | {{productDescription}} | {{preset}}", values, "Silly"),
    `${values.brandName} | ${values.productName} | ${values.productDescription} | Silly`,
  );
  assert.equal(
    fillPrompt("{{productName}} | {{productDescription}} | {{headline}} | {{audience}} | {{preset}}", values, "Studio"),
    `${values.productName} | ${values.productDescription} | ${values.headline} | friends | Studio`,
  );
});

check("all catalog presets contribute their visual direction", () => {
  for (const wrapper of IMAGE2_WRAPPERS) {
    const prompts = wrapper.presets.map((preset) => {
      const prompt = fillWrapperPrompt(wrapper.promptTemplate, sampleValues(wrapper), preset.label);
      assert.ok(prompt.includes(preset.description), `${wrapper.slug}/${preset.id}: missing direction`);
      return prompt;
    });
    assert.equal(new Set(prompts).size, wrapper.presets.length, wrapper.slug);
  }
  for (const workflow of WORKFLOWS) {
    const prompts = workflow.presets.map((preset) => {
      const prompt = fillPrompt(workflow.promptTemplate, { productName: "Cup", productDescription: "Blue ceramic" }, preset.label);
      assert.ok(prompt.includes(preset.description), `${workflow.slug}/${preset.id}: missing direction`);
      return prompt;
    });
    assert.equal(new Set(prompts).size, workflow.presets.length, workflow.slug);
  }
});

check("playful defaults yield to explicit realism or an explicit Look", () => {
  const wrapper = IMAGE2_WRAPPERS.find((w) => w.slug === "streetwear-drop")!;
  assert.match(fillWrapperPrompt(wrapper.promptTemplate, { productDescription: "A happy raccoon" }, wrapper.presets[0].label), /cartoon|caricature/i);
  const photo = fillWrapperPrompt(wrapper.promptTemplate, { productDescription: "A photorealistic raccoon" }, wrapper.presets[0].label);
  assert.match(photo, /photorealistic raccoon/);
  assert.doesNotMatch(photo, /cartoon|anime|caricature/i);
  assert.doesNotMatch(fillWrapperPrompt(wrapper.promptTemplate, { dreamStyle: "photo", productDescription: "A happy raccoon" }, wrapper.presets[0].label), /cartoon|anime|caricature/i);
  const sports = IMAGE2_WRAPPERS.find((w) => w.slug === "sports-lockup")!;
  const anime = fillWrapperPrompt(sports.promptTemplate, { productDescription: "An athlete" }, "Anime Athletic");
  assert.match(anime, /anime/i);
  assert.doesNotMatch(anime, /photograph|natural hands|matching eyes/i);
});

check("literal copy survives copy generation and event composition", () => {
  const values = { brandName: "  Acme  & Co ", productName: "Show", headline: "Keep $& {this}", venue: "Hall 4 · Friday · 21:00", bodyCopy: "First sentence. Deliberate fragment", cta: "  Get $5 tickets →  " };
  const merged = applyMarketingCopy(values, { headline: "Changed", bodyCopy: "Rewritten", cta: "Wrong" });
  const copy = localCohereCopy(merged);
  assert.equal(copy.brandName, values.brandName);
  assert.equal(copy.headline, values.headline);
  assert.equal(copy.bodyCopy, values.bodyCopy);
  assert.equal(copy.cta, values.cta);
  const event = IMAGE2_WRAPPERS.find((w) => w.slug === "event-poster")!;
  const svg = renderCreativeSvg({ wrapper: event, values: { ...merged, ...copy }, presetLabel: "Festival", aspect: "2:3", jobId: "literal" });
  assert.ok(svg.includes(values.venue), "venue must not lose to a generated subhead or scene description");
  assert.ok(svg.includes("Keep $&amp; {this}"), "headline must be printed, not uppercased or ignored");
  const explicitVenue = applyMarketingCopy({ venue: values.venue, productDescription: "A dancing otter" }, { bodyCopy: "Marketing words" });
  assert.equal(localCohereCopy(explicitVenue).bodyCopy, values.venue);
});

check("copy overflow is explicit rather than a silently shortened success", () => {
  const text = "Literal final words must survive ".repeat(60) + "TAIL";
  const fit = fitTextToBox(text, { family: "Inter", maxFontSize: 30, minFontSize: 18, maxWidth: 160, maxHeight: 40, maxLines: 1 });
  assert.ok(fit.lines.join(" ").includes("TAIL"), "full copy must survive overflow");
  assert.equal(fit.truncated, false);
  assert.equal((fit as typeof fit & { overflow?: boolean }).overflow, true);
  assert.throws(() => renderCreativeSvg({ wrapper: IMAGE2_WRAPPERS[0], values: { cta: text }, presetLabel: "New Drop", aspect: "9:16", jobId: "overflow" }), /overflow.*poster-cta/i);
});

check("six real layouts and advertised aspects have honest geometry", () => {
  assert.equal(new Set(IMAGE2_WRAPPERS.map((w) => w.layout)).size, 6);
  const outfit = IMAGE2_WRAPPERS.find((w) => w.slug === "virtual-tryon")!;
  assert.equal(outfit.name, "Outfit Board");
  const svg = renderCreativeSvg({ wrapper: outfit, values: { productDescription: "Denim jacket with cheerful patches" }, presetLabel: "Closet", aspect: "16:9", jobId: "outfit" });
  assert.doesNotMatch(svg, /fill="#334155"/, "no unpopulated outfit image slots");
  assert.match(svg, /Denim jacket/);
  for (const aspect of ["3:4", "3:2", "21:9", "2.39:1"]) {
    const [x, y] = aspect.split(":").map(Number);
    const { w, h } = sizeForAspect(aspect);
    assert.ok(Math.abs(w / h - x / y) < 0.001, aspect);
  }
});

check("runner defaults follow presets, enable QA, and hide unsupported controls", () => {
  const image = renderToStaticMarkup(React.createElement(JobRunner, { tool: "image2", workflowSlug: "sports-lockup", fields: [], presets: IMAGE2_WRAPPERS[5].presets }));
  assert.match(image, /<option value="" selected="">Follow selected preset/);
  assert.match(image, /type="checkbox"[^>]*checked=""/);
  const video = renderToStaticMarkup(React.createElement(JobRunner, { tool: "ugc", workflowSlug: "ugc", fields: [], presets: [{ id: "review", label: "Review" }] }));
  assert.doesNotMatch(video, /id="brandKitId"|id="framing"/);
  assert.match(video, /Narration unavailable/);
});

check("legacy video presets preserve direction in the real video entry", () => {
  assert.equal(typeof workflows.legacyVideoEntry, "function");
  for (const slug of ["ugc-ad", "product-motion"]) {
    const workflow = WORKFLOWS.find((w) => w.slug === slug)!;
    for (const preset of workflow.presets) {
      const input = { productName: "My $& {{cup}}", productDescription: "A photorealistic blue cup", aspect: "1:1" };
      const entry = workflows.legacyVideoEntry(slug, preset.id, input)!;
      assert.equal(entry.tool, "ugc");
      assert.equal(entry.workflowSlug, "ugc");
      assert.ok(entry.inputs.brief.includes(preset.description));
      assert.ok(entry.inputs.brief.includes(input.productName));
      assert.equal(entry.inputs.aspect, "1:1");
    }
  }
});

check("clean product art is distinct from typography compositions", () => {
  for (const workflow of WORKFLOWS) {
    assert.equal(workflow.outputKind, ["product-shot", "marketplace-pack"].includes(workflow.slug) ? "image" : workflow.kind === "video" ? "video" : "composition");
  }
});

check("browse links encode distinct presets rather than duplicate bare destinations", () => {
  assert.equal(new Set(MARKETPLACE_PRESETS.map((p) => p.href)).size, MARKETPLACE_PRESETS.length);
  for (const preset of MARKETPLACE_PRESETS) {
    const url = new URL(preset.href, "http://localhost");
    assert.ok(url.searchParams.get("preset") || url.searchParams.get("look"), preset.id);
  }
  const shell = readFileSync("src/components/studio/shell.tsx", "utf8");
  assert.doesNotMatch(shell, /href: "\/(supercomputer|studio|workflows)"/);
});

check("one canonical catalog retains image, composition and video entry points", () => {
  const home = readFileSync("src/app/page.tsx", "utf8");
  assert.ok(home.includes("MARKETPLACE_PRESETS"));
  assert.ok(home.includes("WORKFLOWS"));
  assert.doesNotMatch(home, /api\/card-bg|readCardEngines|supercomputer/);
  for (const route of ["studio", "workflows"]) assert.match(readFileSync(`src/app/${route}/page.tsx`, "utf8"), /redirect\("\/#presets"\)/);
});

check("all wrapper presets compose their sample copy without empty thumbnail cells", () => {
  for (const wrapper of IMAGE2_WRAPPERS) for (const preset of wrapper.presets) {
    const svg = renderCreativeSvg({ wrapper, values: sampleValues(wrapper), presetLabel: preset.label, aspect: wrapper.aspectDefault, jobId: `all-${wrapper.slug}-${preset.id}` });
    assert.doesNotMatch(svg, /data-truncated="true"|fill="#334155"/);
  }
});

check("silent motion submits an explicit no-narration contract", () => {
  const source = readFileSync("src/components/studio/job-runner.tsx", "utf8");
  assert.match(source, /inputs\.voice = "none"/);
  assert.doesNotMatch(readFileSync("src/app/ugc/page.tsx", "utf8"), /id: "referenceImage"/, "the generic video adapter does not yet forward an opener image");
});

check("reuse handlers capture values before React clears currentTarget", () => {
  assert.doesNotMatch(readFileSync("src/components/studio/job-runner.tsx", "utf8"), /setValues\(\(v\) => \(\{[^}]*e\.currentTarget/, "deferred state updaters must not read the cleared event target");
});

check("reuse is deliberate and available on every composition form", () => {
  for (const wrapper of IMAGE2_WRAPPERS) {
    const html = renderToStaticMarkup(React.createElement(JobRunner, { tool: "image2", workflowSlug: wrapper.slug, fields: wrapper.inputs, presets: wrapper.presets }));
    assert.ok(html.includes("Use image as finished art (layout only)"), wrapper.slug);
    assert.ok(html.includes('type="file"'), wrapper.slug);
    assert.ok(html.includes('id="refUrl"'), wrapper.slug);
  }
});

check("motion controls promise only supported lengths and actual capabilities", () => {
  for (const route of ["ugc", "ad-multiplier", "faceless", "explainer", "director"]) {
    const source = readFileSync(`src/app/${route}/page.tsx`, "utf8");
    assert.ok(source.includes("MANAGED_MOTION_LENGTHS"), route);
    assert.doesNotMatch(source, /id: "(?:voice|sourceVideoPath|subtitles|script)"|EXPLAINER_DURATIONS|TIKTOK_RUNTIMES|useState\("180"\)|over two minutes/);
  }
});

function findRunner(node: React.ReactNode): React.ReactElement<Record<string, unknown>> | undefined {
  if (!React.isValidElement<Record<string, unknown>>(node)) return undefined;
  if (node.type === JobRunner) return node;
  for (const child of React.Children.toArray(node.props.children as React.ReactNode)) {
    const found = findRunner(child);
    if (found) return found;
  }
}

function renderAsync(element: React.ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    let html = "";
    stream.on("data", (chunk) => { html += chunk.toString(); });
    stream.on("end", () => resolve(html));
    const render = renderToPipeableStream(element, { onAllReady: () => render.pipe(stream), onError: reject });
  });
}

async function routeChecks() {
  const { default: WrapperPage } = await import("../src/app/image-2/[slug]/page");
  const { default: WorkflowPage } = await import("../src/app/workflows/[slug]/page");
  for (const wrapper of IMAGE2_WRAPPERS) {
    for (const preset of wrapper.presets) {
      const page = await WrapperPage({ params: Promise.resolve({ slug: wrapper.slug }), searchParams: Promise.resolve({ preset: preset.id }) });
      check(`wrapper route ${wrapper.slug}/${preset.id}`, () => assert.equal(findRunner(page)?.props.initialPresetId, preset.id));
    }
  }
  for (const workflow of WORKFLOWS.filter((w) => w.kind !== "video")) {
    for (const preset of workflow.presets) {
      const page = await WorkflowPage({ params: Promise.resolve({ slug: workflow.slug }), searchParams: Promise.resolve({ preset: preset.id }) });
      check(`workflow route ${workflow.slug}/${preset.id}`, () => assert.equal(findRunner(page)?.props.initialPresetId, preset.id));
    }
  }
  const { default: UgcPage } = await import("../src/app/ugc/page");
  const { default: AdsPage } = await import("../src/app/ad-multiplier/page");
  const { default: FacelessPage } = await import("../src/app/faceless/page");
  const { default: ExplainerPage } = await import("../src/app/explainer/page");
  const { default: DirectorPage } = await import("../src/app/director/page");
  for (const workflow of WORKFLOWS.filter((w) => w.kind === "video")) for (const preset of workflow.presets) {
    const query = { preset: preset.id, productName: "My $& {{cup}}", productDescription: "Photorealistic ceramic" };
    await assert.rejects(WorkflowPage({ params: Promise.resolve({ slug: workflow.slug }), searchParams: Promise.resolve(query) }), (error: unknown) => {
      const digest = (error as { digest?: string }).digest || "";
      const expected = `/ugc?${new URLSearchParams({ ...query, legacy: workflow.slug })}`;
      assert.ok(digest.includes(expected));
      return digest.startsWith("NEXT_REDIRECT;");
    });
    const page = await UgcPage({ searchParams: Promise.resolve({ ...query, legacy: workflow.slug }) });
    check(`legacy video route ${workflow.slug}/${preset.id}`, () => {
      const runner = findRunner(page)!;
      const inputs = runner.props.initialValues as Record<string, string>;
      assert.equal(runner.props.tool, "ugc");
      assert.ok(inputs.brief.includes(preset.description));
      assert.ok(inputs.brief.includes(query.productName));
    });
  }
  for (const preset of MARKETPLACE_PRESETS) {
    const url = new URL(preset.href, "http://localhost");
    const query = Object.fromEntries(url.searchParams);
    let page: React.ReactNode;
    if (url.pathname.startsWith("/image-2/")) page = await WrapperPage({ params: Promise.resolve({ slug: url.pathname.split("/").pop()! }), searchParams: Promise.resolve(query) });
    else if (url.pathname.startsWith("/workflows/")) page = await WorkflowPage({ params: Promise.resolve({ slug: url.pathname.split("/").pop()! }), searchParams: Promise.resolve(query) });
    else if (url.pathname === "/ugc") page = await UgcPage({ searchParams: Promise.resolve(query) });
    else if (url.pathname === "/ad-multiplier") page = await AdsPage({ searchParams: Promise.resolve(query) });
    else if (url.pathname === "/faceless") page = await FacelessPage({ searchParams: Promise.resolve(query) });
    else {
      const html = await renderAsync(React.createElement(url.pathname === "/explainer" ? ExplainerPage : DirectorPage, { searchParams: Promise.resolve(query) }));
      check(`shortcut ${preset.id}`, () => assert.ok(html.includes('aria-pressed="true"')));
      continue;
    }
    check(`shortcut ${preset.id}`, () => assert.equal(findRunner(page)?.props.initialPresetId, query.preset));
  }
  for (const preset of EXPLAINER_PRESETS) {
    const html = await renderAsync(React.createElement(ExplainerPage, { searchParams: Promise.resolve({ preset: preset.id }) }));
    check(`explainer selection ${preset.id}`, () => {
      const selected = [...html.matchAll(/<button[^>]*aria-pressed="true"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => m[1]);
      assert.ok(selected.some((button) => button.includes(preset.previewImage)));
    });
  }
  for (const look of LOOKS) {
    const html = await renderAsync(React.createElement(DirectorPage, { searchParams: Promise.resolve({ look: look.id }) }));
    check(`director selection ${look.id}`, () => assert.ok(new RegExp(`aria-pressed="true"[^>]*>${look.label}</button>`).test(html)));
  }
  console.log("COUNTS " + JSON.stringify({ wrappers: IMAGE2_WRAPPERS.length, wrapperPresets: IMAGE2_WRAPPERS.reduce((n, w) => n + w.presets.length, 0), layouts: new Set(IMAGE2_WRAPPERS.map((w) => w.layout)).size, workflows: WORKFLOWS.length, workflowPresets: WORKFLOWS.reduce((n, w) => n + w.presets.length, 0), marketplaceShortcuts: MARKETPLACE_PRESETS.length, explainerStyles: EXPLAINER_PRESETS.length, directorLooks: LOOKS.length }));

}
routeChecks().catch((error) => { failures++; console.error(error); }).finally(() => {
  console.log(`${failures ? "FAIL" : "PASS"} ${checks} wrapper contract checks (${failures} failures)`);
  process.exitCode = failures ? 1 : 0;
});
