import assert from 'node:assert/strict';
import { validateJobInput } from '../src/lib/jobs/input';
import { IMAGE2_WRAPPERS, sampleValues } from '../src/lib/wrappers/catalog';
import { WORKFLOWS, MANAGED_MOTION_LENGTHS } from '../src/lib/workflows';
import { EXPLAINER_PRESETS } from '../src/lib/explainer/presets';
import { VIDEO_WORKFLOWS } from '../src/lib/video-workflows/catalog';
import { fitZermoSize } from '../src/lib/adapters/zermo-image-size';

assert.deepEqual(fitZermoSize(1.91,1), {width:1008,height:528}, 'valid display aspect must fit the native grid without rejection');

let checked=0;
for(const style of EXPLAINER_PRESETS)for(const length of MANAGED_MOTION_LENGTHS){
 assert.doesNotThrow(()=>validateJobInput({tool:'explainer',workflowSlug:'explainer',presetId:style.id,inputs:{topic:'A silly green creature explains rain',duration:length.id,seconds:String(length.seconds),voice:'none',subtitles:'off',visualQa:'on'}}),`${style.id}/${length.id} must survive the actual server intake`);checked++;
}
for(const def of VIDEO_WORKFLOWS)for(const length of MANAGED_MOTION_LENGTHS){
 assert.doesNotThrow(()=>validateJobInput({tool:def.id,workflowSlug:def.id,presetId:def.defaultMode,inputs:{brief:'A playful cartoon rain dance',duration:length.id,seconds:String(length.seconds),voice:'none',subtitles:'off',visualQa:'on'}}));checked++;
}
for(const wrapper of IMAGE2_WRAPPERS)for(const preset of wrapper.presets){
 assert.doesNotThrow(()=>validateJobInput({tool:'image2',workflowSlug:wrapper.slug,presetId:preset.id,inputs:{...sampleValues(wrapper),dreamStyle:'',visualQa:'on'}}));checked++;
}
for(const workflow of WORKFLOWS)for(const preset of workflow.presets){
 const inputs=Object.fromEntries(workflow.inputs.filter(f=>f.type!=='file').map(f=>[f.id,f.type==='select'?(f.options?.[0]?.value||''):f.placeholder||'Literal $1 {{unchanged}}']));
 assert.doesNotThrow(()=>validateJobInput({tool:'workflow',workflowSlug:workflow.slug,presetId:preset.id,inputs}));checked++;
}
console.log(`PASS: ${checked} catalog/length/form combinations survive real intake`);
