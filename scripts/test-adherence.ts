import assert from 'node:assert/strict';
import type { StudioSettings } from '../src/lib/adapters/types';
import { reviewImageWithVision } from '../src/lib/adapters/ollama';

async function main() {
  const original = globalThis.fetch;
  const previous = process.env.FLUXFIELD_VISION_URL;
  process.env.FLUXFIELD_VISION_URL = 'http://127.0.0.1:18083';
  const check = { ok: true, issues: [] };
  const valid = { ok: true, anatomy: check, text: check, adherence: check, repair: '' };
  let raw: unknown = valid;
  let vision = true;
  let active = 0, peak = 0, calls = 0;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    assert.ok(u.startsWith('http://127.0.0.1:18083/'), 'QA must not use the public two-user API');
    if (u.endsWith('/props')) return Response.json({ modalities: { vision } });
    if (u.endsWith('/v1/models')) return Response.json({ data: [{ id: 'fixture-vision' }] });
    assert.ok(u.endsWith('/v1/chat/completions'));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'fixture-vision');
    assert.equal(body.response_format?.type, 'json_schema');
    assert.ok(body.messages.some((m: {content: unknown}) => Array.isArray(m.content)));
    calls++; active++; peak = Math.max(peak, active);
    await new Promise(r => setTimeout(r, 20)); active--;

    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(raw) } }] });
  };
  const settings = { generationMode: 'zermo' } as StudioSettings;
  const run = () => reviewImageWithVision(settings, { imageDataUri: 'data:image/png;base64,aGVybWV0aWM=', prompt: 'Three-eyed silly cartoon; exactly three eyes, not a human.' });
  try {
    const good = await run();
    assert.equal(good.status, 'checked', 'managed QA must actually call the existing Studio vision lane');
    assert.ok(good.status === 'checked' && good.review.ok);
    assert.equal(good.status === 'checked' && good.review.model, 'fixture-vision');

    for (const bad of [{}, { ...valid, ok: 'true' }, { ...valid, adherence: undefined },
      { ...valid, text: { ok: true, issues: ['missing required quote'] } },
      { ...valid, anatomy: { ok: false, issues: [] } }, { ...valid, ok: false }]) {
      raw = bad; const result = await run();
      assert.notEqual(result.status, 'checked', 'malformed or contradictory model reviews must not count as checks');
    }
    raw = { ...valid, ok: false, adherence: { ok: false, issues: ['Two eyes instead of the requested three'] }, repair: 'Preserve three eyes.' };
    const failed = await run(); assert.ok(failed.status === 'checked' && !failed.review.ok);
    raw = valid; await Promise.all([run(), run()]); assert.equal(peak, 1, 'Studio reviewer is serial');

    const before = calls; vision = false;
    assert.notEqual((await run()).status, 'checked'); assert.equal(calls, before, 'a text-only endpoint must not receive images');
    console.log('PASS: managed Studio vision, strict schema, intentional anatomy, explicit failure and serial review');
  } finally {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.FLUXFIELD_VISION_URL; else process.env.FLUXFIELD_VISION_URL = previous;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
