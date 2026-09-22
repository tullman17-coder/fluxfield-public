import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as supercomputer from "../src/lib/studio/supercomputer";

async function main() {
  assert.equal(typeof supercomputer.campaignCreateUrl, "function", "Super must route to Create, not run a browser pipeline");
  assert.equal(supercomputer.campaignCreateUrl({}), "/create?mode=campaign");
  const original = '  A three-eyed cartoon creature named Moxie says "damn, $& {wow}".\nSix arms.  ';
  const query = {
    brief: original,
    brand: "Moxie's $& {brand}",
    style: "surreal",
    ratio: "landscape",
    seed: "18446744073709551615",
    visualQa: "off",
    negativePrompt: "blood, gore, blur",
    referenceImageUrl: "https://example.invalid/ref.png?x=1&y=2",
    tag: ["first", "second"],
  };
  const target = new URL(supercomputer.campaignCreateUrl(query), "http://localhost");
  assert.equal(target.pathname, "/create");
  assert.equal(target.searchParams.get("mode"), "campaign");
  assert.equal(target.searchParams.get("prompt"), original);
  assert.equal(target.searchParams.get("brandName"), query.brand);
  assert.equal(target.searchParams.get("preset"), "surreal");
  for (const key of ["ratio", "seed", "negativePrompt", "referenceImageUrl", "visualQa"] as const) {
    assert.equal(target.searchParams.get(key), query[key]);
  }
  assert.deepEqual(target.searchParams.getAll("tag"), query.tag);
  const explicit = new URL(supercomputer.campaignCreateUrl({ ...query, prompt: "", preset: "photo", brandName: "", campaignCopy: "false" }), "http://localhost");
  assert.equal(explicit.searchParams.get("prompt"), "", "explicit blanks beat aliases");
  assert.equal(explicit.searchParams.get("preset"), "photo");
  assert.equal(explicit.searchParams.get("brandName"), "");
  assert.equal(explicit.searchParams.get("campaignCopy"), "false");
  const { default: Page } = await import("../src/app/supercomputer/page");
  await assert.rejects(Page({ searchParams: Promise.resolve(query) }), (error: unknown) => {
    const digest = (error as { digest?: string }).digest || "";
    assert.ok(digest.includes(supercomputer.campaignCreateUrl(query)), "the actual page must preserve the redirect query");
    return digest.startsWith("NEXT_REDIRECT;");
  });
  const source = readFileSync(new URL("../src/lib/studio/supercomputer.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(|setTimeout|\/api\/improve|\/api\/copy|maxPolls|runSupercomputerPipeline/);
  console.log("PASS: Super redirects to durable Create with literal inputs and reusable old links");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
