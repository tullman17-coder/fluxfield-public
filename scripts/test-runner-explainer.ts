import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

async function main(){
 const cwd=process.cwd(),fetchBefore=globalThis.fetch,tmp=await fs.mkdtemp(path.join(os.tmpdir(),'flux-explainer-'));
 const env={...process.env};process.chdir(tmp);process.env.ZERMO_API_BASE='http://127.0.0.1:1';process.env.ZERMO_API_KEY=randomUUID();delete process.env.ZERMO_API_KEY_FILE;
 try{
  await fs.mkdir('.data',{recursive:true});await fs.writeFile('.data/settings.json',JSON.stringify({generationMode:'zermo',ffmpegEnabled:true}));
  const make=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=green:s=64x64:r=16','-frames:v','49','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','clip.mp4']);assert.equal(make.status,0,make.stderr.toString());
  const video=await fs.readFile('clip.mp4');
  const {parseExplainerScript}=await import('../src/lib/adapters/ollama');
  const script='TITLE: Rain\nBEAT 1: [A green creature opens an umbrella.] | [Rain falls from clouds.]\nBEAT 2: [The creature jumps over a puddle.] | [Water gathers on the ground.]\nBEAT 3: [The creature smiles under the clearing sky.] | [The clouds move on.]\nEND CARD: Rain';
  assert.equal(parseExplainerScript(script,3).length,3);
  for(const malformed of ['',script.replace('BEAT 2:','BEAT 1:'),script.replace('BEAT 3:', 'SCENE 3:')])assert.throws(()=>parseExplainerScript(malformed,3));
  const calls:Record<string,unknown>[]=[],states=new Map<string,unknown>(),assets=new Map<string,{bytes:Buffer,type:string}>();let uploads=100;
  const topic='A silly cartoon explains rain. '+ 'Keep the creature green. '.repeat(25)+'LITERAL END: amber umbrella.';
  globalThis.fetch=async(url,init)=>{
   const u=String(url);
   if(u.endsWith('/chat/completions')){
    assert.ok(String(JSON.parse(String(init?.body)).messages[0].content).includes('LITERAL END: amber umbrella.'),'writer must receive the whole topic');
    return Response.json({model:'fixture-writer',choices:[{finish_reason:'stop',message:{content:script}}]});
   }
   if(u.endsWith('/assets')&&init?.method==='POST')return Response.json({id:'asset_'+String(++uploads).padStart(32,'0')});
   if(u.includes('/assets/')){const a=assets.get(u.split('/').pop()!)!;assert.ok(a);return new Response(new Uint8Array(a.bytes),{headers:{'content-type':a.type}});}
   if(u.endsWith('/jobs')&&init?.method==='POST'){
    const b=JSON.parse(String(init.body));calls.push(b);const id='job_'+String(calls.length).padStart(32,'0'),asset='asset_'+String(calls.length).padStart(32,'0');
    const image=b.operation==='image.generate';const bytes=image?await sharp({create:{width:b.settings.width,height:b.settings.height,channels:3,background:'green'}}).png().toBuffer():video;
    assets.set(asset,{bytes,type:image?'image/png':'video/mp4'});const state={id,state:'succeeded',effective:{settings:b.settings},outputs:[asset]};states.set(id,state);return Response.json(state);
   }
   const state=states.get(u.split('/').pop()!);assert.ok(state,`unexpected call ${u}`);return Response.json(state);
  };
  const {EXPLAINER_PRESETS}=await import('../src/lib/explainer/presets');
  const {createAndRunJob}=await import('../src/lib/jobs/runner');const {getJob,resolveOutputFile}=await import('../src/lib/jobs/store');
  const accepted=await createAndRunJob({tool:'explainer',workflowSlug:'explainer',presetId:EXPLAINER_PRESETS[0].id,inputs:{topic,duration:'10s',seconds:'10',voice:'none',subtitles:'off',visualQa:'off',aspect:'9:16'}});
  let result=await getJob(accepted.id);
  for(let i=0;i<6000&&!['failed','completed'].includes(result?.status||'');i++){await new Promise(r=>setTimeout(r,10));result=await getJob(accepted.id);}
  assert.equal(result?.status,'completed',result?.error);assert.equal(calls.filter(c=>c.operation==='image.generate').length,1,'only one opener, no discarded still batch');
  const motion=calls.filter(c=>c.operation==='video.image_to_video');assert.equal(motion.length,4);assert.ok(new Set(motion.map(c=>c.prompt)).size>=3,'parsed scene meaning reaches the WAN chain');
  const cut=result!.outputs.find(o=>o.id===result!.primaryOutputId)!;assert.equal(cut.kind,'video');assert.match(cut.label,/cut/i);
  const file=await resolveOutputFile(path.basename(cut.url!));assert.ok(file);
  const probe=spawnSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file!]);assert.equal(probe.status,0);const media=JSON.parse(probe.stdout.toString());
  const stream=media.streams.find((s:{codec_type:string})=>s.codec_type==='video');assert.equal(stream.width/stream.height,9/16);assert.ok(Math.abs(Number(media.format.duration)-10)<0.13);
  console.log('PASS: strict explainer beats, full literal topic, one Qwen opener, distinct WAN scenes, 10s portrait final-cut primary');
 }finally{globalThis.fetch=fetchBefore;process.chdir(cwd);for(const k of ['ZERMO_API_BASE','ZERMO_API_KEY','ZERMO_API_KEY_FILE'])if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];await fs.rm(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
