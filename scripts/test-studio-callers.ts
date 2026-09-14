import assert from "node:assert/strict";
import { runSupercomputerPipeline } from "../src/lib/studio/supercomputer";

const baseInput = {
  brief: "A red ceramic cup",
  brand: "Acme",
  provider: "local" as const,
  style: "cinematic",
  ratio: "landscape",
  managed: true,
  visualQa: true,
};

async function managedImproveFailureStopsBeforeRendering() {
  const routes: string[] = [];
  await assert.rejects(
    runSupercomputerPipeline(baseInput, {
      fetch: async (url) => {
        routes.push(String(url));
        return Response.json({ error: "Managed writing unavailable" }, { status: 502 });
      },
      wait: async () => undefined,
      maxPolls: 1,
    }),
    /Managed writing unavailable/,
  );
  assert.deepEqual(routes, ["/api/improve"]);
}

async function managedCopyFailureDoesNotReportSuccess() {
  const stages: string[] = [];
  const routes: string[] = [];
  await assert.rejects(
    runSupercomputerPipeline(baseInput, {
      fetch: async (url, init) => {
        const route = String(url);
        routes.push(`${init?.method || "GET"} ${route}`);
        if (route === "/api/improve") {
          return Response.json({ prompt: "Sharper cup", provider: "zermo", model: "served-writer" });
        }
        if (route === "/api/jobs") {
          const request = JSON.parse(String(init?.body));
          assert.equal(request.inputs.visualQa, "on");
          return Response.json({ job: { id: "parent-1" } }, { status: 201 });
        }
        if (route === "/api/jobs/parent-1") {
          return Response.json({
            job: {
              id: "parent-1",
              status: "completed",
              outputs: [{ id: "art", kind: "image", label: "Art", url: "/api/outputs/art.png" }],
              script: "settings",
            },
          });
        }
        return Response.json({ error: "Managed copy unavailable" }, { status: 502 });
      },
      wait: async () => undefined,
      maxPolls: 1,
      onStage: (stage) => stages.push(stage),
    }),
    /Managed copy unavailable/,
  );
  assert.deepEqual(stages, ["improve", "generate", "copy"]);
  assert.equal(routes.at(-1), "POST /api/copy");
}

async function legacyTextFailureRemainsBestEffort() {
  const result = await runSupercomputerPipeline(
    { ...baseInput, managed: false, provider: "api", visualQa: false },
    {
      fetch: async (url) => {
        const route = String(url);
        if (route === "/api/improve" || route === "/api/copy") {
          return Response.json({ error: "offline" }, { status: 502 });
        }
        if (route === "/api/jobs") return Response.json({ job: { id: "legacy-parent" } }, { status: 201 });
        return Response.json({
          job: {
            id: "legacy-parent",
            status: "completed",
            outputs: [
              { id: "art", kind: "image", label: "Art", url: "/api/outputs/art.png" },
              { id: "qa", kind: "text", label: "Visual QA", text: "Skipped: opt-in is off." },
            ],
          },
        });
      },
      wait: async () => undefined,
      maxPolls: 1,
    },
  );
  assert.equal(result.improvedPrompt, baseInput.brief);
  assert.equal(result.improveProvider, "api");
  assert.equal(result.copy, undefined);
  assert.equal(result.visualQa, "Skipped: opt-in is off.");
}

async function managedSuccessReturnsServedModelAndQaStatus() {
  const result = await runSupercomputerPipeline(baseInput, {
    fetch: async (url) => {
      const route = String(url);
      if (route === "/api/improve") {
        return Response.json({
          prompt: "Sharper cup",
          provider: "zermo",
          model: "served-writer",
        });
      }
      if (route === "/api/jobs") {
        return Response.json({ job: { id: "managed-parent" } }, { status: 201 });
      }
      if (route === "/api/jobs/managed-parent") {
        return Response.json({
          job: {
            id: "managed-parent",
            status: "completed",
            outputs: [
              { id: "art", kind: "image", label: "Art", url: "/api/outputs/art.png" },
              {
                id: "qa",
                kind: "text",
                label: "Visual QA",
                text: "Subject: skipped (managed visual review is not enabled)",
              },
            ],
          },
        });
      }
      return Response.json({ copy: "Campaign copy" });
    },
    wait: async () => undefined,
    maxPolls: 1,
  });
  assert.equal(result.improveProvider, "zermo");
  assert.equal(result.improveModel, "served-writer");
  assert.equal(result.copy, "Campaign copy");
  assert.match(result.visualQa || "", /managed visual review is not enabled/);
}

async function main() {
  await managedImproveFailureStopsBeforeRendering();
  await managedCopyFailureDoesNotReportSuccess();
  await legacyTextFailureRemainsBestEffort();
  await managedSuccessReturnsServedModelAndQaStatus();
  console.log("PASS: studio caller failure and fallback behavior");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
