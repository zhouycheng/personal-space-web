import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSiteRepository, validateSiteIdentity } from '../src/data/repositories/siteValidation.ts';
import { selectStudioFiles } from '../src/data/selectors/studioFiles.ts';
import { pageTitle, articleTitle } from '../src/data/selectors/siteIdentity.ts';

const json = async name => JSON.parse(await readFile(new URL(`../src/content/site/${name}.json`, import.meta.url), 'utf8'));
test('replacing identity and profession updates all derived labels without presentation changes', async () => {
  const identity = validateSiteIdentity({ ...await json('site'), brand: 'Example Studio', journalTitle: 'Example Notes' });
  assert.equal(pageTitle(identity, '作品'), 'Example Studio - 作品');
  assert.equal(articleTitle(identity, 'Hello'), 'Hello — Example Notes');
  const resume = { ...await json('resume'), name: 'Example', role: 'Illustrator' };
  delete resume.tags;
  const repository = createSiteRepository(await json('projects'), resume, await json('studio-files'));
  const file = selectStudioFiles(repository).find(file => file.kind === 'resume');
  assert.deepEqual(file.tags, ['简历', 'Illustrator']);
  assert.equal(file.title, 'Example简历');
});
test('repositories reject duplicate ids, broken references, unsafe resources and invalid enums', async () => {
  const projects = await json('projects'), resume = await json('resume'), files = await json('studio-files');
  assert.throws(() => createSiteRepository([...projects, projects[0]], resume, files), /duplicate ID/);
  assert.throws(() => createSiteRepository(projects, resume, [{ id: 'x', kind: 'project', source: 'missing' }]), /Missing studio/);
  for (const href of ['javascript:alert(1)', '/images/../secret']) {
    const bad = structuredClone(projects); bad[0].links[0].href = href;
    assert.throws(() => createSiteRepository(bad, resume, files), /URL|path/);
  }
  const bad = structuredClone(projects); bad[0].links[0].kind = 'unknown';
  assert.throws(() => createSiteRepository(bad, resume, files), /invalid kind/);
});
