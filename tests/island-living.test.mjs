import test from 'node:test';
import assert from 'node:assert/strict';
import { hammockAnchors,hammockPoint,hammockCushionPoint,createHammockGeometry } from '../src/presentation/scene/studio/hammockGeometry.ts';
import { createDrapedCloth } from '../src/presentation/scene/studio/drapedCloth.ts';
import { islandPalms,palmTrunkCenter } from '../src/config/islandVegetation.ts';
import { hammockLayout,livingProps,livingFerns,landingStones } from '../src/config/islandLiving.ts';
import { terrainHeight,coastRadius } from '../src/config/islandTerrain.ts';

test('hammock uses the two palm trunks, hangs clear of sand and opens toward the landing',()=>{
  const anchors=hammockAnchors();
  for(const [i,seed] of [hammockLayout.frontPalmSeed,hammockLayout.rearPalmSeed].entries()) {
    const palm=islandPalms.find(palm=>palm.seed===seed);
    assert.deepEqual(anchors[i].toArray(),palmTrunkCenter(palm,hammockLayout.attachmentHeight));
  }
  assert.ok(hammockPoint(.5,1).x>hammockPoint(.5,-1).x);
  assert.ok(hammockPoint(.5,1).y<hammockPoint(.5,-1).y);
  const geometry=createHammockGeometry(),positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
    assert.ok(Number.isFinite(x+y+z));
    assert.ok(y-terrainHeight(x,z)>.5,'the loaded bed stays above the ground');
  }
  geometry.dispose();
});

test('the cushion underside conforms to the hammock instead of crossing its cloth',()=>{
  const span=hammockAnchors()[0].distanceTo(hammockAnchors()[1])*.76;
  for(let x=-.275;x<=.275;x+=.025)for(let z=-.3;z<=.3;z+=.025) {
    const u=.32+z/span,halfWidth=.07+hammockLayout.width*.5*Math.pow(Math.sin(Math.PI*u),.72);
    const bed=hammockPoint(u,-.1+x/halfWidth),bottom=hammockCushionPoint(x,-.1062,z);
    assert.ok(bottom.y-bed.y>.005&&bottom.y-bed.y<.015,'compressed underside stays just above its support');
    assert.ok(Math.hypot(bottom.x-bed.x,bottom.z-bed.z)<1e-10);
  }
});

test('linen conforms to the rim, falls under gravity and rests on the sand',()=>{
  const {geometry}=createDrapedCloth(.48,.94,.4,.28),p=geometry.attributes.position;
  let grounded=0;
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    assert.ok(Number.isFinite(x+y+z));assert.ok(y>=.0089);
    if(y<.02)grounded++;
    if(y>.02&&y<.345)assert.ok(Math.hypot(x,z)>=.28*(.79+.21*y/.4)+.0108,'cloth clears the woven wall');
  }
  assert.ok(grounded>20,'the long hem settles on sand');
  // Structural yarns limit stretch; folds compress the visible silhouette, not the material.
  for(let j=1;j<48;j++)for(let i=1;i<24;i++) {
    const a=(j*25+i)*3,b=((j+1)*25+i)*3;
    const distance=Math.hypot(...[0,1,2].map(k=>p.array[a+k]-p.array[b+k]));
    assert.ok(distance<.94/48*1.12,'vertical yarns remain constrained');
  }
  geometry.dispose();
});

test('living groups and five landing stones stay on dry land; lounge planting clears the throw',()=>{
  for(const item of [...Object.values(livingProps),...landingStones])assert.ok(coastRadius(item.x,item.z)<.98);
  assert.equal(landingStones.length,5);
  const basket=livingProps.loungeBasket;
  for(const fern of livingFerns) {
    const gap=Math.hypot(Math.max(basket.x-.25-fern.x,0,fern.x-basket.x-.25),Math.max(basket.z-.13-fern.z,0,fern.z-basket.z-.5));
    assert.ok(gap>fern.scale*1.5,'fern tips stay outside the hanging linen');
  }
});
