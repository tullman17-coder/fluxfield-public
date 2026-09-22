import assert from 'node:assert/strict';
import { localCohereCopy } from '../src/lib/compose/copy';
assert.deepEqual(localCohereCopy({ prompt: 'plain image' }), { brandName: 'Brand', productName: 'Brand', headline: 'Brand', bodyCopy: '', cta: 'Shop now' });
assert.equal(localCohereCopy({ brandName: '  Actual   brand ' }).brandName, '  Actual   brand ');
console.log('PASS: plain-image copy defaults and literal whitespace preservation');
