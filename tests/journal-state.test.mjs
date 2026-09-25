import test from 'node:test';
import assert from 'node:assert/strict';
import { spreadFor, turnFaces, resolveReadingPage, journalSlug } from '../src/application/journal/book-state.ts';
import { pageForPath, pathForPage, historyAction, studioStateForPage, NAV_ITEMS } from '../src/app/navigation.ts';

test('a physical right leaf has the current right and next left faces',()=>{
  assert.deepEqual(spreadFor(0,7,false),[0,1]);
  assert.deepEqual(turnFaces(0,7,false,1),{from:0,to:2,front:1,back:2,direction:1});
  assert.deepEqual(turnFaces(2,7,false,-1),{from:2,to:0,front:1,back:2,direction:-1});
  assert.deepEqual(spreadFor(6,7,false),[6]);
  assert.equal(turnFaces(6,7,false,1),null);
  assert.equal(turnFaces(0,7,false,-1),null);
  assert.equal(turnFaces(0,0,false,1),null);
});
test('portrait walks every face and rotating does not mutate the reading page',()=>{
  let page=0;
  for(let expected=1;expected<7;expected++){page=turnFaces(page,7,true,1).to;assert.equal(page,expected);}
  assert.deepEqual(spreadFor(3,7,false),[2,3]);
  assert.deepEqual(spreadFor(3,7,true),[3]);
});
test('deep links beat other bookmarks; stable anchors survive repagination',()=>{
  const book={articles:[{slug:'old',start:0,count:3},{slug:'new',start:3,count:2}],pages:[{index:0,slug:'old',anchors:['p1']},{index:1,slug:'old',anchors:['p2']},{index:2,slug:'old',anchors:['p3']},{index:3,slug:'new',anchors:['new1']},{index:4,slug:'new',anchors:['new2']}]};
  assert.equal(resolveReadingPage(book),3);
  assert.equal(resolveReadingPage(book,'old',{slug:'new',page:4}),0);
  assert.equal(resolveReadingPage(book,undefined,{slug:'old',anchor:'p3',page:0}),2);
  assert.equal(resolveReadingPage(book,undefined,{slug:'old',page:99}),2);
  assert.equal(resolveReadingPage(book,undefined,{slug:'deleted',page:99}),3);
});
test('journal paths preserve original Unicode slugs without adding a dock item',()=>{
  assert.equal(pageForPath('/journal/20260527-%E8%AE%B0%E5%BD%95/'),'journal');
  assert.equal(journalSlug('/journal/20260527-%E8%AE%B0%E5%BD%95/'),'20260527-记录');
  assert.equal(journalSlug('/journal/%ZZ'),undefined);
  assert.equal(pathForPage('journal'),'/journal');
  assert.equal(studioStateForPage('journal'),'journal');
  assert.equal(historyAction('journal','home',{justinPage:'journal',from:'home'}),'back');
  assert.equal(NAV_ITEMS.length,4);
});
