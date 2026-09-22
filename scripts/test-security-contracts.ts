// R1/R2/R3 regressions from the scratch adversarial review; no live services.
import assert from "node:assert/strict";
import { promises as fs, constants } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { mock } from "node:test";
import { randomUUID } from "node:crypto";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import type { StudioJob } from "../src/lib/adapters/types";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=", "base64");

async function references(root: string) {
  const reference = await import("../src/lib/jobs/reference");
  const shared = path.join(root, "data");
  const releaseA = path.join(root, "releases", "a");
  const releaseB = path.join(root, "releases", "b");
  await fs.mkdir(shared);
  for (const release of [releaseA, releaseB]) {
    await fs.mkdir(release, { recursive: true });
    await fs.symlink(shared, path.join(release, ".data"));
  }
  process.chdir(releaseA);
  const saved = await reference.saveReferenceBytes(PNG, ".png");
  const source: StudioJob = {
    id: "r".repeat(10), tool: "dream", workflowSlug: "dream", workflowName: "Create",
    presetId: "photo", presetLabel: "Photo", status: "completed", progress: 100,
    prompt: "cup", negativePrompt: "", aspect: "1:1", modeUsed: "mock", outputs: [],
    referenceImagePath: saved.dest, inputs: { referenceImage: saved.name },
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  };
  const snapshot = async (job = source) => {
    const copied = await reference.reuseReferenceImage(job);
    assert.notEqual(copied.name, saved.name);
    assert.deepEqual(await fs.readFile(copied.dest), PNG);
    assert.notEqual((await fs.stat(copied.dest)).ino, (await fs.stat(path.join(shared, "uploads", saved.name))).ino);
  };
  await snapshot();
  process.chdir(releaseB);
  await snapshot();
  await snapshot({ ...source, referenceImagePath: path.join(releaseB, ".data/uploads", saved.name) });
  // A pruned old release must not be required to resolve the durable upload ID.
  await fs.rm(releaseA, { recursive: true });
  await snapshot();
  console.log("PASS R1: same-shared-.data and cross-release saved uploads, including a removed old release, produce fresh snapshots");

  const owned = path.join(shared, "uploads", saved.name);
  const jobFor = (name: string) => ({ ...source, referenceImagePath: path.join(releaseB, ".data/uploads", name), inputs: { referenceImage: name } });
  const foreign = path.join(root, saved.name);
  await fs.writeFile(foreign, PNG);
  await assert.rejects(reference.reuseReferenceImage({ ...source, referenceImagePath: foreign }), /owned/);
  const foreignUpload = path.join(root, "foreign", ".data", "uploads", "foreign0.png");
  await fs.mkdir(path.dirname(foreignUpload), { recursive: true });
  await fs.writeFile(foreignUpload, PNG);
  await assert.rejects(reference.reuseReferenceImage({ ...source, referenceImagePath: foreignUpload, inputs: { referenceImage: "foreign0.png" } }), /missing|regular/, "A legacy path must never read a file that exists only in a foreign data root");
  await assert.rejects(reference.reuseReferenceImage({ ...source, inputs: { referenceImage: "other000.png" } }), /owned/);
  await assert.rejects(reference.reuseReferenceImage({ ...source, referenceImagePath: `${releaseB}/.data/uploads/../uploads/${saved.name}` }), /owned/);
  await fs.symlink(foreign, path.join(shared, "uploads", "symlink0.png"));
  await assert.rejects(reference.reuseReferenceImage(jobFor("symlink0.png")), /regular|owned/);
  execFileSync("mkfifo", [path.join(shared, "uploads", "fifo0000.png")]);
  await assert.rejects(reference.reuseReferenceImage(jobFor("fifo0000.png")), /type|size/);
  await fs.rename(path.join(shared, "uploads"), path.join(shared, "original-uploads"));
  await fs.symlink(path.join(shared, "original-uploads"), path.join(shared, "uploads"));
  await assert.rejects(reference.reuseReferenceImage(source), /owned/);
  await fs.unlink(path.join(shared, "uploads"));
  await fs.rename(path.join(shared, "original-uploads"), path.join(shared, "uploads"));

  const open = fs.open.bind(fs);
  let closed = false;
  let bytesRequested = 0;
  mock.method(fs, "open", async (...args: Parameters<typeof fs.open>) => {
    assert.equal(args[0], owned, "Open only the canonical current data root, not the retired release prefix");
    const flags = Number(args[1]);
    assert.equal(flags & constants.O_NOFOLLOW, constants.O_NOFOLLOW);
    assert.equal(flags & constants.O_NONBLOCK, constants.O_NONBLOCK);
    const handle = await open(...args);
    const stat = handle.stat.bind(handle), close = handle.close.bind(handle), read = handle.read.bind(handle);
    handle.stat = (async () => { const old = await stat(); await fs.appendFile(owned, "growth"); return old; }) as typeof handle.stat;
    handle.read = (async (buffer: Buffer, offset: number, length: number, position: number | null) => {
      bytesRequested += length;
      return read(buffer, offset, length, position);
    }) as typeof handle.read;
    handle.close = async () => { closed = true; return close(); };
    return handle;
  });
  try {
    await assert.rejects(reference.reuseReferenceImage(source), /size changed/);
    assert.equal(closed, true);
    assert.equal(bytesRequested, PNG.length + 1, "Growth cannot cause an unbounded descriptor read");
  } finally { mock.restoreAll(); }
  console.log("PASS R1: foreign paths, traversal, upload-parent/leaf symlinks and FIFO reject; bounded no-follow descriptor closes on growth");
}

