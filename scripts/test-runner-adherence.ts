import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

async function main(){
 const cwd=process.cwd(), original=globalThis.fetch;
 const keys=['ZERMO_API_BASE','ZERMO_API_KEY','ZERMO_API_KEY_FILE','FLUXFIELD_VISION_URL'] as const;
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'fluxfield-qa-gate-'));process.chdir(tmp);
 process.env.ZERMO_API_BASE='http://127.0.0.1:1';process.env.ZERMO_API_KEY=randomUUID();delete process.env.ZERMO_API_KEY_FILE;
 process.env.FLUXFIELD_VISION_URL='http://127.0.0.1:18083';
 let submits=0,reviews=0;
 const png=await sharp({create:{width:512,height:512,channels:3,background:'#0f0'}}).png().toBuffer();
 try{
   await fs.mkdir('.data');await fs.writeFile('.data/settings.json',JSON.stringify({generationMode:'zermo'}));
   globalThis.fetch=async(url,init)=>{
     const u=String(url);
     if(u.endsWith('/props'))return Response.json({modalities:{vision:true}});
     if(u.endsWith('/v1/models'))return Response.json({data:[{id:'fixture-reviewer'}]});
     if(u.endsWith('/v1/chat/completions')){
       reviews++;const ok=reviews===1;
       return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({ok,anatomy:{ok:true,issues:[]},text:{ok:true,issues:[]},adherence:{ok,issues:ok?[]:['Wrong requested palette']},repair:ok?'':'Use the requested palette.'})}}]});
     }
     if(u.includes('/assets/'))return new Response(png,{headers:{'content-type':'image/png'}});
     assert.ok(u.endsWith('/media/jobs'));assert.equal(init?.method,'POST');
     const id=String(++submits).padStart(32,'0');
     return Response.json({id:'job_'+id,state:'succeeded',effective:{settings:{width:512,height:512}},outputs:['asset_'+id]});
   };
   const {createAndRunJob}=await import('../src/lib/jobs/runner');
   const {getJob}=await import('../src/lib/jobs/store');
   const created=await createAndRunJob({tool:'dream',workflowSlug:'dream',presetId:'anime',inputs:{prompt:'A green silly creature',ratio:'square',size:'512x512',count:'2',visualQa:'on',assist:'off'}});
   let final;for(let i=0;i<500;i++){final=await getJob(created.id);if(final&&['failed','completed'].includes(final.status))break;await new Promise(r=>setTimeout(r,10));}
   assert.equal(final?.status,'failed','a failed second-image review must not finish green');
   assert.equal(reviews,2,'every requested image is checked, not only the first');
   assert.equal(submits,2,'a failed QA gate must not silently regenerate');
   assert.equal(final?.outputs.filter(o=>o.kind==='image').length,2,'failed candidates stay inspectable');
   assert.match(final?.error||'',/review|adherence/i);
   assert.ok(final?.outputs.some(o=>o.label==='Visual QA'&&o.text?.includes('Wrong requested palette')));
   const {checkJobImages}=await import('../src/lib/compose/verify');
   const {readSettings}=await import('../src/lib/settings');
   const {resolveOutputFile}=await import('../src/lib/jobs/store');
   const first=final!.outputs.find(o=>o.kind==='image')!;
   const ctx={settings:await readSettings(),job:final!};
   await checkJobImages(ctx,[first]);assert.equal(reviews,2,'unchanged passed artifact is reused');
   const file=await resolveOutputFile(path.basename(first.url!));assert.ok(file);
   await fs.writeFile(file!,await sharp({create:{width:512,height:512,channels:3,background:'blue'}}).png().toBuffer());
   await assert.rejects(checkJobImages(ctx,[first]),/review|adherence/i,'changed bytes at the same URL require a new review');
   assert.equal(reviews,3);
   console.log('PASS: every image checked; failed QA preserves candidates; byte-bound reuse; no hidden regeneration');
 }finally{globalThis.fetch=original;process.chdir(cwd);for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];await fs.rm(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
