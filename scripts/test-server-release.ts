import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

async function main() {
  const cwd = process.cwd(), tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'flux-server-'));
  process.chdir(tmp);
  process.env.ZERMO_API_KEY = randomUUID();
  process.env.ZERMO_API_BASE = 'http://127.0.0.1:1';
  delete process.env.ZERMO_API_KEY_FILE;
  process.env.LOCAL_STUDIO_API_KEY_FILE = path.join(tmp, 'absent');
  const originalFetch = globalThis.fetch;
  try {
    const { imageRequest, checkZermoHealth } = await import('../src/lib/adapters/zermo');
    const { generateWithOllamaOrThrow, generateMarketingCopy } = await import('../src/lib/adapters/ollama');
    const { formatReviewNote } = await import('../src/lib/compose/verify');
    const { DEFAULT_SETTINGS, publicSettings, writeSettings } = await import('../src/lib/settings');
    const settings = { ...DEFAULT_SETTINGS, generationMode: 'zermo' as const };
    const job = { aspect: '1:1', prompt: 'teapot', negativePrompt: '', inputs: { seed: '18446744073709551615', steps: '4' } };
    assert.equal(imageRequest({ job, settings } as never).seed, job.inputs.seed);
    assert.equal(imageRequest({ job, settings } as never).settings.steps, 4);
    for (const seed of ['18446744073709551616', '-1', '1e3', '1.2', '01', 9007199254740992]) {
      assert.throws(() => imageRequest({ job: { ...job, inputs: { seed } }, settings } as never));
    }
    const media = { worker_availability: 'configured; polled on work', models: [{ id: 'chroma-flash-q4', operations: ['image.generate'] }, { id: 'ace-step-1.5-turbo', operations: ['music.generate'] }] };
    globalThis.fetch = async url => Response.json(String(url).endsWith('/capabilities') ? media : { data: [{ id: 'local-auto', active_model: 'served-uncensored' }] });
    let health = await checkZermoHealth();
    assert.equal(health.ready, true); assert.equal(health.text.model, 'served-uncensored');
    media.worker_availability = 'unconfigured';
    health = await checkZermoHealth(); assert.equal(health.ready, false); assert.equal(health.image.ready, false); assert.equal(health.text.ready, true);
    globalThis.fetch = async () => Response.json({});
    assert.equal((await checkZermoHealth()).ready, false, 'An arbitrary 200 is not readiness');
    globalThis.fetch = async (url, init) => {
      assert.equal(String(url), 'http://127.0.0.1:1/v1/chat/completions');
      assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${process.env.ZERMO_API_KEY}`);
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, 'local-auto');
      assert.equal(body.chat_template_kwargs.enable_thinking, false);
      return Response.json({ model: 'served-uncensored', choices: [{ message: { content: 'Real text' } }] });
    };
    assert.equal((await generateWithOllamaOrThrow(settings, 'test')).model, 'served-uncensored');
    assert.equal(formatReviewNote('Subject', { status: 'skipped', reason: 'local vision server is unreachable' }), 'Subject: skipped (local vision server is unreachable)');
    assert.equal(formatReviewNote('Subject', { status: 'checked', review: { ok: true, anatomy: { ok: true, issues: [] }, text: { ok: true, issues: [] }, repair: '', model: 'vision-model' } }), 'Subject: ok · vision-model');
    await writeSettings({ generationMode: 'zermo' });
    const { POST: improve } = await import('../src/app/api/improve/route');
    const response = await improve(new Request('http://studio.test/api/improve', { method: 'POST', body: JSON.stringify({ prompt: 'A red ceramic cup', provider: 'api' }) }));
    const rewritten = await response.json();
    assert.equal(response.status, 200); assert.equal(rewritten.provider, 'zermo'); assert.equal(rewritten.model, 'served-uncensored');
    globalThis.fetch = async () => new Response('secret upstream body', { status: 503 });
    await assert.rejects(generateMarketingCopy(settings, { wrapperName: 'a', presetLabel: 'b', brandName: 'c', productName: 'd', productDescription: 'e' }), /HTTP 503/);
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '' } }] });
    await assert.rejects(generateWithOllamaOrThrow(settings, 'test'), /empty|nothing/i);
    const saved = await writeSettings({ studioApiKey: 'test-studio', improveApiKey: 'test-improve' });
    const safe = publicSettings(saved);
    assert.equal('studioApiKey' in safe, false); assert.equal('improveApiKey' in safe, false);
    assert.equal(safe.hasStudioApiKey, true);
    const kept = await writeSettings({ studioApiKey: '', improveApiKey: '' });
    assert.equal(kept.studioApiKey, 'test-studio');
    const cleared = await writeSettings({ clearStudioApiKey: true, clearImproveApiKey: true });
    assert.equal(cleared.studioApiKey, ''); assert.equal(cleared.improveApiKey, '');
    const { serveMediaFile } = await import('../src/lib/media-response');
    const file = path.join(tmp, 'track.flac'); await fs.writeFile(file, '0123456789');
    for (const [range, status, body] of [['bytes=2-5', 206, '2345'], ['bytes=-3', 206, '789'], ['bytes=8-', 206, '89'], ['bytes=10-', 416, ''], ['bytes=0-1,3-4', 416, '']] as const) {
      const res = await serveMediaFile(new Request('http://local', { headers: { Range: range } }), file);
      assert.equal(res.status, status); assert.equal(await res.text(), body);
      assert.match(res.headers.get('cache-control')!, /private/);
    }
    const head = await serveMediaFile(new Request('http://local', { method: 'HEAD' }), file);
    assert.equal(await head.text(), ''); assert.equal(head.headers.get('content-length'), '10');
    const { imageDataUri } = await import('../src/lib/jobs/runner');
    await assert.rejects(imageDataUri('/api/outputs/missing.png', true), /subject/i);
    assert.equal(await imageDataUri(undefined, false), undefined);
    await fs.mkdir('.data/outputs', { recursive: true });
    await fs.writeFile('.data/outputs/large.png', Buffer.alloc(8 * 1024 * 1024 + 1));
    await assert.rejects(imageDataUri('/api/outputs/large.png', true), /subject/i);
    console.log('PASS: exact seeds, keyed shared text, no fallback, secret redaction/clear, media Range/HEAD, missing/oversize subject fail closed');
  } finally { globalThis.fetch = originalFetch; process.chdir(cwd); await fs.rm(tmp, { recursive: true, force: true }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
