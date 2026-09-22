import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { jobRunnerSupportsVisualQa, jobStatusLabel, exactSeed, musicEffectiveSettings, musicLengths, musicSeconds, preferredImproveProvider, settingsWritePayload, supercomputerReady, visualQaSummary, ZERMO_IMAGE_PROFILES } from "../src/lib/studio/presentation";
import { visibleDreamPresets, DREAM_PRESETS, MATURE_PRESETS } from "../src/lib/dream/presets";
import { EXPLAINER_PRESETS, getDurationBeats, getDurationSeconds } from "../src/lib/explainer/presets";

assert.equal(jobStatusLabel(null), "Ready for a prompt");
assert.equal(jobStatusLabel({ status: "queued" }), "Queued");
assert.equal(jobStatusLabel({ status: "running", phase: "subject" }), "Generating");
assert.equal(jobStatusLabel({ status: "running", phase: "finalize" }), "Saving");
assert.equal(jobStatusLabel({ status: "completed" }), "Completed");
assert.equal(jobStatusLabel({ status: "failed", phase: "finalize" }), "Failed");
assert.equal(exactSeed("18446744073709551615"), "18446744073709551615");
assert.equal(exactSeed(0), "0");
assert.equal(exactSeed(18446744073709551615), ""); // Already rounded: never pretend it is reusable.
assert.equal(musicSeconds("zermo", "300"), "300");
assert.equal(musicSeconds("zermo", "5"), "10");
assert.equal(musicSeconds("zermo", "60"), "60");
assert.equal(musicSeconds("zermo", "oops"), "60");
assert.equal(getDurationSeconds("90s"), 90);
assert.equal(getDurationBeats("90s"), 8);
assert.equal(getDurationSeconds("10s"), 10);
assert.equal(musicSeconds("mock", "300"), "300");
assert.deepEqual(musicLengths("zermo").map(x => Number(x.id)), [10,15,30,45,60,90,120,180,240,300]);
assert(musicLengths("zermo").every(x => / · /.test(x.label)), "lengths need a useful purpose, not bare seconds");
assert.equal(preferredImproveProvider({ improveProvider: "api", hasImproveApiKey: true }), "api");
assert.equal(preferredImproveProvider({ improveProvider: "api", hasImproveApiKey: false }), "local");
assert.equal(preferredImproveProvider({ improveProvider: "local", hasImproveApiKey: true }), "local");
assert.equal(
  supercomputerReady({
    text: { ready: true },
    image: { ready: true },
    music: { ready: false },
  }),
  true,
);
assert.equal(
  supercomputerReady({
    text: { ready: true },
    image: { ready: false },
    music: { ready: true },
  }),
  false,
);
assert.equal(jobRunnerSupportsVisualQa("workflow"), true);
assert.equal(jobRunnerSupportsVisualQa("image2"), true);
assert.equal(jobRunnerSupportsVisualQa("explainer"), true);
assert.equal(jobRunnerSupportsVisualQa("ugc"), false);
assert.deepEqual(
  musicEffectiveSettings({
    zermoJobs: {
      "music:track": {
        effective: {
          settings: { duration: 90, key: "D minor", bpm: 112, sampler: "ace" },
        },
      },
    },
  }),
  [
    { label: "Duration", value: "90 seconds" },
    { label: "Key", value: "D minor" },
    { label: "BPM", value: "112" },
    { label: "Sampler", value: "ace" },
  ],
);
assert.deepEqual(musicEffectiveSettings({ zermoJobs: {} }), []);
assert.equal(visualQaSummary("off", "zermo", []), "Skipped: opt-in is off.");
assert.equal(
  visualQaSummary("on", "mock", []),
  "Skipped: preview mode does not run visual review.",
);
assert.equal(
  visualQaSummary("on", "zermo", ["Subject: skipped (no vision model)"]),
  "Subject: skipped (no vision model)",
);
assert.deepEqual(ZERMO_IMAGE_PROFILES.map((x) => x.steps), ["8", "20"]);
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
  assert(p.styleAlias.startsWith("Qwen 2.1 · "));
  assert(p.example.length > 5);
}
const provenance = JSON.parse(
  readFileSync("public/examples/explainer/provenance.json", "utf8"),
) as {
  slug: string;
  preview_sha256: string;
  preview_bytes: number;
  preview_crop?: { source_box: number[]; output_size: number[] };
}[];
const pastel = provenance.find((item) => item.slug === "pastel-flat-2d")!;
const pastelBytes = readFileSync("public/examples/explainer/pastel-flat-2d.webp");
assert.equal(pastel.preview_bytes, pastelBytes.byteLength);
assert.equal(
  pastel.preview_sha256,
  createHash("sha256").update(pastelBytes).digest("hex"),
);
for (const file of ["src/app/create/page.tsx", "src/components/studio/job-runner.tsx"]) {
  assert(readFileSync(file, "utf8").includes("Model review can miss identity, color and count errors. Inspect reference edits yourself."), "Known review limits must be visible beside the QA control");
}
assert.equal(readFileSync("src/app/director/page.tsx", "utf8").match(/id="brief"[\s\S]*?placeholder="([^"]*)"/)?.[1], "", "Director brief must stay blank, without sample prompt text");
console.log("Studio UI behavior checks passed");
