import assert from "node:assert/strict";
import { WORKFLOWS } from "../src/lib/workflows";

const ugcAd = WORKFLOWS.find((workflow) => workflow.slug === "ugc-ad");
assert.ok(ugcAd, "UGC Ad workflow must exist");

assert.match(ugcAd.promptTemplate, /\{\{productName\}\}/);
assert.match(ugcAd.promptTemplate, /\{\{productDescription\}\}/);
assert.match(ugcAd.promptTemplate, /\{\{preset\}\}/);
assert.match(ugcAd.promptTemplate, /full-bleed/i);
assert.match(ugcAd.promptTemplate, /(?:candid scene|creator photograph)/i);
assert.doesNotMatch(
  ugcAd.promptTemplate,
  /(?:video still|social ad frame|phone footage|camera UI|interface|screenshot)/i,
);

console.log(
  "PASS: UGC Ad prompts request full-bleed creator photography without camera-interface cues",
);