async function rewriteIntake(root: string) {
  process.chdir(root);
  await fs.mkdir(".data");
  await fs.writeFile(".data/settings.json", JSON.stringify({ generationMode: "mock", improveProvider: "api", improveApiBase: "https://writer.example/v1", improveApiKey: "fixture-only", improveApiModel: "fixture-writer" }));
  const { POST } = await import("../src/app/api/improve/route");
  let calls = 0;
  mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    calls++;
    const prompt = JSON.parse(String(init?.body)).messages[1].content;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ prompt: `${prompt}\n\nSoft light emphasizes the subject.` }) }, finish_reason: "stop" }] });
  });
  try {
    const body = Buffer.from(JSON.stringify({ prompt: "cup", provider: "api" }) + " ".repeat(2 * 1024 * 1024));
    for (const declared of [undefined, "1", String(body.length)]) {
      let offset = 0, cancelled = false;
      const stream = new ReadableStream<Uint8Array>({
        pull(c) { if (offset === body.length) return c.close(); const end = Math.min(offset + 32768, body.length); c.enqueue(body.subarray(offset, end)); offset = end; },
        cancel() { cancelled = true; },
      });
      const response = await POST(new Request("http://unit.test/api/improve", { method: "POST", body: stream, headers: declared ? { "content-length": declared } : {}, duplex: "half" } as RequestInit));
      assert.equal(response.status, 400, "Whitespace padding must reject before a writer is contacted");
      assert.ok(offset <= 256 * 1024 + 3 * 32768 && cancelled, "Stop at the byte budget plus bounded stream prefetch, and cancel the source");
      assert.equal(calls, 0);
    }
    const setTimer = globalThis.setTimeout;
    const timer = mock.method(globalThis, "setTimeout", (fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => setTimer(fn, ms === 30000 ? 25 : ms, ...args));
    let cancelled = false;
    let controller: ReadableStreamDefaultController<Uint8Array>;
    try {
      const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; c.enqueue(Buffer.from('{"prompt":"cup"} ')); }, cancel() { cancelled = true; } });
      const pending = POST(new Request("http://unit.test/api/improve", { method: "POST", body, duplex: "half" } as RequestInit));
      const response = await Promise.race([pending, new Promise<null>((resolve) => setTimer(() => resolve(null), 100))]);
      if (!response) { controller!.error(new Error("fixture cleanup")); await pending; }
      assert.equal(response?.status, 400, "The shared 30-second body deadline must cover an unfinished stream");
      assert.equal(cancelled, true);
      assert.equal(calls, 0);
    } finally { timer.mock.restore(); }
    // 16000 characters in each field can use six bytes per escaped code unit.
    const escaped = `{"prompt":"${"\\u0061".repeat(16000)}","negativePrompt":"${"\\u0062".repeat(16000)}","provider":"api"}`;
    const valid = await POST(new Request("http://unit.test/api/improve", { method: "POST", body: escaped }));
    assert.equal(valid.status, 200, "The transport budget must accommodate both schema-max strings, not just ASCII prompt bytes");
    assert.equal((await valid.json()).originalPrompt, "a".repeat(16000));
    assert.equal(calls, 1);
    console.log("PASS R2: streamed whitespace, declared/lying lengths and stalled bodies reject/cancel before writer contact; both escaped max-length strings fit");
  } finally { mock.restoreAll(); }
}

