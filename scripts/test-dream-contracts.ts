import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import ts from "typescript";
import { exactSeed } from "../src/lib/studio/presentation";
import {
  applyDreamPreset,
  applyFraming,
  enhanceNegativePrompt,
  enhancePrompt,
  DREAM_PRESETS,
  MATURE_PRESETS,
  resolveFraming,
  stripContentFilters,
} from "../src/lib/dream/presets";

const brief = 'A silly three-eyed cartoon creature named Moxie with six arms holding a sign saying "damn, $& {wow}".';
const assisted = enhancePrompt(brief, "surreal", "auto", true);
assert.ok(assisted.startsWith(brief), "the entire original brief must survive verbatim");
assert.doesNotMatch(assisted, /matching pair of eyes|right number of limbs|natural hands|physically plausible|believable shadow|fully described environment/i,
  "detail assist must not contradict deliberate anatomy, physics, or lighting");
const negative = '  blood, gore, blur, "Moxie?"\nno fog  ';
assert.equal(enhanceNegativePrompt(brief, negative, "auto", true), negative,
  "assist must not invent anatomy negatives or normalize user exclusions");
assert.equal(stripContentFilters(negative), negative, "no provenance means no permission to remove user negatives");
const literal = `  ${brief}\nKeep this spacing.  `;
assert.ok(applyDreamPreset(literal, "photo").startsWith(literal));
assert.ok(applyFraming(literal, "wide").prompt.startsWith(literal));
assert.equal(enhancePrompt(literal, "", "auto", false), literal);
assert.match(enhancePrompt("An impossible floating city", "surreal", "auto", true), /surreal/);
assert.doesNotMatch(enhancePrompt("An impossible floating city", "surreal", "auto", true), /physically plausible|coherent structure/);
console.log("PASS: Dream original brief, anatomy intent, and negative literals");

assert.equal(DREAM_PRESETS[0].id, "auto", "default style is an explicit auto option, not a forced look");
assert.match(enhancePrompt("A friendly teapot", "auto", "auto", true), /playful.*silly.*cartoon/);
for (const prompt of ["A photorealistic teapot", "A photoreal teapot", "A teapot in documentary photography", "A realistic teapot", "A teapot in watercolor", "A dark noir teapot", "A dark, unsettling creature"]) {
  assert.equal(enhancePrompt(prompt, "auto", "auto", true), prompt, "an explicit look suppresses the cartoon default");
}
assert.match(enhancePrompt(brief, "photo", "macro", true), /Selected style \(takes precedence\):.*photographic/);
assert.doesNotMatch(enhancePrompt(brief, "photo", "macro", true).slice(brief.length), /cartoon/);
assert.equal(resolveFraming("An extreme wide shot", "macro"), "macro");
assert.equal(resolveFraming("An extreme wide shot", "not-a-framing"), "extreme-wide");
assert.match(enhancePrompt("An extreme wide shot", "photo", "macro", true), /Framing \(takes precedence\): true macro detail/);
assert.doesNotMatch(enhancePrompt("An extreme wide shot", "photo", "macro", true), /subject occupies/);
console.log("PASS: playful default yields to explicit looks and chosen controls win");

