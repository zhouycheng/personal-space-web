import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { marineLife, marinePoint, horizonIslands } from '../../../config/marineLife.ts';
import { terrainHeight } from '../../../config/islandTerrain.ts';

type Point = [number, number, number];

/** Submerged edges meet the sea; separate ridges determine each island's silhouette. */
export function createHorizonGeometry() {
  const pieces = horizonIslands.map((island, index) => {
    const geometry = new THREE.PlaneGeometry(2, 2, 24, 10);
    const vertices = geometry.attributes.position;
    const c = Math.cos(island.rotation), s = Math.sin(island.rotation);
    for (let i = 0; i < vertices.count; i++) {
      const u = vertices.getX(i), v = vertices.getY(i);
      let height = 0;
      for (const [x, z, peak, spread] of island.peaks) {
        height += peak * Math.exp(-((u - x) ** 2 + (v - z) ** 2 * 1.4) / (spread * spread));
      }
      const edge = Math.max(0, 1 - Math.max(Math.abs(u), Math.abs(v)) ** 6);
      height *= edge * (1 + .09 * Math.sin(u * 19 + index) * Math.sin(v * 13 + index));
      const x = u * island.width, z = v * island.depth;
      vertices.setXYZ(i, Math.cos(island.angle) * island.distance + x * c - z * s,
        height - .7, Math.sin(island.angle) * island.distance + x * s + z * c);
    }
    // Plane UV ordering faces down after mapping onto XZ.
    const indices = geometry.index!;
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i);indices.setX(i, indices.getX(i + 2));indices.setX(i + 2, a);
    }
    geometry.computeVertexNormals();
    return geometry;
  });
  const geometry = mergeGeometries(pieces)!;
  pieces.forEach(piece => piece.dispose());
  geometry.computeBoundingSphere();
  return geometry;
}

