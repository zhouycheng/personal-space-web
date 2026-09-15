import test from 'node:test';
import assert from 'node:assert/strict';
import { studioFiles } from '../src/data/studioFiles.ts';
import { canOpenFile, snapFileIndex } from '../src/components/studio/fileGesture.ts';

test('file snapping returns below the threshold and advances at most one centered card', () => {
  assert.equal(snapFileIndex(1, 99, 400, 3), 1);
  assert.equal(snapFileIndex(1, -99, 400, 3), 1);
  assert.equal(snapFileIndex(1, 100, 400, 3), 2);
  assert.equal(snapFileIndex(1, -100, 400, 3), 0);
  assert.equal(snapFileIndex(0, 5000, 400, 3), 1);
  assert.equal(snapFileIndex(0, -5000, 400, 3), 0);
  assert.equal(snapFileIndex(2, 5000, 400, 3), 2);
  assert.equal(snapFileIndex(0, 200, 400, 1), 0);
  assert.equal(snapFileIndex(0, 0, 0, 0), 0);
});

test('file manifest resolves projects and resume in reading order without duplicate ids', () => {
  assert.deepEqual(studioFiles.map(file => file.id), ['framelean', 'exercises-eagles', 'resume']);
  assert.equal(new Set(studioFiles.map(file => file.id)).size, studioFiles.length);
  for (const file of studioFiles) {
    assert.ok(file.title && file.summary);
    if (file.kind === 'project') assert.equal(file.id, file.project.id);
    else assert.deepEqual(file.resume.sections.map(section => section.title), ['教育经历', '专业技能', '竞赛经历与集训经历', '项目经历']);
  }
});

test('file activation requires a completed same-card gesture, while keyboard remains accessible', () => {
  const pointer = { detail: 1, pointerId: 3 };
  const tap = { id: 'resume', pointerId: 3, x: 10, y: 10, scrollLeft: 0, moved: false, ended: true };
  assert.equal(canOpenFile(null, 'framelean', pointer), false); // Retargeted scene click / cancelled touch.
  assert.equal(canOpenFile(tap, 'resume', pointer), true);
  assert.equal(canOpenFile(tap, 'framelean', pointer), false);
  assert.equal(canOpenFile({ ...tap, moved: true }, 'resume', pointer), false);
  assert.equal(canOpenFile({ ...tap, ended: false }, 'resume', pointer), false);
  assert.equal(canOpenFile(tap, 'resume', { ...pointer, pointerId: 4 }), false);
  assert.equal(canOpenFile(null, 'resume', { detail: 0 }), true);
});