async function publicResponses() {
  const sentinel = randomUUID();
  const endpoint = (host: string) => `https://${sentinel}:${sentinel}@${host}/v1?token=${sentinel}#${sentinel}`;
  const { POST } = await import("../src/app/api/improve/route");
  const { readSettings, publicSettings } = await import("../src/lib/settings");
  const original = "  Café $& \nKeep this literal.  ";
  for (const failure of ["offline", "upstream-body", "cloud-error", "malformed-json"]) {
    await fs.writeFile(".data/settings.json", JSON.stringify({ generationMode: "mock", improveProvider: failure.startsWith("cloud") || failure === "malformed-json" ? "api" : "local", ollamaUrl: endpoint("model.example"), improveApiBase: endpoint("writer.example"), improveApiKey: sentinel }));
    mock.method(globalThis, "fetch", async (url: unknown) => {
      if (failure === "offline" || failure === "cloud-error") throw new Error(`fixture transport ${endpoint("error.example")} ${sentinel}`);
      if (failure === "malformed-json") return Response.json({ choices: [{ message: { content: `${sentinel} invalid JSON` }, finish_reason: "stop" }] });
      if (String(url).includes("/api/tags")) return Response.json({ models: [{ name: "llama3.2" }] });
      return new Response(`upstream diagnostic ${sentinel}`, { status: 500 });
    });
    try {
      const settings = await readSettings();
      assert.ok(settings.ollamaUrl.includes(sentinel), "Server-side legacy endpoints stay intact");
      assert.ok(!JSON.stringify(publicSettings(settings)).includes(sentinel));
      const response = await POST(new Request("http://unit.test/api/improve", { method: "POST", body: JSON.stringify({ prompt: original }) }));
      assert.equal(response.status, 502);
      const text = await response.text();
      assert.ok(!text.includes(sentinel), "Rewrite errors must not echo endpoint credentials, upstream bodies or parser excerpts");
      const data = JSON.parse(text);
      assert.equal(data.prompt, original);
      assert.equal(data.originalPrompt, original);
      assert.ok(typeof data.error === "string" && data.error.length > 0);
    } finally { mock.restoreAll(); }
  }
  console.log("PASS R3: random credential sentinels stay server-side through local/cloud transport, upstream and JSON-parser errors; originals survive");

  // Exercise real discovery and its cached response, but never run mesh CLIs.
  mock.method(childProcess, "execFile", () => { throw new Error("Hermetic fixture blocked subprocess"); });
  syncBuiltinESMExports();
  mock.method(globalThis, "fetch", async (url: unknown) => {
    const address = String(url);
    if (address.includes("/api/tags")) return Response.json({ models: [{ name: "llama3.2" }] });
    if (address.includes("/system_stats")) return Response.json({ system: {} });
    if (address.includes("/images/generations")) return new Response("{}", { status: 400 });
    return Response.json({ status: "ok" });
  });
  try {
    await fs.writeFile(".data/settings.json", JSON.stringify({ generationMode: "mock", ffmpegEnabled: false, ollamaModel: "llama3.2", comfyUrl: endpoint("dgx-spark.example:8188"), studioUrl: endpoint("dgx-spark.example"), ttsUrl: endpoint("voice.example"), ollamaUrl: endpoint("model.example"), studioApiKey: sentinel }));
    const settings = await readSettings();
    const { discoverAndHeal } = await import("../src/lib/adapters/discover");
    const discovered = await discoverAndHeal(settings, { force: true });
    // Found/adopted endpoints use the same public policy as the primary probes.
    discovered.found.push({ ...discovered.ollama, url: endpoint("found.example") });
    discovered.applied.push(`Studio → ${endpoint("adopted.example")}`);
    const { GET } = await import("../src/app/api/health/route");
    const response = await GET(new Request("http://unit.test/api/health"));
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.ok(!text.includes(sentinel), "Health settings, probes, found endpoints and applied diagnostics must not contain credentials");
    const data = JSON.parse(text);
    assert.equal(data.settings.ollamaUrl, "https://model.example/v1");
    assert.equal(data.health.probes.ollama.url, "https://model.example/v1");
    assert.equal(data.health.found[0].url, "https://found.example/v1");
    assert.equal(data.health.applied[0], "Studio → https://adopted.example/v1");
    assert.equal(data.health.probes.ollama.ok, true);
    assert.equal(data.health.probes.ollama.status, 200);
    assert.deepEqual(data.health.probes.ollama.models, ["llama3.2"]);
    assert.equal(data.health.studioReady, true);
    assert.ok(discovered.ollama.url.includes(sentinel), "Serialization must not remove server-side transport credentials");
    assert.ok((await readSettings()).ollamaUrl.includes(sentinel));
    console.log("PASS R3: real health/discovery redacts settings, nested probes, found/applied endpoint credentials without changing readiness or server configuration");
  } finally { mock.restoreAll(); syncBuiltinESMExports(); }
}

async function main() {
  const cwd = process.cwd();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "fluxfield-security-contracts-"));
  process.env.LOCAL_STUDIO_API_KEY_FILE = path.join(root, "no-operator-secret");
  process.env.LOCAL_STUDIO_API_KEY = "";
  process.env.IMPROVE_API_KEY = "";
  process.env.HIGGSFIELD_API_KEY = "";
  try { await references(root); await rewriteIntake(root); await publicResponses(); }
  finally { mock.restoreAll(); process.chdir(cwd); await fs.rm(root, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