/** Smooth closed surfaces share one indexed mesh, including curved fin roots. */
export function createMarineAnimal(kind: 'shark' | 'turtle' | 'school') {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const top = new THREE.Color(kind === 'shark' ? 0x3c5358 : kind === 'turtle' ? 0x596047 : 0x567e85);
  const belly = new THREE.Color(kind === 'shark' ? 0xa6b5af : kind === 'turtle' ? 0xb0a279 : 0xc3cec2);
  const scutes:Point[]=[];
  for(let i=0;i<5;i++)scutes.push([-.29+i*.135,0,0]);
  for(const side of [-1,1])for(let i=0;i<4;i++)scutes.push([-.24+i*.145,0,side*.15]);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;scutes.push([-.04+.34*Math.cos(a),0,.255*Math.sin(a)]);}
  function surface(rows: number, columns: number, sample: (u: number, v: number) => Point, shell = false) {
    const start = positions.length / 3;
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
      const [x, y, z] = sample(i / rows, j / columns);
      positions.push(x, y, z);
      const color = belly.clone().lerp(top, THREE.MathUtils.smoothstep(y, -.055, .025));
      if(kind==='school'&&Math.abs(y)<.012)color.lerp(new THREE.Color(0xc2b974),.55);
      if (shell && y > .015) {
        let first=Infinity,second=Infinity;
        for(const cell of scutes){const d=Math.hypot(x-cell[0],z-cell[2]);if(d<first){second=first;first=d;}else second=Math.min(second,d);}
        const seam=THREE.MathUtils.smoothstep(second-first,.002,.012);
        color.lerp(new THREE.Color(0x272f21),1-seam);
        color.multiplyScalar(.88+.16*Math.sin(x*64+z*23)*Math.sin(z*53));
      }
      colors.push(color.r, color.g, color.b);
      if (i < rows && j < columns) {
        const a = start + i * (columns + 1) + j, b = a + columns + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  function body(cx: number, length: number, ry: number, rz: number, shell = false) {
    surface(shell ? 40 : 24, shell ? 32 : 20, (u, v) => {
      const x = u * 2 - 1, r = Math.sqrt(Math.max(0, 1 - x * x));
      const taper = shell ? 1 : .62 + .38 * u;
      return [cx + x * length / 2, Math.cos(v * Math.PI * 2) * ry * r * taper,
        Math.sin(v * Math.PI * 2) * rz * r * taper];
    }, shell);
  }
  function fin(root: Point, tip: Point, chord: number, plane: 'vertical' | 'horizontal') {
    const start=colors.length,rows=kind==='school'?4:10,columns=kind==='school'?6:10;
    surface(rows, columns, (u, v) => {
      const angle = v * Math.PI * 2;
      const span = u, width = chord * Math.pow(1 - u, kind==='shark'?1.5:.65);
      const x = root[0] + (tip[0] - root[0]) * span + Math.cos(angle) * width / 2;
      const y = root[1] + (tip[1] - root[1]) * span;
      const z = root[2] + (tip[2] - root[2]) * span;
      const thickness = Math.sin(angle) * .005 * (1 - u);
      return [x, y + (plane === 'horizontal' ? thickness : 0), z + (plane === 'vertical' ? thickness : 0)];
    });
    for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++) {
      const upper=plane==='vertical'||Math.sin(j/columns*Math.PI*2)>=0;
      const color=top.clone().lerp(belly,upper?.08:.44).multiplyScalar(.94+.06*Math.sin(i/rows*Math.PI));
      color.toArray(colors,start+(i*(columns+1)+j)*3);
    }
  }
  if (kind === 'turtle') {
    body(-.04, .78, .175, .29, true);
    body(.26,.30,.06,.075);
    const head=new THREE.CatmullRomCurve3([
      new THREE.Vector3(.25,.048,.059),new THREE.Vector3(.36,.077,.087),
      new THREE.Vector3(.45,.066,.083),new THREE.Vector3(.52,.03,.053),new THREE.Vector3(.545,.004,.008),
    ]);
    surface(18,18,(u,v)=>{const p=head.getPoint(u),a=v*Math.PI*2;return[p.x,Math.cos(a)*p.y-.015,Math.sin(a)*p.z];});
    for (const side of [-1, 1]) {
      fin([.18,-.045,side*.17],[-.17,-.095,side*.61],.28,'horizontal');
      fin([-.29,-.045,side*.15],[-.48,-.065,side*.34],.18,'horizontal');
    }
    fin([-.35, 0, 0], [-.5, 0, 0], .07, 'horizontal');
  } else if(kind==='shark') {
    const profile=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.55,.015,.020),new THREE.Vector3(-.40,.037,.034),
      new THREE.Vector3(-.23,.074,.070),new THREE.Vector3(-.04,.108,.103),
      new THREE.Vector3(.15,.105,.108),new THREE.Vector3(.32,.075,.084),
      new THREE.Vector3(.43,.034,.045),new THREE.Vector3(.50,.002,.003),
    ]);
    surface(36,24,(u,v)=>{
      const p=profile.getPoint(u),a=v*Math.PI*2;
      return [p.x,Math.cos(a)*p.y-.015*Math.max(0,p.x*2),Math.sin(a)*p.z];
    });
    fin([-.02,.085,0],[-.16,.27,0],.24,'vertical');
    fin([-.34,.025,0],[-.39,.08,0],.09,'vertical');
    fin([-.51,0,0],[-.73,.29,0],.12,'vertical');
    fin([-.51,0,0],[-.66,-.18,0],.10,'vertical');
    for (const side of [-1, 1]) {
      fin([.08,-.035,side*.075],[-.19,-.07,side*.32],.21,'horizontal');
      fin([-.27,-.025,side*.035],[-.38,-.04,side*.12],.09,'horizontal');
    }
    // Gill slits follow the body surface, with a shallow mouth below the snout.
    for(const side of [-1,1])for(let slit=0;slit<5;slit++) {
      const x=.17-slit*.022,start=colors.length;
      surface(6,2,(u,v)=>[x+(v-.5)*.004,-.044+u*.099,
        side*Math.sqrt(Math.max(0,.108**2-(-.044+u*.099)**2))]);
      for(let i=start;i<colors.length;i++)colors[i]*=.38;
    }
    const mouthStart=colors.length;
    surface(14,2,(u,v)=>{
      const z=(u-.5)*.125,x=.345+.058*Math.sin(Math.PI*u);
      return [x,-.044+(v-.5)*.003,z];
    });
    for(let i=mouthStart;i<colors.length;i++)colors[i]*=.3;
  } else {
    const profile=new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.42,.012,.009),new THREE.Vector3(-.25,.054,.025),
      new THREE.Vector3(-.04,.100,.047),new THREE.Vector3(.16,.078,.041),
      new THREE.Vector3(.31,.041,.025),new THREE.Vector3(.38,.002,.002),
    ]);
    surface(16,10,(u,v)=>{const p=profile.getPoint(u),a=v*Math.PI*2;return [p.x,Math.cos(a)*p.y,Math.sin(a)*p.z];});
    fin([-.05,.065,0],[-.12,.135,0],.26,'vertical');
    surface(5,10,(u,v)=>{
      const a=v*Math.PI*2;
      return [-.40-u*.16,Math.cos(a)*(.014+.088*Math.sin(u*Math.PI/2)),Math.sin(a)*.006*Math.sin(Math.PI*u)];
    });
    fin([-.09,-.055,0],[-.19,-.105,0],.17,'vertical');
    for(const side of [-1,1])fin([.15,-.015,side*.035],[.04,-.055,side*.09],.10,'horizontal');
  }
  // Small dark eyes are baked into the same draw, not separate scene objects.
  for (const side of [-1, 1]) {
    const start = colors.length;
    surface(kind === 'school' ? 3 : 6, kind === 'school' ? 4 : 8, (u, v) => {
      const theta = Math.PI * u, phi = v * Math.PI * 2;
      const radius=kind==='school'?.011:.007;
      return [(kind === 'turtle' ? .46 : kind==='shark'?.365:.275) + radius * Math.cos(theta),
        .016 + radius * Math.sin(theta) * Math.cos(phi),
        side * (kind === 'turtle' ? .077 : kind==='shark'?.062:.029) + radius * Math.sin(theta) * Math.sin(phi)];
    });
    for (let i = start; i < colors.length; i++) colors[i] = .018;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const length = kind === 'turtle' ? 1.04 : kind==='shark'?1.23:.97;
  geometry.scale(marineLife[kind].length / length, marineLife[kind].length / length, marineLife[kind].length / length);
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += .15;
  return geometry;
}

