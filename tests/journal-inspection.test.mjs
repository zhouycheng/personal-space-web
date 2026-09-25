import test from 'node:test';
import assert from 'node:assert/strict';
import {journalSingle,constrainReading,readingLimits} from '../src/application/journal/inspection.ts';
test('journal fits two readable pages without requiring a landscape window',()=>{
  assert.equal(journalSingle(918,970),false);
  assert.equal(journalSingle(760,640),false);
  assert.equal(journalSingle(759,970),true);
  assert.equal(journalSingle(1440,639),true);
  assert.equal(journalSingle(390,844),true);
});
test('reading angles remain legible even after large object rotations',()=>{
  assert.deepEqual(constrainReading(7,-8),{pitch:readingLimits.pitch,yaw:-readingLimits.yaw});
  assert.deepEqual(constrainReading(.1,.2),{pitch:.1,yaw:.2});
});
