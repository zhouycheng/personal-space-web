import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildJournal } from '../scripts/journal-build.mjs';

test('real browser paginates mixed Chinese content without losing text, caches and rejects missing assets', {timeout:180_000}, async()=>{
  const temp=await mkdtemp(path.join(os.tmpdir(),'justin-journal-'));
  const sourceDir=path.join(temp,'source'),assetsDir=path.join(temp,'assets'),outputDir=path.join(temp,'pages'),manifestPath=path.join(temp,'manifest.json');
  await mkdir(sourceDir);await mkdir(assetsDir);
  await writeFile(path.join(assetsDir,'sample.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#947756"/></svg>');
  const paragraphs=Array.from({length:12},(_,i)=>`段落${i+1}：`+'中文分页需要保证内容自然顺延到纸张背面，标点、English words、数字2026和链接都不能丢失。'.repeat(4)).join('\n\n');
  const markdown=`---\ntitle: 长文分页验收\npubDate: 2026-09-21\n---\n\n${paragraphs}\n\n## 下一段的标题\n\n这是标题后的正文，不能孤立在另一页。\n\n![示意图](/journal/assets/sample.svg)\n\n[阅读资料](https://example.com)\n\n- 第一条列表\n- 第二条列表\n\n> 引用内容应保留缩进。\n\n\`\`\`js\n${Array.from({length:22},(_,i)=>`const value${i} = ${i};`).join('\n')}\n\`\`\`\n\n| 项目 | 说明 |\n| --- | --- |\n${Array.from({length:9},(_,i)=>`| 行${i} | 表格中文内容 |`).join('\n')}\n\n最后一行验收标记。`;
  const options={sourceDir,assetsDir,outputDir,manifestPath,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})};
  try{
    await writeFile(path.join(sourceDir,'long.md'),markdown);
    await writeFile(path.join(sourceDir,'draft.md'),'---\ntitle: 草稿\npubDate: 2026-09-21\ndraft: true\n---\n不应出现');
    const book=await buildJournal(options);
    assert.ok(book.pages.length>=6&&book.pages.length<=10,`got ${book.pages.length} pages`);
    assert.equal(book.articles.length,1);
    assert.ok(book.pages.at(-1).text.includes('最后一行验收标记'));
    assert.ok(book.pages.some(p=>p.regions.some(r=>r.kind==='image')));
    assert.ok(book.pages.some(p=>p.regions.some(r=>r.kind==='link')));
    assert.ok(book.pages.every(p=>p.anchors.length));
    assert.equal((await buildJournal(options)).hash,book.hash);
    const before=await readFile(manifestPath,'utf8');
    await writeFile(path.join(sourceDir,'broken.md'),'---\ntitle: 缺失资源\npubDate: 2026-09-22\n---\n![缺失](/journal/assets/missing.png)');
    await assert.rejects(buildJournal(options));
    assert.equal(await readFile(manifestPath,'utf8'),before,'failed regeneration preserves previous complete manifest');
  }finally{await rm(temp,{recursive:true,force:true});}
});