export function createMarineCoral() {
  const pieces: THREE.BufferGeometry[] = [];
  marineLife.colonies.forEach((colony, group) => {
    for (let i = 0; i < 3; i++) {
      const p = marinePoint(colony.angle + [-.19, .17, .30][i], colony.radius + [.06, .19, -.08][i]);
      const base = Math.max(-1.65, terrainHeight(p.x, p.z) - .02);
      const patch: THREE.BufferGeometry[] = [];
      if (i === 0) {
        // One folded, flared scroll: a continuous rim instead of stacked plates.
        const shape = new THREE.SphereGeometry(1, 32, 16);
        const vertices = shape.attributes.position;
        for (let v = 0; v < vertices.count; v++) {
          const x = vertices.getX(v), y = vertices.getY(v), z = vertices.getZ(v);
          const a = Math.atan2(z, x), r = Math.hypot(x, z);
          const edge = 1 + .14 * Math.sin(a * 5 + group) + .055 * Math.sin(a * 9);
          vertices.setXYZ(v, x * edge * .48,
            .13 + .23 * r * r + .085 * Math.sin(a * 5 + r * 3) * r + y * .024, z * edge * .38);
        }
        patch.push(shape);
      } else if (i === 1) {
        const shape = new THREE.SphereGeometry(1, 24, 16);
        const vertices = shape.attributes.position;
        for (let v = 0; v < vertices.count; v++) {
          const x = vertices.getX(v), y = vertices.getY(v), z = vertices.getZ(v);
          const ridge = 1 + .045 * Math.sin(x * 27 + Math.sin(z * 16) * 2 + y * 9);
          vertices.setXYZ(v, x * .36 * ridge, .13 + y * .24 * ridge, z * .29 * ridge);
        }
        patch.push(shape);
      } else {
        for (let branch = 0; branch < 7; branch++) {
          const a = branch * 2.3999 + group, height = .32 + .17 * Math.sin(branch * 8.1) ** 2;
          const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(Math.cos(a) * .13, height * .5, Math.sin(a) * .13),
            new THREE.Vector3(Math.cos(a) * .27, height, Math.sin(a) * .27),
          ]);
          for (let fork = 0; fork < 3; fork++) {
            const path = fork === 0 ? curve : new THREE.CatmullRomCurve3([
              curve.getPoint(.35 + fork * .15),
              new THREE.Vector3(Math.cos(a + fork * .6) * .24, height * .82, Math.sin(a + fork * .6) * .24),
              new THREE.Vector3(Math.cos(a + fork * .6) * .32, height + .035 * fork, Math.sin(a + fork * .6) * .32),
            ]);
            const tube = new THREE.TubeGeometry(path, 8, fork ? .018 : .033, 7, false);
            const vertices = tube.attributes.position;
            for (let row = 0; row <= 8; row++) {
              const center = path.getPointAt(row / 8), taper = .12 + .88 * (1 - row / 8);
              for (let col = 0; col <= 7; col++) {
                const v = row * 8 + col;
                vertices.setXYZ(v, center.x + (vertices.getX(v) - center.x) * taper,
                  center.y + (vertices.getY(v) - center.y) * taper, center.z + (vertices.getZ(v) - center.z) * taper);
              }
            }
            patch.push(tube);
          }
        }
      }
      for (const piece of patch) {
        const vertices = piece.attributes.position, colors: number[] = [];
        for (let v = 0; v < vertices.count; v++) {
          const x = vertices.getX(v), y = vertices.getY(v), z = vertices.getZ(v);
          const shade = .72 + .25 * Math.min(1, Math.max(0, y * 2)) + .06 * Math.sin(x * 61 + z * 43);
          const color = new THREE.Color(colony.color).multiplyScalar(shade);
          if (i === 2) color.lerp(new THREE.Color(0xc4ae89), Math.max(0, y - .28) * 1.4);
          colors.push(color.r, color.g, color.b);
        }
        piece.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        piece.computeVertexNormals();piece.rotateY(group + i * 1.7);piece.translate(p.x, base, p.z);
        pieces.push(piece);
      }
    }
  });
  const geometry = mergeGeometries(pieces)!;
  pieces.forEach(piece => piece.dispose());
  geometry.computeBoundingSphere();
  return geometry;
}