async function improveContracts() {
  const cwd = process.cwd();
  const scratch = await mkdtemp(path.join(os.tmpdir(), "dream-contracts-"));
  const originalFetch = globalThis.fetch;
  const keyFile = process.env.LOCAL_STUDIO_API_KEY_FILE;
  const zermoEnv = { ZERMO_API_BASE: process.env.ZERMO_API_BASE, ZERMO_API_KEY: process.env.ZERMO_API_KEY };
  try {
    process.chdir(scratch);
    process.env.LOCAL_STUDIO_API_KEY_FILE = path.join(scratch, "no-key");
    await mkdir(".data");
    await writeFile(".data/settings.json", JSON.stringify({
      generationMode: "mock", improveProvider: "api", improveApiBase: "http://127.0.0.1:1/v1",
      improveApiKey: "fixture-only", improveApiModel: "fixture-writer",
    }));
    const { POST } = await import("../src/app/api/improve/route");
    let contacts = 0;
    let finishReason = "stop";
    let answer: unknown = JSON.stringify({ prompt: `${literal}\n\nBright flat colors emphasize the requested cartoon silhouette.` });
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), "http://127.0.0.1:1/v1/chat/completions", "no external model/network calls in tests");
      contacts++;
      const payload = JSON.parse(String(init?.body));
      assert.ok(payload.messages.some((m: { content: string }) => m.content.includes(literal)), "original input must reach the writer intact");
      return Response.json({ model: "fixture-writer", choices: [{ message: { content: answer }, finish_reason: finishReason }] });
    };
    const call = (body: unknown) => POST(new Request("http://localhost/api/improve", { method: "POST", body: JSON.stringify(body) }));
    const valid = await call({ prompt: literal, provider: "api", presetId: "surreal", framing: "macro", negativePrompt: negative });
    const data = await valid.json();
    assert.equal(valid.status, 200, JSON.stringify(data));
    assert.equal(data.prompt, JSON.parse(String(answer)).prompt, "rewrite is a parsed, literal-preserving proposal, never raw model JSON");
    assert.equal(data.originalPrompt, literal);
    assert.equal(data.model, "fixture-writer");

    for (const bad of [null, [], { prompt: 42 }, { prompt: [] }, { prompt: "" }, { prompt: literal, provider: "other" }, { prompt: literal, presetId: "unknown" }]) {
      const before = contacts;
      const response = await call(bad);
      assert.equal(response.status, 400, "malformed requests fail before contacting a writer");
      assert.equal(contacts, before);
    }
    for (const bad of ["", "not JSON", '{"prompt":"cut off', { text: "wrong shape" }, JSON.stringify({ prompt: "A normal creature named Moe." }),
      JSON.stringify({ prompt: `${literal}\n\n${"word ".repeat(121)}.` }),
      JSON.stringify({ prompt: `${literal}\n\nA cut off sentence and` }),
      JSON.stringify({ prompt: `${literal}\n\nA complete sentence.`, extra: true })]) {
      answer = bad;
      const rejected = await call({ prompt: literal, provider: "api" });
      assert.equal(rejected.status, 502, `bad proposal must be rejected: ${JSON.stringify(bad).slice(0, 80)}`);
      const retained = await rejected.json();
      assert.equal(retained.prompt, literal, "a rejected proposal returns the untouched original");
      assert.equal(retained.originalPrompt, literal);
    }
    answer = JSON.stringify({ prompt: `${literal}\n\nA complete-looking partial response.` });
    finishReason = "length";
    const truncated = await call({ prompt: literal, provider: "api" });
    assert.equal(truncated.status, 502, "nonempty length-truncated output must not be proposed");
    assert.equal((await truncated.json()).prompt, literal);
    await writeFile(".data/settings.json", JSON.stringify({ generationMode: "zermo" }));
    process.env.ZERMO_API_BASE = "http://127.0.0.1:1";
    process.env.ZERMO_API_KEY = "fixture-only";
    finishReason = "stop";
    const managed = await call({ prompt: literal, provider: "api" });
    assert.equal(managed.status, 200);
    assert.equal((await managed.json()).provider, "zermo");
    finishReason = "length";
    const managedTruncated = await call({ prompt: literal });
    assert.equal(managedTruncated.status, 502, "parent-owned managed writer must reject nonempty token-limit output");
    assert.equal((await managedTruncated.json()).prompt, literal);
    console.log("PASS: rewrite route validates requests, preserves literals, rejects malformed/truncated proposals");
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(cwd);
    if (keyFile === undefined) delete process.env.LOCAL_STUDIO_API_KEY_FILE;
    else process.env.LOCAL_STUDIO_API_KEY_FILE = keyFile;
    for (const [key, value] of Object.entries(zermoEnv)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(scratch, { recursive: true, force: true });
  }
}
async function createContracts() {
  const { default: Create } = await import("../src/app/create/page");
  const render = (query: string) => renderToStaticMarkup(createElement(SearchParamsContext.Provider,
    { value: new URLSearchParams(query) }, createElement(Create)));
  const checkbox = (html: string, id: string) => html.match(new RegExp(`<input(?=[^>]*id="${id}")[^>]*>`))?.[0] || "";
  const normal = render("");
  assert.ok(checkbox(normal, "campaign-copy"), "campaign copy must be visibly optional on Create");
  assert.doesNotMatch(checkbox(normal, "campaign-copy"), /checked/);
  assert.match(checkbox(normal, "visual-qa"), /checked/, "real QA defaults on");
  const campaign = render(new URLSearchParams({ mode: "campaign", prompt: brief, brandName: "Moxie's mark", seed: "18446744073709551615", ratio: "landscape", preset: "surreal" }).toString());
  assert.match(checkbox(campaign, "campaign-copy"), /checked/);
  assert.match(campaign, /18446744073709551615/);
  assert.match(campaign, /Moxie&#x27;s mark/);
  assert.match(campaign, /three-eyed cartoon creature/);
  assert.match(campaign, /six arms/);
  assert.doesNotMatch(checkbox(render("mode=campaign&campaignCopy=false&visualQa=off"), "campaign-copy"), /checked/);
  assert.doesNotMatch(checkbox(render("visualQa=off"), "visual-qa"), /checked/);
  const source = readFileSync(new URL("../src/app/create/page.tsx", import.meta.url), "utf8");
  assert.match(source, /campaignCopy: campaignCopy \? "true" : "false"/);
  assert.match(source, /useJobWatch\("dream"\)/);
  assert.doesNotMatch(source, /\/api\/copy|runSupercomputerPipeline|setTimeout/);
  assert.match(source, /job\.inputs\.campaignCopy/);
  assert.match(source, /isPromptProposal\(prompt, data.prompt\)/);
  assert.match(source, /improved\.originalPrompt !== prompt/, "stale rewrites must not overwrite an edited brief");
  assert.match(source, /<Suspense/);
  assert.match(render("referenceJobId=saved-reference"), /Retained reference from job.*saved-reference/);
  console.log("PASS: Create SSR campaign opt-in, QA defaults, literal query inputs, durable job and rewrite guards");
  await submissionContracts(source);
}

async function submissionContracts(source: string) {
  // Exercise the actual page handlers without a DOM or a second implementation.
  const ast = ts.createSourceFile("page.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === "CreateWorkbench") as ts.FunctionDeclaration;
  const handlers = component.body!.statements.filter((n) =>
    (ts.isFunctionDeclaration(n) && ["submitDream", "generate", "varyFromJob"].includes(n.name!.text)) ||
    (ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => d.name.getText(ast) === "reuseFromJob")));
  const javascript = ts.transpileModule(handlers.map((n) => n.getText(ast)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const state: Record<string, unknown> = {};
  const sent: FormData[] = [];
  const scope = {
    FormData, exactSeed, MATURE_PRESETS, useCallback: (fn: unknown) => fn,
    submitLock: { current: false }, running: false, controlError: null,
    prompt: literal, negativePrompt: negative, ratio: "landscape", framing: "macro", count: "2",
    seed: "18446744073709551615", steps: "8", zermo: true, cfg: "1", assist: true,
    visualQa: true, campaignCopy: true, brandName: "Moxie's $& {mark}", activePreset: { id: "surreal" },
    refFile: null, refUrl: "https://example.invalid/current.png", referenceJobId: "saved-reference",
    promptRef: { current: null }, referenceRef: { current: { value: "old upload" } },
    ...Object.fromEntries(["Submitting", "SubmitError", "Job", "Prompt", "NegativePrompt", "Preset", "AdultCategory", "Ratio", "Framing", "Count", "Seed", "Steps", "Cfg", "Assist", "VisualQa", "CampaignCopy", "BrandName", "RefFile", "ReferenceJobId", "RefUrl", "Improved"].map((name) => [`set${name}`, (value: unknown) => { state[name] = value; }])),
    fetch: async (url: string, init: RequestInit) => {
      assert.equal(url, "/api/jobs", "only one durable job submission, no text orchestration");
      sent.push(init.body as FormData);
      return Response.json({ job: { id: "accepted-dream", status: "queued" } }, { status: 201 });
    },
  };
  const handlersUnderTest = new Function(...Object.keys(scope), `${javascript}; return {generate, varyFromJob, reuseFromJob};`)(...Object.values(scope));
  await handlersUnderTest.generate();
  assert.equal(sent.length, 1);
  const submitted = JSON.parse(String(sent[0].get("inputs")));
  assert.equal(submitted.prompt, literal);
  assert.equal(submitted.negativePrompt, negative);
  assert.equal(submitted.seed, "18446744073709551615");
  assert.equal(submitted.campaignCopy, "true");
  assert.equal(submitted.visualQa, "on");
  assert.equal(submitted.brandName, scope.brandName);
  assert.equal(submitted.size, undefined, "Create delegates size to the validated ratio mapping");
  assert.equal(sent[0].get("referenceJobId"), "saved-reference");
  assert.equal(sent[0].get("referenceImageUrl"), null);
  const saved = { id: "source-after-reload", presetId: "surreal", inputs: { ...submitted, referenceImage: "saved.png" }, referenceImagePath: "/server-owned/saved.png" };
  handlersUnderTest.reuseFromJob(saved);
  assert.equal(state.ReferenceJobId, saved.id);
  assert.equal(state.Seed, submitted.seed);
  assert.equal(state.RefFile, null);
  await handlersUnderTest.varyFromJob(saved);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].get("referenceJobId"), saved.id, "vary uses the source job, never current stale reference controls");
  assert.equal(sent[1].get("referenceImageUrl"), null);
  const varied = JSON.parse(String(sent[1].get("inputs")));
  assert.equal(varied.seed, "");
  assert.equal(varied.prompt, literal);
  assert.equal(varied.referenceImage, undefined, "no browser-supplied internal path");
  assert.equal(varied.campaignCopy, "true");
  console.log("PASS: actual Create handlers submit literal fields, durable flags, valid ratios, and saved-reference reuse/vary");
}
improveContracts().then(createContracts).catch((error) => { console.error(error); process.exitCode = 1; });
