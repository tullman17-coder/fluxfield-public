import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function main() {
  const cwd = process.cwd(), fetchBefore = globalThis.fetch;
  const keys = ['ZERMO_API_BASE','ZERMO_API_KEY','ZERMO_API_KEY_FILE'] as const;
  const env = Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fluxfield-contract-'));
  process.chdir(tmp); process.env.ZERMO_API_BASE='http://127.0.0.1:1';
  process.env.ZERMO_API_KEY=randomUUID(); delete process.env.ZERMO_API_KEY_FILE;
  try {
    const { generateZermoText } = await import('../src/lib/adapters/zermo');
    globalThis.fetch = async () => Response.json({ model:'fixture-writer', choices:[{finish_reason:'length',message:{content:'A truncated, unfinished'}}] });
    await assert.rejects(generateZermoText('Preserve the entire sentence.'), /truncated/, 'nonempty partial text must not masquerade as finished writing');
    globalThis.fetch = async () => Response.json({ model:'fixture-writer', choices:[{finish_reason:'stop',message:{content:'Finished.'}}] });
    assert.equal((await generateZermoText('Complete sentence.')).text, 'Finished.');
    const { runZermoAdapter } = await import('../src/lib/adapters/zermo');
    const { saveJob } = await import('../src/lib/jobs/store');
    const { default: sharp } = await import('sharp');
    const png = await sharp({create:{width:256,height:512,channels:3,background:'#0f0'}}).png().toBuffer();
    const job = { id:'batch-contract', tool:'dream' as const, workflowSlug:'dream',workflowName:'Test',presetId:'cartoon',presetLabel:'Cartoon',status:'running' as const,progress:0,prompt:'A three-eyed cartoon',negativePrompt:'',aspect:'1:2',inputs:{seed:'18446744073709551614',size:'256x512'},modeUsed:'zermo' as const,outputs:[],createdAt:'2026-09-21T00:00:00Z',updatedAt:'2026-09-21T00:00:00Z' };
    await saveJob(job);
    const requests: {seed:unknown,prompt:string}[]=[];
    globalThis.fetch = async (url,init) => {
      if(String(url).includes('/assets/')) return new Response(png,{headers:{'content-type':'image/png'}});
      assert.equal(init?.method,'POST'); requests.push(JSON.parse(String(init?.body)));
      const id=String(requests.length).padStart(32,'0');
      return Response.json({id:'job_'+id,state:'succeeded',effective:{settings:{width:256,height:512}},outputs:['asset_'+id]});
    };
    const result=await runZermoAdapter({job,settings:{generationMode:'zermo'} as import('../src/lib/adapters/types').StudioSettings},4);
    assert.equal(result.outputs.length,4);
    assert.deepEqual(requests.map(r=>r.seed),['18446744073709551614','18446744073709551615','0','1'],'each variation gets a distinct exact uint64 seed');
    const { fitZermoSize } = await import('../src/lib/adapters/zermo-image-size');
    assert.deepEqual(fitZermoSize(3,2),{width:1008,height:672},'aspect and 16px Qwen grid must both hold');
    assert.deepEqual(fitZermoSize(9,16),{width:576,height:1024});
    assert.deepEqual(fitZermoSize(21,9),{width:1008,height:432});
    console.log('PASS: complete writing + exact batch seeds + native-grid aspect');
    const { runZermoVideoAdapter } = await import('../src/lib/adapters/zermo');
    const opener=path.join(tmp,'opener.png'); await fs.writeFile(opener,png);
    const canvases=[['16:9',640,352],['9:16',352,640],['1:1',448,448],['2.39:1',640,256]] as const;
    for(const [aspect,width,height] of canvases) {
      const clipJob={...job,id:'canvas-'+aspect.replace(/\W/g,''),aspect,inputs:{}}; await saveJob(clipJob);
      let emitted: unknown;
      globalThis.fetch=async (url,init)=>{
        if(String(url).endsWith('/assets')) return Response.json({id:'asset_'+'a'.repeat(32)});
        if(String(url).includes('/assets/')) return new Response(Buffer.from('0000ftypfixture'),{headers:{'content-type':'video/mp4'}});
        const req=JSON.parse(String(init?.body)); emitted=req.settings;
        return Response.json({id:'job_'+'a'.repeat(32),state:'succeeded',effective:{settings:req.settings},outputs:['asset_'+'b'.repeat(32)]});
      };
      await runZermoVideoAdapter({job:clipJob,settings:{generationMode:'zermo'} as import('../src/lib/adapters/types').StudioSettings},opener,'wave');
      assert.deepEqual(emitted,{frames:49,steps:8,width,height});
      assert.ok(width*height<=640*352);
    }
    console.log('PASS: every WAN canvas reaches the worker inside the existing pixel budget');
  } finally {
    globalThis.fetch=fetchBefore; process.chdir(cwd);
    for(const key of keys) if(env[key]===undefined) delete process.env[key]; else process.env[key]=env[key];
    await fs.rm(tmp,{recursive:true,force:true});
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
