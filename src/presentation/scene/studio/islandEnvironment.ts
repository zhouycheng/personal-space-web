import * as THREE from "three";
import { islandAppearance as island } from "../../../config/islandAppearance.ts";
import type { StudioLighting } from "../../../contracts/studioPorts";
import { oceanWavesGLSL } from "./oceanShader.ts";
import { smoothstep, shoreRadius, terrainHeight } from '../../../config/islandTerrain.ts';
import { createRockGeometry, createRockMaterial, rockCoastGLSL } from './islandRocks.ts';
import { createIslandVegetation } from './islandVegetation.ts';
import { islandPalms, islandUnderstory } from '../../../config/islandVegetation.ts';
import { islandSkyGLSL, islandSkyVertex, islandSkyFragment } from './islandSky.ts';
export { shoreRadius, islandHeight } from '../../../config/islandTerrain.ts';

export function createIslandGeometry(segments = 128, rings = 40) {
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
      const color = dry.clone().lerp(wet, smoothstep(0.83, 1.025, radius));
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

// Generated from the same coefficients as the mesh; water and sand share a coastline.
const outlineGLSL = `1.0 ${island.shoreHarmonics.map(([f, a, p]) =>
  `+ ${a.toFixed(5)} * sin(angle * ${f.toFixed(1)} + ${p.toFixed(2)})`).join(" ")}`;
const coastGLSL = `float coastRadius(vec2 p) {
  vec2 local = (p - vec2(0.0, ${island.centerZ})) / vec2(${island.radiusX}, ${island.radiusZ});
  float angle = atan(local.y, local.x);
  return length(local) / (${outlineGLSL});
}
float coastWeight(vec2 p) {return smoothstep(1.05,1.65,coastRadius(p));}
`;

const sandNoiseGLSL = `
float sandHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float sandNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(sandHash(i),sandHash(i+vec2(1,0)),f.x),
    mix(sandHash(i+vec2(0,1)),sandHash(i+vec2(1,1)),f.x),f.y);
}
float sandRelief(vec2 p) {
  return sandNoise(p*9.0)*0.004 + sandNoise(p*37.0)*0.0012
    + sin(p.y*32.0+3.0*sandNoise(p*1.7))*0.0015;
}`;

// Ground shading follows every planted center, with irregular soft edges rather than decals.
const plantContactGLSL=[...islandPalms.map(p=>({x:p.x,z:p.z,radius:.65,strength:.27})),
  ...islandUnderstory.map(p=>({x:p.x,z:p.z,radius:p.scale*.85,strength:.23}))].map(p=>`{
    float rootDistance=length((sandP-vec2(${p.x.toFixed(4)},${p.z.toFixed(4)}))/vec2(${p.radius.toFixed(4)},${(p.radius*.85).toFixed(4)}));
    float rootContact=(1.0-smoothstep(.12,1.2,rootDistance+(sandNoise(sandP*13.0)-.5)*.2))*${p.strength.toFixed(3)};
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.46,.39,.28),rootContact);
  }`).join('\n');

export function createIslandEnvironment(scene: THREE.Scene, materials: Set<THREE.Material>,
  geometries: Set<THREE.BufferGeometry>) {
  const group = new THREE.Group();
  group.name = "island-environment";
  scene.add(group); // Deliberately outside the room's pickable object tree.
  const sandGeometry = createIslandGeometry();
  const sandMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1,
    emissive: 0x203a54, emissiveIntensity: 0 });
  sandMaterial.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vSandPosition;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\nvSandPosition = position;");
    shader.fragmentShader = `varying vec3 vSandPosition;\n${coastGLSL}\n${sandNoiseGLSL}\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>", `#include <color_fragment>
      vec2 sandP=vSandPosition.xz;
      float sandRadius=coastRadius(sandP);
      float damp=smoothstep(0.83,1.02,sandRadius+0.015*(sandNoise(sandP*3.0)-0.5));
      float grain=sandNoise(sandP*160.0);
      float grainVisibility=1.0-smoothstep(0.004,0.025,max(length(dFdx(sandP)),length(dFdy(sandP))));
      float mottling=(sandNoise(sandP*2.4)-0.5)*0.12+(sandNoise(sandP*11.0)-0.5)*0.06;
      diffuseColor.rgb *= 1.0+mottling+(grain-0.5)*0.18*grainVisibility;
      diffuseColor.rgb *= 1.0-0.09*damp;
      ${plantContactGLSL}`).replace(
      "#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      roughnessFactor=mix(0.96,0.48,damp);`).replace(
      "#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      float sandBump=sandRelief(sandP)*(1.0-0.65*damp);
      vec3 sandDx=dFdx(vViewPosition),sandDy=dFdy(vViewPosition);
      vec3 sandR1=cross(sandDy,normal),sandR2=cross(normal,sandDx);
      float sandDet=dot(sandDx,sandR1);
      vec3 sandGradient=sign(sandDet)*(dFdx(sandBump)*sandR1+dFdy(sandBump)*sandR2);
      normal=normalize(abs(sandDet)*normal-sandGradient);`);
  };
  const sand = new THREE.Mesh(sandGeometry, sandMaterial);
  sand.receiveShadow = true;
  group.add(sand);
  const rockGeometry=createRockGeometry(),rockMaterial=createRockMaterial();
  const rocks=new THREE.Mesh(rockGeometry,rockMaterial);
  rocks.name='island-rocks';rocks.castShadow=true;rocks.receiveShadow=true;
  group.add(rocks);geometries.add(rockGeometry);materials.add(rockMaterial);
  group.add(createIslandVegetation(materials,geometries));

  const uniforms = {
    time: { value: 0 }, daylight: { value: 1 },
    normalMap: { value: null as THREE.Texture | null }, normalReady: { value: 0 },
    shallow: { value: new THREE.Color(island.shallowWater) },
    deep: { value: new THREE.Color(island.deepWater) },
    sky: { value: new THREE.Color(0xc9e1e8) },
    sunColor: { value: new THREE.Color(0xfff8ed) },
    horizon: { value: new THREE.Color(0xe7e3dc) },
    zenith: { value: new THREE.Color(0x538ab7) },
    sunDirection: { value: new THREE.Vector3(-3,7,2.5).normalize() },
    sunset: { value: 0 },
  };
  const skyGeometry=new THREE.SphereGeometry(1,32,16);
  const skyMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:islandSkyVertex,
    fragmentShader:islandSkyFragment,side:THREE.BackSide,depthWrite:false,depthTest:false});
  const skyDome=new THREE.Mesh(skyGeometry,skyMaterial);
  skyDome.name='island-sky';skyDome.frustumCulled=false;skyDome.renderOrder=-100;
  group.add(skyDome);geometries.add(skyGeometry);materials.add(skyMaterial);
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vWorld;
      varying vec2 vRest, vCoastGradient;
      varying float vCoastWeight;
      uniform float time;
      ${coastGLSL}
      ${oceanWavesGLSL}
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vRest=vWorld.xz;
        vCoastWeight=coastWeight(vRest);
        vCoastGradient=vec2(coastWeight(vRest+vec2(0.01,0.0))-coastWeight(vRest-vec2(0.01,0.0)),
          coastWeight(vRest+vec2(0.0,0.01))-coastWeight(vRest-vec2(0.0,0.01)))/0.02;
        vWorld += oceanParticle(vRest,time,0.0).offset * vCoastWeight;
        gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
      }`,
    fragmentShader: `
      uniform float time;
      uniform float normalReady;
      uniform sampler2D normalMap;
      uniform vec3 shallow, deep, sky;
      ${islandSkyGLSL}
      varying vec3 vWorld;
      varying vec2 vRest, vCoastGradient;
      varying float vCoastWeight;
      ${coastGLSL}
      ${oceanWavesGLSL}
      float hash(vec2 p) {
        vec3 q = fract(vec3(p.xyx)*0.1031);
        q += dot(q,q.yzx+33.33);
        return fract((q.x+q.y)*q.z);
      }
      float noise(vec2 p) {
        vec2 i=floor(p), f=fract(p);
        f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
          mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
      }
      ${rockCoastGLSL}
      void main() {
        vec2 p = vWorld.xz;
        float radius = coastRadius(p);
        float angle = atan(p.y-(${island.centerZ}),p.x);
        float depth = smoothstep(1.0, 2.5, radius);
        float footprint = max(length(dFdx(p)),length(dFdy(p)));
        OceanParticle particle = oceanParticle(vRest,time,footprint);
        // Product rule includes the shoreline taper; reflection follows the displaced surface.
        vec3 tangentX=mix(vec3(1,0,0),particle.tangentX,vCoastWeight)+particle.offset*vCoastGradient.x;
        vec3 tangentZ=mix(vec3(0,0,1),particle.tangentZ,vCoastWeight)+particle.offset*vCoastGradient.y;
        vec3 geometricNormal=normalize(cross(tangentZ,tangentX));
        float shoreCalm = mix(0.25,1.0,smoothstep(1.0,1.7,radius));
        vec2 windSlopes=vec2(0.0);
        if(normalReady>0.5) {
          vec2 warp=vec2(sin(p.y*0.17+sin(p.x*0.11)),cos(p.x*0.13+sin(p.y*0.09)))*0.035;
          vec3 a=texture2D(normalMap,p/22.7+warp+vec2(time*0.004,-time*0.003)).xyz*2.0-1.0;
          vec2 rotated=mat2(0.8,-0.6,0.6,0.8)*p;
          vec3 b=texture2D(normalMap,rotated/13.1-warp+vec2(-time*0.003,time*0.004)).xyz*2.0-1.0;
          vec2 crossed=mat2(0.34,0.94,-0.94,0.34)*p;
          vec3 c=texture2D(normalMap,crossed/41.3+warp.yx+vec2(time*0.002,time*0.001)).xyz*2.0-1.0;
          float windStrength=0.8+0.2*noise(p*0.18+time*0.015);
          windSlopes=(a.xy*0.50+mat2(0.8,0.6,-0.6,0.8)*b.xy*0.32+mat2(0.34,-0.94,0.94,0.34)*c.xy*0.18)*0.55*windStrength;
        }
        vec3 normal = normalize(geometricNormal+vec3(windSlopes.x,0.0,windSlopes.y)*shoreCalm);
        vec3 view = normalize(cameraPosition - vWorld);
        float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(view, normal), 0.0), 5.0);
        vec3 reflected = reflect(-view,normal);
        vec3 reflectedSky = skyRadiance(reflected,0.0);
        vec3 base = mix(shallow,deep,depth);
        // Thin water lets the sandy bottom show through before turquoise deepens.
        float shallows=1.0-smoothstep(1.0,1.28,radius);
        vec3 seabed=vec3(0.48,0.40,0.27)*(0.93+0.07*noise(p*8.0));
        vec2 causticP=p+vec2(noise(p*2.3),noise(p*2.1+19.0))*0.7;
        float caustic=pow(1.0-abs(sin(causticP.x*8.0+sin(causticP.y*6.0+time*.25))*sin(causticP.y*7.0-time*.3)),10.0);
        base=mix(base,seabed,shallows*0.84);
        float rockEdge=rockDistance(p);
        float submergedRock=(1.0-smoothstep(-0.1,0.3,rockEdge))*(1.0-smoothstep(1.0,1.4,radius));
        base=mix(base,vec3(.095,.15,.14),submergedRock*.7);
        base+=vec3(0.035,0.045,0.03)*caustic*shallows*daylight;
        base *= 0.91+0.09*noise(p*1.4);
        vec3 color = mix(base*(0.08+daylight*0.55),reflectedSky,fresnel);
        float specular = pow(max(dot(reflect(-sunDirection,normal),view),0.0),360.0);
        color += sunColor * specular * (0.01+daylight*(.18+sunset*.65));
        float surge = sin(time*0.65 + angle*3.0)*0.012;
        float edge = abs(radius - (1.014 + surge + (noise(p*3.0)-0.5)*0.012));
        float lace = noise(p*7.0+time*0.12);
        float foam = (1.0-smoothstep(0.003,0.026,edge)) * smoothstep(0.3,0.8,lace)*0.18;
        float rockWash=(1.0-smoothstep(.025,.22,abs(rockEdge-.035-sin(time*.8+p.x)*.035)))
          *smoothstep(.32,.72,lace)*(0.22+0.12*sin(time*.8+noise(p)*5.0));
        foam=max(foam,rockWash*smoothstep(.94,1.02,radius));
        color = mix(color, vec3(0.82,0.91,0.87)*(0.06+daylight*0.85), foam);
        color = mix(color, skyRadiance(normalize(vec3(p-cameraPosition.xz,0.0).xzy),0.0),
          smoothstep(100.0,420.0,length(p-cameraPosition.xz)));
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const waterGeometry = new THREE.PlaneGeometry(1, 1, 256, 256);
  waterGeometry.rotateX(-Math.PI / 2);
  // Concentrate vertices around the island; the outer sea reaches beyond every allowed view.
  const vertices=waterGeometry.attributes.position;
  const spread=(value:number)=>Math.sign(value)*600*Math.pow(Math.abs(value)*2,3);
  for(let i=0;i<vertices.count;i++) vertices.setXYZ(i,spread(vertices.getX(i)),0,spread(vertices.getZ(i)));
  waterGeometry.computeBoundingSphere();
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.name='island-water';
  water.position.y = island.seaLevel;
  group.add(water);
  for (const geometry of [sandGeometry, waterGeometry]) geometries.add(geometry);
  for (const material of [sandMaterial, waterMaterial]) materials.add(material);
  let previous: number | undefined;
  return {
    group,
    setNormals(texture: THREE.Texture) { uniforms.normalMap.value=texture;uniforms.normalReady.value=1; },
    tick(now: number, moving: boolean) {
      if (!moving) { previous = undefined; return false; }
      uniforms.time.value += previous === undefined ? 0 : Math.min(50, Math.max(0, now - previous)) / 1000;
      previous = now;
      return true;
    },
    pause() { previous = undefined; },
    setLighting(light: StudioLighting) {
      sandMaterial.emissiveIntensity = (1-light.daylight)*0.35;
      rockMaterial.emissiveIntensity = (1-light.daylight)*0.2;
      uniforms.daylight.value = light.daylight;
      uniforms.sky.value.setHex(light.sky);
      uniforms.sunColor.value.setHex(light.sun);
      uniforms.horizon.value.setHex(light.horizon);
      uniforms.zenith.value.setHex(light.zenith);
      uniforms.sunDirection.value.fromArray(light.sunDirection);
      uniforms.sunset.value=light.sunset;
    },
  };
}
