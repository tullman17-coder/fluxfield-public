import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { mock } from "node:test";
import { execFileSync } from "node:child_process";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=", "base64");

async function main() {
  const cwd = process.cwd();
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), "fluxfield-input-"));
  process.chdir(scratch);
  // Never load operator secrets or write to the running app's data directory.
  process.env.LOCAL_STUDIO_API_KEY_FILE = path.join(scratch, "no-operator-secret");
  process.env.LOCAL_STUDIO_API_KEY = "";
  process.env.IMPROVE_API_KEY = "";
  process.env.HIGGSFIELD_API_KEY = "";
  try {
    const { DEFAULT_SETTINGS, publicSettings } = await import("../src/lib/settings");
    const sentinel = "test-only-secret-sentinel";
    const safe = publicSettings({
      ...DEFAULT_SETTINGS,
      studioApiKey: sentinel,
      improveApiKey: sentinel,
      higgsfieldApiKey: sentinel,
      futureSecret: sentinel,
    } as typeof DEFAULT_SETTINGS);
    assert.ok(!JSON.stringify(safe).includes(sentinel), "Public settings must omit ALL secret fields, including Higgsfield and unknown persisted keys");
    assert.equal(safe.hasStudioApiKey, true);
    assert.equal(safe.hasImproveApiKey, true);
    assert.equal(safe.hasHiggsfieldApiKey, true);
    console.log("PASS public settings expose presence flags, never secret values");
    const credentialed = publicSettings({ ...DEFAULT_SETTINGS, studioUrl: `https://user:${sentinel}@studio.example/v1?token=${sentinel}#${sentinel}` });
    assert.ok(!JSON.stringify(credentialed).includes(sentinel), "Legacy endpoint URLs must not leak embedded credentials or query secrets");
    const { PUT, GET } = await import("../src/app/api/settings/route");
    const put = (body: unknown) => PUT(new Request("http://unit.test/api/settings", {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    for (const body of [{ generationMode: "unknown" }, { ollamaUrl: 42 }, { ffmpegEnabled: "true" }, { improveProvider: "unknown" }, { higgsfieldApiKey: 42 }, null]) {
      const response = await put(body).catch(() => new Response(null, { status: 500 }));
      assert.equal(response.status, 400, "Malformed settings must be a controlled 400");
    }
    const saved = await put({ higgsfieldApiKey: sentinel });
    assert.equal(saved.status, 200);
    assert.ok(!(await saved.text()).includes(sentinel));
    const { readSettings } = await import("../src/lib/settings");
    assert.equal((await readSettings()).higgsfieldApiKey, sentinel);
    await put({ higgsfieldApiKey: "" });
    assert.equal((await readSettings()).higgsfieldApiKey, sentinel, "Blank secret means keep; explicit clear is required");
    await put({ clearHiggsfieldApiKey: true });
    assert.equal((await readSettings()).higgsfieldApiKey, "");
    assert.ok(!(await (await GET()).text()).includes(sentinel));
    console.log("PASS settings API validates types/enums and persists Higgsfield without echoing secrets");
    const { fetchReferenceImage } = await import("../src/lib/jobs/reference");
    const originalFetch = globalThis.fetch;
    let contacted = 0;
    globalThis.fetch = async () => { contacted++; return new Response(PNG, { headers: { "content-type": "image/png" } }); };
    try {
      for (const host of ["127.0.0.2", "127.1", "2130706433", "0x7f000001", "0177.0.0.1", "localhost.", "10.0.0.1", "172.31.1.2", "192.168.1.1", "169.254.1.2", "100.64.0.1", "0.0.0.0", "224.0.0.1", "[::1]", "[::]", "[fc00::1]", "[fe80::1]", "[::ffff:127.0.0.1]", "[::ffff:7f00:1]", "[2002:7f00:1::]"]) {
        await assert.rejects(fetchReferenceImage(`http://${host}/image.png`), /not allowed|public/);
      }
      assert.equal(contacted, 0, "Forbidden references must be rejected before contact");
    } finally { globalThis.fetch = originalFetch; }
    console.log("PASS normalized IP, private, mapped IPv6 and local host references are rejected");
    let answers = [{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }];
    let requests: https.RequestOptions[] = [];
    let status = 200;
    let headers: Record<string, string> = { "content-type": "image/png" };
    let chunks = [PNG];
    let stall = false;
    let lastResponse: PassThrough;
    const lookup = mock.method(dns, "lookup", async () => answers);
    mock.method(globalThis, "fetch", async () => { requests.push({}); return new Response(PNG, { headers }); });
    const requestMock = (options: https.RequestOptions, callback: (response: http.IncomingMessage) => void) => {
      requests.push(options);
      const req = new EventEmitter() as http.ClientRequest;
      const response = new PassThrough() as unknown as http.IncomingMessage;
      lastResponse = response as unknown as PassThrough;
      response.statusCode = status;
      response.headers = headers;
      req.destroy = ((error?: Error) => { response.destroy(error); if (error) req.emit("error", error); return req; }) as typeof req.destroy;
      req.end = (() => {
        queueMicrotask(() => {
          callback(response);
          if (!stall) { for (const chunk of chunks) if (!response.destroyed) response.push(chunk); response.push(null); }
        });
        return req;
      }) as typeof req.end;
      options.signal?.addEventListener("abort", () => req.destroy(new Error("Reference download timed out")), { once: true });
      return req;
    };
    mock.method(http, "request", requestMock);
    mock.method(https, "request", requestMock);
    try {
      await assert.rejects(fetchReferenceImage("https://image.example/photo"), /not allowed|public/);
      assert.equal(requests.length, 0, "Any private DNS answer must reject before opening a socket");
      answers = [{ address: "93.184.216.34", family: 4 }];
      const savedImage = await fetchReferenceImage("https://image.example:8443/photo?q=1");
      assert.deepEqual(await fs.readFile(savedImage.dest), PNG);
      assert.equal(requests[0].hostname, "93.184.216.34", "Socket must connect to the checked address, not re-resolve the hostname");
      assert.equal(requests[0].servername, "image.example", "TLS identity must remain the original host");
      assert.equal(requests[0].rejectUnauthorized, true, "TLS verification must not inherit an insecure environment default");
      assert.equal((requests[0].headers as Record<string, string>).Host, "image.example:8443");
      assert.equal(requests[0].agent, false, "No shared socket can bypass the pinned address");
      assert.equal(lookup.mock.callCount(), 2);
      requests = [];
      status = 302;
      headers = { location: "http://127.0.0.1/private" };
      await assert.rejects(fetchReferenceImage("https://image.example/photo"), /redirect/i);
      assert.equal(requests.length, 1, "Redirects must never be followed");
      status = 200;
      for (const unsupportedType of ["image/svg+xml", "constructor", "toString", "text/html", "application/octet-stream"]) {
        headers = { "content-type": unsupportedType };
        const { ReferenceInputError } = await import("../src/lib/jobs/reference");
        await assert.rejects(fetchReferenceImage("https://image.example/photo"), (error: unknown) => error instanceof ReferenceInputError && /format|type/i.test(error.message));
      }
      headers = { "content-type": "image/png", "content-length": String(8 * 1024 * 1024 + 1) };
      await assert.rejects(fetchReferenceImage("https://image.example/photo"), /8|large|size/i);
      headers = { "content-type": "image/png" };
      chunks = [PNG, Buffer.alloc(8 * 1024 * 1024)];
      await assert.rejects(fetchReferenceImage("https://image.example/photo"), /8|large|size/i);
      assert.equal(lastResponse!.destroyed, true, "Overflow must tear down the response");
      chunks = [PNG];
      stall = true;
      const setTimer = globalThis.setTimeout;
      mock.method(globalThis, "setTimeout", (fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => setTimer(fn, ms === 20000 ? 25 : ms, ...args));
      await assert.rejects(fetchReferenceImage("https://image.example/photo"), /timed out|abort/i);
      assert.equal(lastResponse!.destroyed, true, "Deadline must tear down stalled responses");
      lookup.mock.mockImplementation(() => new Promise<never>(() => {}));
      await assert.rejects(fetchReferenceImage("https://image.example/photo"), /timed out|abort/i);
    } finally { mock.restoreAll(); }
    console.log("PASS DNS pinning, mixed DNS rejection, redirect refusal, bounded streaming and deadlines");
    const { POST } = await import("../src/app/api/jobs/route");
    const post = (body: unknown) => POST(new Request("http://unit.test/api/jobs", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }));
    const dream = { tool: "dream", workflowSlug: "dream", presetId: "photo", inputs: { prompt: "A sunlit cup" } };
    const malformed = await post({ ...dream, inputs: { prompt: 42 } }).catch(() => new Response(null, { status: 500 }));
    assert.equal(malformed.status, 400, "Input types must be validated before runner execution");
    const { validateJobInput, jobRequestSchema } = await import("../src/lib/jobs/input");
    const literal = "  Café O’Neil $& $` {{preset}}\nPrice $24.00  ";
    const raw = { ...dream, inputs: { prompt: literal, headline: "", seed: "18446744073709551615" } };
    assert.deepEqual(validateJobInput(raw), raw, "Literal strings and intentional blanks must round-trip unchanged");
    assert.equal(jobRequestSchema.safeParse(raw).success, true);
    for (const bad of [
      null, [], { ...dream, tool: "unknown" }, { ...dream, tool: " dream" },
      { ...dream, workflowSlug: "dream " }, { ...dream, workflowSlug: "../dream" },
      { ...dream, presetId: "unknown" }, { ...dream, presetId: " photo" },
      { ...dream, inputs: null }, { ...dream, inputs: { prompt: "  " } },
      { ...dream, inputs: { prompt: "ok", ratio: "unknown" } },
      { ...dream, inputs: { prompt: "ok", framing: " close" } },
      { ...dream, inputs: { prompt: "ok", seed: " 42" } },
      { ...dream, inputs: { prompt: "ok", seed: "18446744073709551616" } },
      { ...dream, inputs: { prompt: "ok", visualQa: "true" } },
      { ...dream, inputs: { prompt: "ok", sourceVideoPath: "/etc/passwd" } },
      { ...dream, inputs: { prompt: "ok", referenceImage: "../settings.json" } },
      { ...dream, referenceImagePath: "/etc/passwd" },
    ]) {
      assert.throws(() => validateJobInput(bad));
      assert.equal((await post(bad)).status, 400);
    }
    const { WORKFLOWS } = await import("../src/lib/workflows");
    const { IMAGE2_WRAPPERS } = await import("../src/lib/wrappers/catalog");
    for (const [tool, catalog] of [["workflow", WORKFLOWS], ["image2", IMAGE2_WRAPPERS]] as const) {
      for (const item of catalog) {
        const inputs = Object.fromEntries(item.inputs.filter((f) => f.type !== "file").map((f) => [f.id, f.type === "select" ? f.options![0].value : f.required ? literal : ""]));
        for (const preset of item.presets) validateJobInput({ tool, workflowSlug: item.slug, presetId: preset.id, inputs });
        for (const field of item.inputs.filter((f) => f.required && f.type !== "file")) {
          const missing = { ...inputs }; delete missing[field.id];
          assert.throws(() => validateJobInput({ tool, workflowSlug: item.slug, presetId: item.presets[0].id, inputs: missing }));
          assert.throws(() => validateJobInput({ tool, workflowSlug: item.slug, presetId: item.presets[0].id, inputs: { ...inputs, [field.id]: " \n " } }));
        }
      }
    }
    for (const alias of ["auto", "hip-hop", "rap", "r&b", "nu-metal", "heavy-metal"]) {
      const input = { tool: "music", workflowSlug: "music", presetId: alias, inputs: { brief: literal, genre: alias } };
      assert.deepEqual(validateJobInput(input), input, "Legacy IDs stay valid without silently repairing tokens");
    }
    validateJobInput({ tool: "director", workflowSlug: "director", presetId: "noir", inputs: { brief: literal, look: "noir", template: "", genre: "auto" } });
    const videoMusic = { tool: "music", workflowSlug: "music", presetId: "street", inputs: { mode: "music-video", brief: literal, runtime: "90", seconds: "90" } };
    assert.equal(validateJobInput(videoMusic).presetId, "street");
    for (const key of ["runtime", "seconds"]) for (const value of ["9", "91", "300"]) {
      assert.throws(() => validateJobInput({ ...videoMusic, inputs: { ...videoMusic.inputs, [key]: value } }), /10–90/, "Music video cannot inherit full-song duration limits");
    }
    for (const mode of ["tiktok", " video", "unknown"]) assert.throws(() => validateJobInput({ ...videoMusic, inputs: { ...videoMusic.inputs, mode } }), /mode/);
    assert.equal(validateJobInput({ tool: "music", workflowSlug: "music", presetId: "pop", inputs: { mode: "song", brief: literal, seconds: "300" } }).inputs.seconds, "300");
    assert.throws(() => validateJobInput({ ...videoMusic, inputs: { ...videoMusic.inputs, scoreSource: "upload" } }), /soundtrack/);
    console.log("PASS separate Song 10–300s and Music video 10–90s intake contracts");
    const uploaded = { ...dream, inputs: { prompt: literal, referenceImage: "owned123.png" }, referenceImagePath: path.join(scratch, ".data", "uploads", "owned123.png") };
    assert.throws(() => validateJobInput(uploaded), /server-owned|upload/i);
    assert.deepEqual(validateJobInput(uploaded, { trustedUploads: true }), uploaded);
    assert.throws(() => validateJobInput({ ...dream, inputs: { prompt: literal, referenceJobId: "r".repeat(10) } }, { trustedUploads: true }), /resolve|reference/i, "Runner entry must not silently discard an unresolved reference");
    console.log("PASS shared Zod input contract, catalog-required fields, literal preservation and exact legacy IDs");
    const reference = await import("../src/lib/jobs/reference");
    await assert.rejects(reference.saveReferenceBytes(Buffer.from("<svg/>"), ".svg"), /format|type/i);
    await assert.rejects(reference.saveReferenceBytes(Buffer.from("<html/>"), ".png"), /format|type/i);
    await assert.rejects(reference.saveReferenceBytes(PNG, "../escape"), /format|type/i);
    for (const [kind, name, type, size] of [
      ["referenceImage", "large.png", "image/png", 8 * 1024 * 1024 + 1],
      ["soundtrack", "large.wav", "audio/wav", 64 * 1024 * 1024 + 1],
      ["voiceSample", "large.wav", "audio/wav", 8 * 1024 * 1024 + 1],
      ["referenceImage", "image.svg", "image/svg+xml", 10],
      ["soundtrack", "score.exe", "audio/wav", 10],
      ["voiceSample", "sample.mp3", "audio/mpeg", 10],
    ] as const) {
      const file = new File([PNG], name, { type });
      Object.defineProperty(file, "size", { value: size });
      let buffered = false;
      file.arrayBuffer = async () => { buffered = true; throw new Error("must not buffer invalid file"); };
      await assert.rejects(reference.saveUpload(file, kind), /size|8|64|format|type/i);
      assert.equal(buffered, false, "Check metadata before any upload buffering");
    }
    const wav = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVEfmt "), Buffer.alloc(40)]);
    for (const [name, type, bytes] of [["score.wav", "audio/wav", wav], ["score.flac", "audio/flac", Buffer.from("fLaCtest")], ["score.mp3", "audio/mpeg", Buffer.from("ID3test")]] as const) {
      const file = new File([bytes], name, { type });
      const saved = await reference.saveUpload(file, "soundtrack");
      assert.deepEqual(await fs.readFile(saved.dest), bytes);
    }
    await assert.rejects(reference.saveUpload(new File([PNG], "score.wav", { type: "audio/wav" }), "soundtrack"), /format|type/i);
    const form = new FormData();
    form.set("tool", "dream"); form.set("workflowSlug", "dream"); form.set("presetId", "photo");
    form.set("inputs", JSON.stringify({ prompt: "cup", referenceImageUrl: "https://image.example/photo" }));
    form.set("voiceSample", new File(["bad"], "bad.txt", { type: "text/plain" }));
    const noContact = () => { throw new Error("Unexpected network contact before upload validation"); };
    const guardFetch = mock.method(globalThis, "fetch", noContact);
    const guardDns = mock.method(dns, "lookup", noContact);
    const guardHttp = mock.method(http, "request", noContact);
    const guardHttps = mock.method(https, "request", noContact);
    try {
      assert.equal((await POST(new Request("http://unit.test/api/jobs", { method: "POST", body: form }))).status, 400);
      for (const guard of [guardFetch, guardDns, guardHttp, guardHttps]) assert.equal(guard.mock.callCount(), 0);
    } finally { mock.restoreAll(); }
    console.log("PASS image signatures, image/score/voice metadata limits before buffering and before network contact");
    const malformedForm = await POST(new Request("http://unit.test/api/jobs", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: "broken multipart" }));
    assert.equal(malformedForm.status, 400, "Malformed multipart input must not escape as a 500");
    const { readRequestPayload } = await import("../src/lib/jobs/input");
    let consumed = 0;
    let cancelled = false;
    const incoming = new ReadableStream<Uint8Array>({
      pull(controller) { consumed++; controller.enqueue(new Uint8Array(20)); },
      cancel() { cancelled = true; },
    });
    const streaming = new Request("http://unit.test/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: incoming, duplex: "half" } as RequestInit);
    await assert.rejects(readRequestPayload(streaming, "json", 40), /large|limit/i);
    assert.ok(consumed < 10 && cancelled, "Request cap must stop reading a chunked body, not check after buffering");
    assert.equal((await POST(new Request("http://unit.test/api/jobs", { method: "POST", headers: { "content-type": "application/json", "content-length": "999999999" }, body: "{}" }))).status, 400);
    const setTimer = globalThis.setTimeout;
    mock.method(globalThis, "setTimeout", (fn: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => setTimer(fn, ms === 30000 ? 25 : ms, ...args));
    try {
      const never = new Request("http://unit.test/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: new ReadableStream(), duplex: "half" } as RequestInit);
      await assert.rejects(readRequestPayload(never, "json", 40), /timed out/i);
    } finally { mock.restoreAll(); }
    let parserCancelled = false;
    const invalidMultipart = new Request("http://unit.test/api/jobs", {
      method: "POST", headers: { "content-type": "multipart/form-data" },
      body: new ReadableStream({ cancel() { parserCancelled = true; } }), duplex: "half",
    } as RequestInit);
    await assert.rejects(readRequestPayload(invalidMultipart, "form", 40), /Malformed/);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(parserCancelled, true, "Early parser failure must cancel the unread request stream");
    console.log("PASS malformed multipart, chunked request byte caps and request deadlines");
    const { saveJob, getJob } = await import("../src/lib/jobs/store");
    const { writeSettings } = await import("../src/lib/settings");
    await writeSettings({ generationMode: "mock", ollamaUrl: "", comfyUrl: "", studioUrl: "" });
    const sourceImage = await reference.saveReferenceBytes(PNG, ".png");
    const sourceId = "r".repeat(10);
    const source = {
      id: sourceId, tool: "dream" as const, workflowSlug: "dream", workflowName: "Create",
      presetId: "photo", presetLabel: "Photo", status: "completed" as const, progress: 100,
      prompt: "cup", negativePrompt: "", aspect: "1:1", inputs: { prompt: "cup", referenceImage: sourceImage.name },
      modeUsed: "mock" as const, referenceImagePath: sourceImage.dest, outputs: [],
      createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    };
    await saveJob(source);
    mock.method(globalThis, "fetch", async () => { throw new Error("offline fixture: no external service"); });
    try {
      const reused = await post({ ...dream, inputs: { prompt: "cup", referenceJobId: sourceId, visualQa: "off" } });
      assert.equal(reused.status, 201, "A saved Create reference must be reused server-side, not silently lost");
      const reusedJob = (await reused.json()).job;
      assert.deepEqual(await fs.readFile(reusedJob.referenceImagePath), PNG);
      assert.notEqual(reusedJob.referenceImagePath, sourceImage.dest, "New job owns a validated snapshot, not a later-swappable source path");
      // Let the isolated mock job finish before removing its scratch tree.
      for (let i = 0; i < 100; i++) {
        const job = await getJob(reusedJob.id);
        if (job?.status === "completed" || job?.status === "failed") break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.ok(["completed", "failed"].includes((await getJob(reusedJob.id))?.status || ""), "Isolated job must settle before scratch cleanup");
      for (const referenceJobId of ["../settings", ` ${sourceId}`, "x".repeat(10)]) {
        assert.equal((await post({ ...dream, inputs: { prompt: "cup", referenceJobId } })).status, 400);
      }
      for (const patch of [
        { referenceImagePath: undefined },
        { referenceImagePath: 123 as unknown as string },
        { referenceImagePath: path.join(scratch, "outside.png") },
        { referenceImagePath: path.join(scratch, ".data", "uploads", "missing0.png") },
        { tool: "music" as const },
      ]) {
        await saveJob({ ...source, ...patch });
        assert.equal((await post({ ...dream, inputs: { prompt: "cup", referenceJobId: sourceId } })).status, 400);
      }
      const symlink = path.join(scratch, ".data", "uploads", "symlink0.png");
      await fs.symlink(sourceImage.dest, symlink);
      await saveJob({ ...source, referenceImagePath: symlink });
      assert.equal((await post({ ...dream, inputs: { prompt: "cup", referenceJobId: sourceId } })).status, 400);
      const fifo = path.join(scratch, ".data", "uploads", "fifo0000.png");
      execFileSync("mkfifo", [fifo]);
      await saveJob({ ...source, referenceImagePath: fifo });
      assert.equal((await post({ ...dream, inputs: { prompt: "cup", referenceJobId: sourceId } })).status, 400, "A real FIFO must reject without blocking open");
      await saveJob(source);
      const multipartReuse = new FormData();
      multipartReuse.set("tool", "dream"); multipartReuse.set("workflowSlug", "dream"); multipartReuse.set("presetId", "photo");
      multipartReuse.set("inputs", JSON.stringify({ prompt: "cup", referenceJobId: "x".repeat(10) }));
      multipartReuse.set("referenceJobId", sourceId);
      assert.equal((await POST(new Request("http://unit.test/api/jobs", { method: "POST", body: multipartReuse }))).status, 400, "Conflicting reference IDs cannot override each other");
    } finally { mock.restoreAll(); }
    console.log("PASS saved-job reference reuse, exact IDs, owned snapshots and missing/foreign/symlink rejection");
  } finally {
    process.chdir(cwd);
    await fs.rm(scratch, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
