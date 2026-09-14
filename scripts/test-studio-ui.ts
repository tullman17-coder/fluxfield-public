import assert from "node:assert/strict";
import { jobStatusLabel, exactSeed, musicLengths, musicSeconds, settingsWritePayload, ZERMO_IMAGE_PROFILES } from "../src/lib/studio/presentation";
import { visibleDreamPresets, DREAM_PRESETS, MATURE_PRESETS } from "../src/lib/dream/presets";
import { EXPLAINER_PRESETS } from "../src/lib/explainer/presets";

assert.equal(jobStatusLabel(null), "Ready for a prompt");
assert.equal(jobStatusLabel({ status: "queued" }), "Queued");
assert.equal(jobStatusLabel({ status: "running", phase: "subject" }), "Generating");
assert.equal(jobStatusLabel({ status: "running", phase: "finalize" }), "Saving");
assert.equal(jobStatusLabel({ status: "completed" }), "Completed");
assert.equal(jobStatusLabel({ status: "failed", phase: "finalize" }), "Failed");
assert.equal(exactSeed("18446744073709551615"), "18446744073709551615");
assert.equal(exactSeed(0), "0");
assert.equal(exactSeed(18446744073709551615), ""); // Already rounded: never pretend it is reusable.
assert.equal(musicSeconds("zermo", "300"), "90");
assert.equal(musicSeconds("zermo", "5"), "10");
assert.equal(musicSeconds("zermo", "60"), "60");
assert.equal(musicSeconds("zermo", "oops"), "60");
assert.equal(musicSeconds("mock", "300"), "300");
assert(musicLengths("zermo").every((x) => Number(x.id) >= 10 && Number(x.id) <= 90));
assert.deepEqual(ZERMO_IMAGE_PROFILES.map((x) => x.steps), ["4", "8"]);
assert.deepEqual(settingsWritePayload({ generationMode: "zermo", studioApiKey: "", improveApiKey: "  ", hasStudioApiKey: true }), { generationMode: "zermo" });
assert.deepEqual(settingsWritePayload({ studioApiKey: "replacement" }), { studioApiKey: "replacement" });
assert(visibleDreamPresets(true).every((p) => !MATURE_PRESETS.some((m) => m.id === p.id)));
assert.deepEqual(visibleDreamPresets(true, true).map((p) => p.id), MATURE_PRESETS.map((p) => p.id));
assert.deepEqual(visibleDreamPresets(false, true).map((p) => p.id), DREAM_PRESETS.map((p) => p.id));
assert([...DREAM_PRESETS, ...MATURE_PRESETS].every((p) => p.example.length > 5));
const ids = ["editorial-motion", "stickman-cartoon", "watercolor-chronicle", "fairy-tale-myth", "paper-diorama", "pastel-flat-2d"];
assert.deepEqual(EXPLAINER_PRESETS.map((p) => p.id), ids);
for (const p of EXPLAINER_PRESETS) {
  assert.equal(p.previewImage, `/examples/explainer/${p.id}.webp`);
  assert(p.styleAlias.startsWith("Chroma · "));
  assert(p.example.length > 5);
}
console.log("Studio UI behavior checks passed");
