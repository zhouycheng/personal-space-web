import assert from 'node:assert/strict';
import test from 'node:test';
import { PlaneGeometry, Scene, Matrix4 } from 'three';
import { BOOK_HEIGHT, paperSurfaceHeight, singleSurfaceHeight, singleBackDepth, shapeTurningPage, shapeFoldedPage, createJournalBookGeometry } from '../src/presentation/scene/journal/journalBookGeometry.ts';

test('turning paper stays bound and clears the curved page stack in both directions', () => {
  const sheet = new PlaneGeometry(1, BOOK_HEIGHT, 64, 24).translate(.5, 0, 0);
  const original = Float32Array.from(sheet.attributes.position.array);
  // The resting surface is triangulated at 32 segments, not an exact analytic curve.
  const floor = x => {
    const edge = Math.min(1, Math.abs(x)), segment = Math.min(31, Math.floor(edge * 32));
    const t = edge * 32 - segment;
    return paperSurfaceHeight(segment / 32) * (1 - t) + paperSurfaceHeight((segment + 1) / 32) * t;
  };
  for (const direction of [-1, 1]) for (const v of [-1, 0, 1]) for (const skew of [-1.25, 0, 1.25]) {
    for (const progress of [0, .0001, .001, .01, .1, .3, .5, .7, .9, .99, .999, 1]) {
      shapeTurningPage(sheet, original, progress, direction, { u: .94, v, skew });
      const p = sheet.attributes.position;
      for (let i = 0; i < p.count; i++) {
        assert.ok(p.getZ(i) >= floor(p.getX(i)) - 1e-7, `contact ${direction}/${progress}/${i}`);
        if (original[i * 3] === 0) {
          assert.ok(p.getX(i) === 0);
          assert.equal(p.getY(i), original[i * 3 + 1]);
          assert.ok(Math.abs(p.getZ(i) - paperSurfaceHeight(0)) < 1e-8);
        }
      }
      for (let i = 0; i < sheet.index.count; i += 3) {
        const ids = [0, 1, 2].map(j => sheet.index.getX(i + j));
        const x = ids.reduce((sum, id) => sum + p.getX(id), 0) / 3;
        const z = ids.reduce((sum, id) => sum + p.getZ(id), 0) / 3;
        assert.ok(z >= floor(x) - 1e-7, `triangle contact ${direction}/${progress}/${i}`);
      }
    }
  }
  sheet.dispose();
});

test('folded sheet keeps its binding fixed and lands behind the folded stack', () => {
  const sheet = new PlaneGeometry(1, BOOK_HEIGHT, 64, 24).translate(.5, 0, 0);
  const original = Float32Array.from(sheet.attributes.position.array), p = sheet.attributes.position;
  for (const v of [-1, 1]) for (const skew of [-1.25, 1.25]) for (const t of [0,.001,...Array.from({length:99},(_,i)=>(i+1)/100),.999,1]) {
    shapeFoldedPage(sheet, original, t, { u: .94, v, skew });
    for (let i = 0; i < p.count; i++) {
      const u = original[i * 3], x = p.getX(i), z = p.getZ(i);
      assert.ok(Number.isFinite(x + p.getY(i) + z));
      if (u === 0) {
        assert.ok(Math.abs(x) < 1e-8);
        assert.equal(p.getY(i), original[i * 3 + 1]);
        assert.ok(Math.abs(z - paperSurfaceHeight(0)) < 1e-8);
      }
      if (z < 0 && z > .001-singleBackDepth(4)+1e-7) assert.ok(x <= 0, 'sheet routes outside the spine, not through the book');
      if (t === 0) assert.ok(Math.abs(x - u) < 1e-6 && z >= singleSurfaceHeight(u) - 1e-7);
      if (t === 1 && u >= Math.PI*singleBackDepth(4)/2) assert.ok(z <= .001-singleBackDepth(4)+1e-7, 'finished sheet contacts the rear paper block');
      if (i%65!==0) {
        const length=Math.hypot(x-p.getX(i-1),p.getY(i)-p.getY(i-1),z-p.getZ(i-1));
        // Includes the shallow resting bow and chords approximating the binding arc.
        assert.ok(Math.abs(length*64-1)<.02, `paper width is preserved at ${t}/${i}: ${length*64}`);
      }
    }
  }
  sheet.dispose();
});

test('four printed faces create two physical sheets, with no decorative page lines', () => {
  const previous=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){},createLinearGradient:()=>({addColorStop(){}})})})};
  const book=createJournalBookGeometry(new Scene());
  try {
    for(const [page,front,back] of [[0,2,0],[1,2,0],[2,1,1],[3,1,1]]) {
      book.updateSingleSheets(4,page);
      const [frontMesh,rearMesh,bindingMesh]=book.singleSheets.children;
      assert.equal(frontMesh.count,front);assert.equal(rearMesh.count,back);assert.equal(bindingMesh.count,back);
      assert.equal(bindingMesh.material.map,null);
      if(back){const matrix=new Matrix4();rearMesh.getMatrixAt(0,matrix);assert.ok(matrix.elements[14]<-.08);}
    }
    book.updateSingleSheets(7,6);
    assert.deepEqual(book.singleSheets.children.map(mesh=>mesh.count),[1,3,3]);
    book.updateSingleSheets(4,2,'back');
    assert.deepEqual(book.singleSheets.children.map(mesh=>mesh.count),[1,0,0]);
  } finally {book.disposeSingleSheets();for(const resource of book.owned)resource.dispose();globalThis.document=previous;}
});
