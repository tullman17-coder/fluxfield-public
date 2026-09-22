import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import React, { createElement } from "react";
import { mock } from "node:test";
import { renderToStaticMarkup, renderToReadableStream } from "react-dom/server";
import { GENRES, keyLabel, planArrangement } from "../src/lib/music/theory";
import { applyMusicChip, interpretMusicBrief } from "../src/lib/music/brief";
import { lyricSheetToSrt, timedLyricCues, wanLyricPrompt } from "../src/lib/music/lyrics";
import type { AdapterContext, StudioJob } from "../src/lib/adapters/types";
import type { ZermoRequest } from "../src/lib/adapters/zermo";

async function main() {
  const cwd = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "fluxfield-music-contracts-"));
  const originalFetch = globalThis.fetch;
  const env = { ...process.env };
  process.chdir(tmp); // All settings, job persistence and uploads are disposable.
  process.env.ZERMO_API_KEY = randomUUID();
  delete process.env.ZERMO_API_KEY_FILE;
  process.env.ZERMO_API_BASE = "http://127.0.0.1:1";
  try {
    const { runMusicAdapter } = await import("../src/lib/adapters/music");
    const { validateJobInput } = await import("../src/lib/jobs/input");
    const intake = {tool:'music', workflowSlug:'music', presetId:'pop', inputs:{brief:'A cartoon score',genre:'pop',lyricMode:'instrumental',bpm:'137.5'}};
    assert.throws(()=>validateJobInput(intake),/bpm/, 'fractional tempo must reject at intake, not at the worker');
    for(const bpm of ['30','137','300']) assert.equal(validateJobInput({...intake,inputs:{...intake.inputs,bpm}}).inputs.bpm,bpm);
    const longMusic = {tool:'music',workflowSlug:'music',presetId:'pop',inputs:{brief:'Original cartoon',seconds:'300'}};
    assert.equal(validateJobInput(longMusic).inputs.seconds, '300');
    for (const bad of ['9','301','3600']) assert.throws(() => validateJobInput({...longMusic,inputs:{...longMusic.inputs,seconds:bad}}), /10–300/);
    const { saveJob, getJob } = await import("../src/lib/jobs/store");
    const settings = { generationMode: "zermo" } as AdapterContext["settings"];
    const requests: { inputs: Record<string, string>; request: ZermoRequest; writer: string }[] = [];
    const uploads: { mime: string; bytes: Buffer }[] = [];
    let submitted: ZermoRequest | undefined;
    let writer = "";
    let succeed = false;
    let posts = 0;
    let mediaPosts = 0;
    globalThis.fetch = async (url, init) => {
      assert.ok(String(url).startsWith("http://127.0.0.1:1/v1/"), "no real network");
      if (init?.method !== "POST") {
        assert.ok(succeed);
        if (String(url).includes("/media/assets/")) return new Response(Buffer.from("fLaC-transport-fixture-not-a-recording"), { headers: { "content-type": "audio/flac" } });
        assert.ok(String(url).includes("/media/jobs/"));
        return Response.json({ id: "job_" + "a".repeat(32), state: "succeeded", outputs: ["asset_" + "b".repeat(32)], effective: {} });
      }
      assert.equal(init?.method, "POST");
      posts++;
      if (String(url).endsWith("/chat/completions")) {
        const body = JSON.parse(String(init?.body));
        writer = body.messages[0].content;
        return Response.json({ model: "fixture-writer", choices: [{ finish_reason: "stop", message: { content: "[Verse]\nFixture first line\nFixture second line\n[Chorus]\nFixture hook\nFixture refrain" } }] });
      }
      if (String(url).endsWith("/media/assets")) {
        uploads.push({ mime: new Headers(init?.headers).get("content-type")!, bytes: Buffer.from(init?.body as Uint8Array) });
        return Response.json({ id: "asset_" + "b".repeat(32) });
      }
      assert.ok(String(url).endsWith("/media/jobs"));
      mediaPosts++;
      submitted = JSON.parse(String(init?.body));
      // Deliberate terminal response: prove the real POST without audio or ffmpeg.
      return Response.json({ id: "job_" + "a".repeat(32), state: succeed ? "succeeded" : "failed", error: "fixture stop after request", outputs: succeed ? ["asset_" + "b".repeat(32)] : [], effective: {} });
    };
    async function request(inputs: Record<string, string>) {
      submitted = undefined;
      writer = "";
      const job: StudioJob = {
        id: `music-contract-${requests.length}`, tool: "music", workflowSlug: "music", workflowName: "Music",
        presetId: inputs.genre || "auto", presetLabel: "Fixture", status: "running", progress: 0,
        prompt: inputs.brief || "song about rain", negativePrompt: "", aspect: "16:9", inputs: { seconds: "30", ...inputs },
        modeUsed: "zermo", outputs: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
      };
      await saveJob(job);
      await assert.rejects(runMusicAdapter({ job, settings }), /Zermo failed/);
      assert.ok(submitted, "real adapter reached the intercepted ACE POST");
      const body = submitted as ZermoRequest;
      assert.deepEqual((await getJob(job.id))?.zermoJobs?.["music:track"].request, body, "persisted intent equals POST");
      assert.equal(body.operation, "music.generate");
      assert.equal(body.model, "ace-step-1.5-turbo");
      assert.notEqual((body.settings as Record<string, unknown>).generate_audio_codes, true);
      requests.push({ inputs, request: body, writer });
      return { body, writer, job };
    }

    for(const bpm of [137.5,29,301,NaN,Infinity]) assert.throws(()=>planArrangement({genre:'pop',targetSec:30,seedText:'tempo-contract',bpm}),/BPM.*integer/);
    const invalidJob: StudioJob = {id:'fractional-tempo',tool:'music',workflowSlug:'music',workflowName:'Music',presetId:'pop',presetLabel:'Pop',status:'running',progress:0,prompt:'cartoon score',negativePrompt:'',aspect:'16:9',inputs:{genre:'pop',brief:'cartoon score',lyricMode:'write',seconds:'30',bpm:'137.5'},modeUsed:'zermo',outputs:[],createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};
    await saveJob(invalidJob);
    await assert.rejects(runMusicAdapter({job:invalidJob,settings}),/BPM.*integer/);
    assert.equal(posts,0,'invalid tempo must fail before writer, upload, or media submission');
    const failures: string[] = [];
    for (const seconds of [120,180,240,300]) {
      const long = await request({genre:"pop",lyricMode:"instrumental",seconds:String(seconds)});
      assert.equal(long.body.settings.duration, seconds, "full-song length reaches the durable worker request unchanged");
    }
    for (const seconds of ["9","301","NaN","Infinity"]) {
      const bad = {...invalidJob, id:`invalid-length-${seconds}`, inputs:{...invalidJob.inputs,bpm:"136",seconds}};
      const before: number = posts;
      await assert.rejects(runMusicAdapter({job:bad,settings}), /10–300 seconds/);
      assert.equal(posts,before,"bad duration must not submit writer or GPU work");
    }
    for (const genre of GENRES) {
      for (const mode of ["write", "instrumental"]) {
        const { body, writer, job } = await request({ brief: "song about rain", genre: genre.id, lyricMode: mode, bpm: "137", key: "D" });
        const selected = applyMusicChip(genre.id, interpretMusicBrief(job.inputs.brief));
        try {
          assert.equal(body.settings.bpm, 137);
          assert.equal(body.settings.keyscale, keyLabel(planArrangement({ genre: genre.id, bpm: 137, key: "D", targetSec: 30, seedText: `${job.id}:${job.inputs.brief}` })));
          if (mode === "write") {
            assert.ok(body.prompt.includes(selected.tags));
            assert.ok(writer.includes(`Cadence: ${selected.cadence}`));
            assert.match(writer, /Subject: rain\n/);
            assert.ok(body.settings.lyrics);
          } else {
            assert.match(body.prompt, /\binstrumental\b/);
            assert.doesNotMatch(body.prompt, /\b(?:rap|vocals?|sung|singing|rhyme|shout)\b/i);
            assert.equal(body.settings.lyrics, "");
            assert.equal(writer, "", "instrumental never calls the writer");
          }
          console.log(`PASS request ${genre.id}/${mode}: ${body.prompt}`);
        } catch (error) {
          failures.push(`${genre.id}/${mode}: ${(error as Error).message}`);
        }
      }
    }
    const director = await request({ brief: "song about rain", acePrompt: "Rap style of Eminem about rain. 808 trap drums, dry vocal, punchy mix", genre: "country", lyricMode: "write" });
    try {
      assert.match(director.body.prompt, /country.*acoustic guitar.*pedal steel/);
      assert.doesNotMatch(director.body.prompt, /eminem|\brap\b|808|about rain/i);
      assert.match(director.writer, /Cadence: sung storytelling/);
    } catch (error) { failures.push(`director: ${(error as Error).message}`); }
    assert.deepEqual(failures, [], `${GENRES.length} chips × 2 modes + Director must obey the normalized contract`);

    const ownText = '  [Verse]\nFUCK the alarm — keep THIS punctuation!  \n\n[Chorus]\nNo rewrite, no extra hook.\n';
    const own = await request({ genre: "pop", lyricMode: "own", lyrics: ownText });
    assert.equal(own.body.settings.lyrics, ownText, "own lyrics are byte-for-byte payload text, not a reflowed sheet");
    assert.equal(own.writer, "");
    assert.equal(own.job.inputs.lyrics, ownText);

    for (const [language, expectedLanguage] of [["Explicit, uncensored", /Explicit, uncensored/], ["Clean, no profanity", /Clean, no profanity/]] as const) {
      const styled = await request({ brief: `${language} rap style of Eminem about calling out of work. Keep the plot literal!`, genre: "hiphop", lyricMode: "write" });
      assert.match(styled.writer, expectedLanguage, "language requests before about must survive the split");
      assert.match(styled.writer, /calling out of work\. Keep the plot literal!/);
      assert.match(styled.body.prompt, /rapid-fire rap/);
      assert.doesNotMatch(styled.body.prompt, /eminem/i);
    }
    const ordinary = await request({ brief: "pop song about rain", genre: "pop", lyricMode: "write" });
    assert.doesNotMatch(ordinary.writer, /explicit|uncensored|profanity|clean lyrics/i);
    assert.equal(uploads.length, 0, "a named style alone never becomes a timbre upload");
    await fs.mkdir(path.join(tmp, ".data/uploads"), { recursive: true });
    for (const [ext, bytes, mime] of [
      ["wav", Buffer.from("RIFF0000WAVE-transport-fixture"), "audio/wav"],
      ["flac", Buffer.from("fLaC-transport-fixture"), "audio/flac"],
    ] as const) {
      await fs.writeFile(path.join(tmp, ".data/uploads", `owned.${ext}`), bytes);
      const sample = await request({ genre: "rnb", lyricMode: "own", lyrics: ownText, voiceSample: `owned.${ext}` });
      assert.deepEqual(uploads.at(-1), { mime, bytes });
      assert.equal(sample.body.inputs?.audio, "asset_" + "b".repeat(32));
      assert.equal(sample.body.settings.lyrics, ownText);
    }

    // Exercise completed/resumed adapter outputs with inert transport bytes only.
    // An empty PATH prevents ffmpeg from running; tuning is NOT being tested here.
    process.env.PATH = "";
    succeed = true;
    const firstJob = { ...ordinary.job, id: "music-resume-contract", inputs: { ...ordinary.job.inputs, genre: "hiphop", seconds: "30", bpm: "137", key: "D" } };
    await saveJob(firstJob);
    const first = await runMusicAdapter({ job: firstJob, settings });
    assert.ok(first.lyrics);
    assert.equal(first.arrangement.genre, "hiphop", "trap drums are a detail, not a new selected genre");
    const resumedJob = (await getJob(firstJob.id))!;
    resumedJob.inputs = { ...resumedJob.inputs, genre: "ambient", seconds: "90", bpm: "60", key: "C", lyricMode: "instrumental", lyrics: "unsubmitted replacement" };
    await saveJob(resumedJob);
    const before = posts;
    const resumed = await runMusicAdapter({ job: resumedJob, settings });
    assert.equal(posts, before, "resume must not rewrite words, upload or submit again");
    assert.ok(resumed.lyrics, "saved lyrics must restore Director cues on resume");
    assert.deepEqual(timedLyricCues(resumed.lyrics), timedLyricCues(first.lyrics));
    assert.deepEqual(resumed.arrangement, first.arrangement);
    assert.ok(timedLyricCues(resumed.lyrics).length);
    assert.match(lyricSheetToSrt(resumed.lyrics), /Fixture/);
    assert.match(wanLyricPrompt(timedLyricCues(resumed.lyrics), 29), /Fixture/);
    assert.ok(timedLyricCues(resumed.lyrics).every(c => c.until <= 30));
    assert.equal(resumed.outputs.find(o => o.label === "ACE tags")?.text, resumedJob.zermoJobs!["music:track"].request.prompt);
    assert.ok(resumed.outputs.some(o => o.kind === "storyboard" && /Arrangement/.test(o.label)), "managed Music must expose its estimated arrangement");
    for (const mode of ["own", "instrumental"]) {
      const job = { ...firstJob, id: `music-resume-${mode}`, inputs: { ...firstJob.inputs, lyricMode: mode, lyrics: `${ownText}\n[Keep this literal line]` } };
      await saveJob(job);
      const initial = await runMusicAdapter({ job, settings });
      if (mode === "own") assert.ok(initial.lyrics?.sections.flatMap(s => s.lines).some(l => l.text === "[Keep this literal line]"), "only known section headers are timing metadata");
      else assert.equal(initial.lyrics, null);
      const saved = (await getJob(job.id))!;
      saved.inputs = { ...saved.inputs, lyricMode: mode === "own" ? "instrumental" : "own", lyrics: "replacement" };
      const beforeResume: number = posts;
      const again = await runMusicAdapter({ job: saved, settings });
      assert.equal(posts, beforeResume);
      assert.deepEqual(again.lyrics, initial.lyrics);
      assert.deepEqual(again.arrangement, initial.arrangement);
      assert.equal(again.outputs.find(o => o.label === "Lyrics requested")?.text, mode === "own" ? job.inputs.lyrics : undefined);
    }
    process.env.PATH = env.PATH;

    const { default: MusicPage } = await import("../src/app/music/page");
    const html = renderToStaticMarkup(createElement(MusicPage));
    assert.match(html, /href="\/music\?mode=song"/, "Music owns a Song mode");
    assert.match(html, /href="\/music\?mode=music-video"/, "Music owns a Music video mode");
    const styleControls = html.match(/<legend[^>]*>Style<\/legend>([\s\S]*?)<\/fieldset>/)?.[1] || "";
    assert.equal([...styleControls.matchAll(/aria-pressed=/g)].length, GENRES.length);
    assert.match(html, /<textarea[^>]*id="brief"[^>]*placeholder=""/);
    assert.match(html, /ACE tags/);
    assert.match(html, /keyword.*heuristic/i);
    assert.match(html, /timing estimate/i);
    assert.doesNotMatch(html, /where the hook lands|how loud each part gets/);

    const videoPage = await renderToReadableStream(createElement(MusicPage, { searchParams: Promise.resolve({ mode: "music-video", look: "animated", brief: "A dancing otter" }) }));
    await videoPage.allReady;
    const videoHtml = await new Response(videoPage).text();
    assert.match(videoHtml, /<h1[^>]*>Music<\/h1>/);
    assert.match(videoHtml, /<textarea[^>]*id="brief"[^>]*placeholder=""[^>]*>A dancing otter<\/textarea>/);
    assert.match(videoHtml, /Write ACE/); assert.match(videoHtml, /Drop track/);
    const lengthOptions = videoHtml.match(/<select[^>]*id="runtime"[\s\S]*?<\/select>/)?.[0] || "";
    assert.deepEqual([...lengthOptions.matchAll(/<option value="(\d+)"/g)].map(m => Number(m[1])), [10,15,30,60,90]);
    const { default: DirectorPage } = await import("../src/app/director/page");
    const directorHtml = renderToStaticMarkup(await DirectorPage({ searchParams: Promise.resolve({}) }));
    assert.match(directorHtml, /TikTok/);
    assert.doesNotMatch(directorHtml, /Music video|Write ACE|Drop track|id="genre"/);
    assert.match(directorHtml, /<textarea[^>]*id="brief"[^>]*placeholder=""/);
    for (const query of [{ mode: "music-video", look: "animated", brief: "A dancing otter" }, { look: "animated" }]) {
      await assert.rejects(DirectorPage({ searchParams: Promise.resolve(query) }), (error: unknown) => {
        const digest = (error as { digest: string }).digest;
        assert.match(digest, /NEXT_REDIRECT;replace;\/music\?/);
        const target = new URL(digest.split(";")[2], "http://unit.test");
        assert.equal(target.searchParams.get("mode"), "music-video");
        assert.equal(target.searchParams.get("look"), "animated");
        if (query.brief) assert.equal(target.searchParams.get("brief"), query.brief);
        return true;
      }, "Old music-video query links must enter Music, not TikTok");
    }
    console.log("PASS: Music Song/video SSR; short-form-only Director; blank briefs; bounded video menu; legacy query redirect");

    // Run the actual watch hydration effect without a browser or another test library.
    const { useJobWatch } = await import("../src/lib/jobs/use-job-watch");
    const legacyWatch = { ...firstJob, tool: "director" as const, workflowSlug: "director", inputs: { mode: "music-video" }, updatedAt: new Date().toISOString() };
    const songWatch = { ...legacyWatch, id: "song-watch", tool: "music" as const, workflowSlug: "music", inputs: { mode: "song" } };
    const newVideoWatch = { ...songWatch, id: "video-watch", inputs: { mode: "music-video" } };
    const stored = new Map([["fluxfield:job:director", legacyWatch.id], ["fluxfield:job:music", songWatch.id]]);
    const watchJobs = new Map([legacyWatch, songWatch, newVideoWatch].map(j => [j.id, j]));
    let watched: StudioJob | null = null;
    let effects: React.EffectCallback[] = [];
    const windowBefore = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", { configurable: true, value: { sessionStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    } } });
    mock.method(React, "useState", ((initial: unknown) => [initial, (next: StudioJob | null | ((old: StudioJob | null) => StudioJob | null)) => { watched = typeof next === "function" ? next(watched) : next; }]) as typeof React.useState);
    mock.method(React, "useCallback", ((fn: () => unknown) => fn) as typeof React.useCallback);
    mock.method(React, "useEffect", (effect: React.EffectCallback) => { effects.push(effect); });
    globalThis.fetch = async url => {
      const saved = watchJobs.get(String(url).split("/").pop()!);
      assert.ok(saved, "Watch must reload the exact retained ID");
      return Response.json({ job: saved });
    };
    const hydrate = async (scope: string) => {
      watched = null; effects = [];
      // eslint-disable-next-line react-hooks/rules-of-hooks -- the controlled dispatcher above runs this hook's real hydration effect.
      const watch = useJobWatch(scope);
      const cleanup = effects[0]();
      await new Promise(resolve => setImmediate(resolve));
      if (cleanup) cleanup();
      return { job: watched as StudioJob | null, setJob: watch.setJob };
    };
    try {
      assert.equal((await hydrate("director:tiktok")).job, null, "Director must not hydrate a legacy music video");
      assert.equal((await hydrate("music:music-video")).job?.id, legacyWatch.id, "Music video must recover a remembered legacy Director video");
      const tiktokWatch = { ...legacyWatch, id: "tiktok-watch", inputs: { mode: "tiktok" } };
      watchJobs.set(tiktokWatch.id, tiktokWatch);
      (await hydrate("director:tiktok")).setJob(tiktokWatch);
      assert.equal(stored.get("fluxfield:job:director"), legacyWatch.id, "A new TikTok must not overwrite the legacy music-video watch");
      assert.equal((await hydrate("director:tiktok")).job?.id, tiktokWatch.id);
      assert.equal((await hydrate("music:music-video")).job?.id, legacyWatch.id);
      stored.delete("fluxfield:job:director:tiktok");
      const watch = await hydrate("music:music-video");
      watch.setJob(newVideoWatch);
      assert.equal(stored.get("fluxfield:job:music:music-video"), newVideoWatch.id);
      assert.equal((await hydrate("music:music-video")).job?.id, newVideoWatch.id, "Video reload must prefer its own new job");
      assert.equal((await hydrate("music")).job?.id, songWatch.id, "Song reload must not show the video");
      assert.equal(stored.get("fluxfield:job:director"), legacyWatch.id, "Leave the old watch and persisted ID untouched");
      stored.delete("fluxfield:job:music:music-video");
      stored.set("fluxfield:job:director", newVideoWatch.id);
      assert.equal((await hydrate("music:music-video")).job?.id, newVideoWatch.id, "A cached legacy page may remember the canonical Music response under its old key");
      stored.set("fluxfield:job:director", legacyWatch.id);
      legacyWatch.inputs.mode = "tiktok";
      assert.equal((await hydrate("music:music-video")).job, null, "Director TikTok jobs must never migrate into Music's watch");
      assert.equal((await hydrate("director:tiktok")).job?.id, legacyWatch.id, "Director can recover its old TikTok watch");
    } finally {
      mock.restoreAll();
      if (windowBefore) Object.defineProperty(globalThis, "window", windowBefore);
      else Reflect.deleteProperty(globalThis, "window");
    }
    console.log("PASS: real watch hydration, separate Song/video memory, legacy video-only fallback, exact retained IDs");

    console.log(`PASS: ${GENRES.length}/${GENRES.length} GENRES × write/instrumental, ${mediaPosts} intercepted ACE POSTs, ${uploads.length} owned-timbre uploads; resume cues/SRT/tags/arrangement; SSR controls; no network/audio generation`);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = env;
    process.chdir(cwd);
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
