import * as THREE from 'three';
import { islandAppearance as island } from '../../../config/islandAppearance.ts';
import { coastRadius,smoothstep,shoreRadius,terrainHeight } from '../../../config/islandTerrain.ts';

export function createIslandGeometry(segments = 192, rings = 64) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const dry = new THREE.Color(island.sand), wet = new THREE.Color(island.wetSand);
  for (let ring = 0; ring <= rings; ring++) {
    const radius = ring / rings * 1.4;
    for (let segment = 0; segment <= segments; segment++) {
      const angle = segment / segments * Math.PI * 2;
      const outline = shoreRadius(angle) * radius;
      const x = Math.cos(angle) * island.radiusX * outline;
      const z = Math.sin(angle) * island.radiusZ * outline + island.centerZ;
      const y = terrainHeight(x,z);
      positions.push(x, y, z);
      const color = dry.clone().lerp(wet, smoothstep(0.87, 1.045, radius+(Math.sin(x*2.3+z*.7)+Math.sin(z*3.1))*.008));
      color.multiplyScalar(1 + 0.025 * Math.sin(x * 7 + Math.sin(z * 3)) * Math.sin(z * 9));
      colors.push(color.r, color.g, color.b);
      if (ring < rings && segment < segments) {
        const a = ring * (segments + 1) + segment, b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createWaterGeometry() {
  const waterGeometry = new THREE.PlaneGeometry(1, 1, 256, 256);
  waterGeometry.rotateX(-Math.PI / 2);
  // Concentrate vertices around the island; the outer sea reaches beyond every allowed view.
  const vertices=waterGeometry.attributes.position;
  const spread=(value:number)=>Math.sign(value)*600*Math.pow(Math.abs(value)*2,3);
  for(let i=0;i<vertices.count;i++) vertices.setXYZ(i,spread(vertices.getX(i)),0,spread(vertices.getZ(i)));
  const coastData=new Float32Array(vertices.count*4);
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i),o=i*4;
    const radius=coastRadius(x,z);
    coastData[o]=radius;
    coastData[o+1]=(coastRadius(x+.01,z)-coastRadius(x-.01,z))/.02;
    coastData[o+2]=(coastRadius(x,z+.01)-coastRadius(x,z-.01))/.02;
    coastData[o+3]=1-smoothstep(1.03,1.45,radius);
  }
  waterGeometry.setAttribute('coastData',new THREE.BufferAttribute(coastData,4));
  waterGeometry.computeBoundingSphere();
  return waterGeometry;
}
