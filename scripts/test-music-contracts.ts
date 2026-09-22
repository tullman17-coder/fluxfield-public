import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
    const styleControls = html.match(/<legend[^>]*>Style<\/legend>([\s\S]*?)<\/fieldset>/)?.[1] || "";
    assert.equal([...styleControls.matchAll(/aria-pressed=/g)].length, GENRES.length);
    assert.match(html, /<textarea[^>]*id="brief"[^>]*placeholder=""/);
    assert.match(html, /ACE tags/);
    assert.match(html, /keyword.*heuristic/i);
    assert.match(html, /timing estimate/i);
    assert.doesNotMatch(html, /where the hook lands|how loud each part gets/);

    console.log(`PASS: ${GENRES.length}/${GENRES.length} GENRES × write/instrumental, ${mediaPosts} intercepted ACE POSTs, ${uploads.length} owned-timbre uploads; resume cues/SRT/tags/arrangement; SSR controls; no network/audio generation`);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = env;
    process.chdir(cwd);
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
