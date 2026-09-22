import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

async function main(){
 const cwd=process.cwd(), original=globalThis.fetch;
 const keys=['ZERMO_API_BASE','ZERMO_API_KEY','ZERMO_API_KEY_FILE'] as const;
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'fluxfield-runner-'));process.chdir(tmp);
 process.env.ZERMO_API_BASE='http://127.0.0.1:1';process.env.ZERMO_API_KEY=randomUUID();delete process.env.ZERMO_API_KEY_FILE;
 const bodies: Record<string,unknown>[]=[];const jobs=new Map<string,{id:string,state:string,effective:unknown,outputs:string[]}>();
 const sizes=new Map<string,{width:number,height:number}>();let writerFailure=false;
 try{
   await fs.mkdir('.data/uploads',{recursive:true});await fs.writeFile('.data/settings.json',JSON.stringify({generationMode:'zermo',ffmpegEnabled:false}));
   await sharp({create:{width:512,height:512,channels:3,background:'#83ca9d'}}).png().toFile('.data/uploads/abcdefgh.png');
   globalThis.fetch=async(url,init)=>{
     const u=String(url);
     if(u.endsWith('/chat/completions')){
       if(writerFailure){writerFailure=false;return Response.json({error:'fixture writer outage'},{status:503});}
       return Response.json({model:'fixture-writer',choices:[{finish_reason:'stop',message:{content:'HEADLINE: GOOP after dark\nSUBHEAD: A playful original design.\nCTA: See the art\nBEATS:\n1) Meet GOOP\n2) A silly turn\n3) The payoff'}}]});
     }
     if(u.includes('/assets/')){const size=sizes.get(u.split('/').pop()!)!;return new Response(await sharp({create:{...size,channels:3,background:'#83ca9d'}}).png().toBuffer(),{headers:{'content-type':'image/png'}});}
     if(init?.method==='POST'){
       const body=JSON.parse(String(init.body));bodies.push(body);assert.equal(body.operation,'image.generate');
       const suffix=String(bodies.length).padStart(32,'0'),id='job_'+suffix,asset='asset_'+suffix;
       const state={id,state:'succeeded',effective:{settings:body.settings},outputs:[asset]};jobs.set(id,state);sizes.set(asset,body.settings);
       return Response.json(state);
     }
     const state=jobs.get(u.split('/').pop()!);assert.ok(state);return Response.json(state);
   };
   const {createAndRunJob,resumeJob}=await import('../src/lib/jobs/runner');
   const {getJob}=await import('../src/lib/jobs/store');
   const {IMAGE2_WRAPPERS,sampleValues}=await import('../src/lib/wrappers/catalog');
   const {WORKFLOWS}=await import('../src/lib/workflows');
   const done=async(id:string)=>{for(let i=0;i<600;i++){const j=await getJob(id);if(j&&['completed','failed'].includes(j.status))return j;await new Promise(r=>setTimeout(r,10));}throw new Error('fixture job did not finish');};
   const wrapper=IMAGE2_WRAPPERS.find(w=>w.slug==='ecommerce-banner')!;
   const layout=await createAndRunJob({tool:'image2',workflowSlug:wrapper.slug,presetId:wrapper.presets[0].id,
     referenceImagePath:path.join(tmp,'.data/uploads/abcdefgh.png'),
     inputs:{...sampleValues(wrapper),referenceImage:'abcdefgh.png',composeOnly:'on',visualQa:'off',headline:'GOOP',bodyCopy:'Original art.',cta:'Look',maxDim:'600'}});
   const layoutResult=await done(layout.id);assert.equal(layoutResult.status,'completed',layoutResult.error);
   assert.equal(bodies.length,0,'layout-only must not enqueue Qwen');
   assert.equal(layoutResult.outputs.filter(o=>o.kind==='image').length,2,'retain source plus composed image');
   const market=WORKFLOWS.find(w=>w.slug==='marketplace-pack')!;
   const values=Object.fromEntries(market.inputs.filter(f=>f.type!=='file').map(f=>[f.id,f.type==='select'?(f.options?.[0]?.value||''):f.placeholder||'GOOP']));
   const pack=await createAndRunJob({tool:'workflow',workflowSlug:market.slug,presetId:market.presets[0].id,inputs:{...values,visualQa:'off',seed:'42'}});
   const packResult=await done(pack.id);assert.equal(packResult.status,'completed',packResult.error);
   assert.equal(bodies.length,4,'marketplace needs four actual requests');assert.equal(new Set(bodies.map(b=>b.prompt)).size,4,'each pack frame has its own role');
   assert.equal(packResult.outputs.filter(o=>o.kind==='image').length,4,'clean product pack must not add compositor chrome');
   const raw='  A green cartoon monster says "DAMN".\nKeep the three eyes.  ';
   writerFailure=true;
   const campaign=await createAndRunJob({tool:'dream',workflowSlug:'dream',presetId:'anime',inputs:{prompt:raw,brandName:'GOOP',campaignCopy:'true',visualQa:'off',assist:'off',ratio:'square',size:'512x512'}});
   const failed=await done(campaign.id);assert.equal(failed.status,'failed','missing campaign copy is not a completed campaign');
   assert.ok(failed.outputs.some(o=>o.kind==='image'),'writing failure retains the rendered art');
   assert.ok(failed.prompt.startsWith(raw),'raw prompt whitespace and quoted language survive');
   assert.equal(failed.originalInputs?.prompt,raw);
   const submitted=bodies.length;await resumeJob(campaign.id);const recovered=await done(campaign.id);
   assert.equal(recovered.status,'completed',recovered.error);assert.equal(bodies.length,submitted,'campaign retry must reuse the durable image');
   assert.ok(recovered.outputs.some(o=>o.label==='Campaign copy'&&o.text?.includes('GOOP')));
   const legacyPreset=WORKFLOWS.find(w=>w.slug==='product-motion')!.presets[0].id;
   const legacy=await createAndRunJob({tool:'workflow',workflowSlug:'product-motion',presetId:legacyPreset,inputs:{productName:'GOOP',productDescription:'A green toy',visualQa:'off'}});
   assert.equal(legacy.tool,'ugc','legacy video route must use the real motion executor');
   await done(legacy.id); // ffmpeg-disabled fixture rejects before any GPU work
   console.log('PASS: zero-render layout reuse; 4 distinct clean pack shots; durable campaign recovery; legacy video routing');
 }finally{globalThis.fetch=original;process.chdir(cwd);for(const key of keys)if(before[key]===undefined)delete process.env[key];else process.env[key]=before[key];await fs.rm(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
