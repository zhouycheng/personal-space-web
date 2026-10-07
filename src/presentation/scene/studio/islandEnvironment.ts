import * as THREE from "three";
import { islandAppearance as island } from "../../../config/islandAppearance.ts";
import type { StudioLighting } from "../../../contracts/studioPorts";
import { oceanWavesGLSL } from "./oceanShader.ts";
import { createIslandGeometry,createWaterGeometry } from './islandGeometry.ts';
import type { PreparedSceneGeometry } from './sceneGeometryData.ts';
import { createRockGeometry, createRockMaterial, rockCoastGLSL } from './islandRocks.ts';
import { createIslandVegetation } from './islandVegetation.ts';
import { islandPalms, islandUnderstory } from '../../../config/islandVegetation.ts';
import { dressingPlants,dressingProps } from '../../../config/islandDressing.ts';
import { islandSkyGLSL, islandSkyVertex, islandSkyFragment } from './islandSky.ts';
import { createMarineEnvironment, marineWaterGLSL } from './marineEnvironment.ts';
export { shoreRadius, islandHeight } from '../../../config/islandTerrain.ts';

export { createIslandGeometry } from './islandGeometry.ts';

// Generated from the same coefficients as the mesh; water and sand share a coastline.
const outlineGLSL = `1.0 ${island.shoreHarmonics.map(([f, a, p]) =>
  `+ ${a.toFixed(5)} * sin(angle * ${f.toFixed(1)} + ${p.toFixed(2)})`).join(" ")} ${island.shoreExtensions.map(([direction,amount,spread])=>
    `+ ${amount.toFixed(5)} * exp((cos(angle - ${direction.toFixed(8)}) - 1.0) / ${(spread*spread).toFixed(8)})`).join(' ')}`;
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
    + sin(p.y*25.0+5.0*sandNoise(p*1.7))*0.0006;
}`;

// Ground shading follows every planted center, with irregular soft edges rather than decals.
const plantContactGLSL=[...islandPalms.map(p=>({x:p.x,z:p.z,radius:.65,strength:.27})),
  ...dressingPlants.map(p=>({x:p.x,z:p.z,radius:p.radius*.65,strength:.2})),
  ...Object.values(dressingProps).map(p=>({x:p.x,z:p.z,radius:Math.hypot(p.width,p.depth)*.6,strength:.13})),
  ...islandUnderstory.map(p=>({x:p.x,z:p.z,radius:p.scale*.85,strength:.23}))].map(p=>`{
    vec2 rootDelta=(sandP-vec2(${p.x.toFixed(4)},${p.z.toFixed(4)}))/vec2(${p.radius.toFixed(4)},${(p.radius*.85).toFixed(4)});
    if(dot(rootDelta,rootDelta)<1.69){
      float rootContact=(1.0-smoothstep(.12,1.2,length(rootDelta)+rootNoise))*${p.strength.toFixed(3)};
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.46,.39,.28),rootContact);
    }
  }`).join('\n');

export function createIslandEnvironment(scene: THREE.Scene, materials: Set<THREE.Material>,
  geometries: Set<THREE.BufferGeometry>, prepared?:PreparedSceneGeometry) {
  const group = new THREE.Group();
  group.name = "island-environment";
  scene.add(group); // Deliberately outside the room's pickable object tree.
  const marine = createMarineEnvironment(materials, geometries);
  group.add(marine.group);
  const sandGeometry = prepared?.sand ?? createIslandGeometry();
  const sandMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1,
    emissive: 0x203a54, emissiveIntensity: 0 });
  sandMaterial.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vSandPosition;\n${shader.vertexShader}`.replace(
      "#include <begin_vertex>", "#include <begin_vertex>\nvSandPosition = position;");
    shader.fragmentShader = `varying vec3 vSandPosition;\n${coastGLSL}\n${sandNoiseGLSL}\n${shader.fragmentShader}`.replace(
      "#include <color_fragment>", `#include <color_fragment>
      vec2 sandP=vSandPosition.xz;
      float sandRadius=coastRadius(sandP);
      float damp=smoothstep(0.86,1.035,sandRadius+0.022*(sandNoise(sandP*3.0)-0.5));
      float grain=sandNoise(sandP*160.0);
      float grainVisibility=1.0-smoothstep(0.004,0.025,max(length(dFdx(sandP)),length(dFdy(sandP))));
      float mottling=(sandNoise(sandP*.85)-0.5)*0.09+(sandNoise(sandP*11.0)-0.5)*0.035;
      diffuseColor.rgb *= 1.0+mottling+(grain-0.5)*0.18*grainVisibility;
      diffuseColor.rgb *= 1.0-0.09*damp;
      float rootNoise=(sandNoise(sandP*13.0)-.5)*.2;
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
  const rockGeometry=prepared?.rocks??createRockGeometry(),rockMaterial=createRockMaterial();
  const rocks=new THREE.Mesh(rockGeometry,rockMaterial);
  rocks.name='island-rocks';rocks.castShadow=true;rocks.receiveShadow=true;
  group.add(rocks);geometries.add(rockGeometry);materials.add(rockMaterial);
  const vegetation=createIslandVegetation(materials,geometries,prepared?.vegetation);group.add(vegetation);

  const uniforms = {
    ...marine.uniforms,
    boatInverse:{value:new THREE.Matrix4()},boatReady:{value:0},boatCenter:{value:new THREE.Vector3()},
    time: { value: 0 }, daylight: { value: 1 },
    normalMap: { value: null as THREE.Texture | null }, normalReady: { value: 0 },
    shallow: { value: new THREE.Color(island.shallowWater) },
    deep: { value: new THREE.Color(island.deepWater) },
    sky: { value: new THREE.Color(0xc9e1e8) },
    sunColor: { value: new THREE.Color(0xfff8ed) },
    horizon: { value: new THREE.Color(0xe7e3dc) },
    zenith: { value: new THREE.Color(0x538ab7) },
    sunDirection: { value: new THREE.Vector3(-3,7,2.5).normalize() },
    moonDirection: { value: new THREE.Vector3(0,-1,0) },
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
      varying float vWaterDepth;
      attribute vec4 coastData;
      varying vec2 vRest, vCoastGradient;
      varying float vCoastWeight;
      uniform float time;
      ${coastGLSL}
      ${oceanWavesGLSL}
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vRest=vWorld.xz;
        vCoastWeight=coastData.x;
        vCoastGradient=coastData.yz;
        vWorld += oceanParticle(vRest,time,0.0).offset * vCoastWeight;
        vWorld.y+=.026*sin(time*.72+vRest.x*.17+vRest.y*.11)*coastData.w;
        vec4 viewPosition=viewMatrix*vec4(vWorld,1.0);
        vWaterDepth=-viewPosition.z;
        gl_Position = projectionMatrix * viewPosition;
      }`,
    fragmentShader: `
      uniform float time;
      uniform float normalReady;
      uniform mat4 boatInverse;
      uniform float boatReady;
      uniform vec3 boatCenter;
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
      ${marineWaterGLSL}
      float foamCells(vec2 p) {
        p+=vec2(noise(p*1.9+time*.06),noise(p*2.1+17.-time*.045))*.56;
        vec2 cell=floor(p),f=fract(p);float first=8.,second=8.;
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          vec2 n=vec2(float(x),float(y));
          vec2 jitter=vec2(hash(cell+n),hash(cell+n+13.7));
          float d=length(n+jitter-f);
          if(d<first){second=first;first=d;}else{second=min(second,d);}
        }
        float edge=second-first;
        return (1.-smoothstep(.022,.105,edge))*smoothstep(.2,.48,noise(p*2.4+time*.09));
      }
      void main() {
        // Exclude the dry interior below the waterline using the moving hull section.
        vec2 boatDelta=vWorld.xz-boatCenter.xz;
        if(boatReady>.5&&dot(boatDelta,boatDelta)<4.){
          vec3 b=(boatInverse*vec4(vWorld,1.)).xyz;float u=(b.x+1.65)/3.3;
          if(u>0.&&u<1.){
            float width=.60*pow(sin(3.14159265*u/2.),.65)*(1.-.28*pow(u,4.));
            float rise=.12*pow(1.-u,3.)+.015*u*u;
            float section=pow(clamp((b.y+.20-rise)/.54,0.,1.),1./2.4);
            if(abs(b.z)<width*section&&b.y<.34+rise)discard;
          }
        }
        vec2 p = vWorld.xz;
        float radius = coastRadius(p);
        float angle = atan(p.y-(${island.centerZ}),p.x);
        float bedDepth=max(0.,${-island.seaLevel}*pow(max(0.,(radius-${island.plateau})/(1.-${island.plateau})),1.65)+${island.seaLevel}+.32*smoothstep(1.,1.16,radius));
        float depth = 1.-exp(-bedDepth*.7);
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
        float shallows=exp(-bedDepth*3.8);
        float caustic=0.;
        if(shallows>.0001){
          shallows*=smoothstep(.0001,.0002,shallows);
          vec3 seabed=vec3(0.52,0.43,0.29)*(0.94+0.06*noise(p*8.0));
          vec2 causticP=p+vec2(noise(p*2.3),noise(p*2.1+19.0))*0.7;
          caustic=pow(1.0-abs(sin(causticP.x*8.0+sin(causticP.y*6.0+time*.25))*sin(causticP.y*7.0-time*.3)),10.0);
          base=mix(base,seabed,shallows*.78);
        }
        float submergedRock=(1.0-smoothstep(-0.1,0.25,reefDistance(p+windSlopes*.12)))*exp(-bedDepth*.75);
        base=mix(base,vec3(.095,.15,.14),submergedRock*.7);
        base+=vec3(0.055,0.065,0.04)*caustic*shallows*daylight;
        base *= 0.91+0.09*noise(p*1.4);
        vec3 waterBody=marineWater(base*(0.08+daylight*0.55),windSlopes,
          length(cameraPosition-vWorld)/max(.01,vWaterDepth));
        vec3 color = mix(waterBody,reflectedSky,fresnel);
        float specular = pow(max(dot(reflect(-sunDirection,normal),view),0.0),360.0);
        color += sunColor * specular * (0.01+daylight*(.18+sunset*.65))*smoothstep(0.0,.07,sunDirection.y);
        if(radius<2.) {
        float rockEdge=min(rockDistance(p),marineReefDistance(p));
        float washPhase=time*.72+p.x*.17+p.y*.11;
        float waterline=1.-.021*sin(washPhase);
        float shoreMeters=(radius-waterline)*7.0;
        float shoreBand=(1.-smoothstep(.15,1.25,shoreMeters))*smoothstep(-.10,.04,shoreMeters);
        float rockBand=1.-smoothstep(.06,.48,abs(rockEdge-.1-.035*sin(washPhase)));
        // Leading-edge noise shifts at most .035 m; outside .12 m its contribution is zero.
        // Screen derivatives and implicit texture samples are evaluated above this branch.
        if(shoreBand>0.||abs(shoreMeters-.035)<.12||(rockBand>0.&&radius>.93)) {
        vec2 drift=normalize(p-vec2(0.,${island.centerZ}))*sin(washPhase)*.13;
        vec2 foamP=(p+drift+vec2(noise(p*1.8+time*.06),noise(p*1.7-time*.04))*.28)*3.4;
        float lace=foamCells(foamP);
        float patches=smoothstep(.25,.65,noise(p*1.35+vec2(time*.035,0.)));
        float leading=(1.-smoothstep(.018,.085,abs(shoreMeters-.035-(noise(p*6.)-.5)*.07)))*(.45+.45*patches);
        float foam=shoreBand*lace*(.3+.35*patches)+leading*.32;
        float rockWash=rockBand
          *(.18+lace*.7)*( .7+.3*sin(washPhase+noise(p)*4.));
        foam=max(foam,rockWash*smoothstep(.93,1.,radius));
        foam*=1.-smoothstep(1.65,2.,radius);
        color = mix(color, vec3(0.82,0.91,0.87)*(0.06+daylight*0.85), foam);
        }
        }
        color = mix(color, skyRadiance(normalize(vec3(p-cameraPosition.xz,0.0).xzy),0.0),
          smoothstep(100.0,420.0,length(p-cameraPosition.xz)));
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const waterGeometry = prepared?.water ?? createWaterGeometry();
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.name='island-water';
  water.position.y = island.seaLevel;
  group.add(water);
  for (const geometry of [sandGeometry, waterGeometry]) geometries.add(geometry);
  for (const material of [sandMaterial, waterMaterial]) materials.add(material);
  let previous: number | undefined;
  const boatWorld=new THREE.Matrix4();
  return {
    group,
    renderMarine:marine.render,
    dispose:marine.dispose,
    get time(){return uniforms.time.value;},
    setBoatInverse(matrix:THREE.Matrix4){uniforms.boatInverse.value.copy(matrix);uniforms.boatCenter.value.setFromMatrixPosition(boatWorld.copy(matrix).invert());uniforms.boatReady.value=1;},
    setWind(seconds:number){vegetation.setWind(seconds);},
    updateDetail(camera:THREE.PerspectiveCamera,height:number){return vegetation.updateDetail(camera,height);},
    setNormals(texture: THREE.Texture) { uniforms.normalMap.value=texture;uniforms.normalReady.value=1; },
    tick(now: number, moving: boolean) {
      if (!moving) { previous = undefined; return false; }
      uniforms.time.value += previous === undefined ? 0 : Math.min(50, Math.max(0, now - previous)) / 1000;
      marine.update(uniforms.time.value);
      previous = now;
      return true;
    },
    pause() { previous = undefined; },
    setLighting(light: StudioLighting) {
      marine.setLighting(light.daylight, light.horizon);
      sandMaterial.emissiveIntensity = (1-light.daylight)*0.35;
      rockMaterial.emissiveIntensity = (1-light.daylight)*0.2;
      uniforms.daylight.value = light.daylight;
      uniforms.sky.value.setHex(light.sky);
      uniforms.sunColor.value.setHex(light.sun);
      uniforms.horizon.value.setHex(light.horizon);
      uniforms.zenith.value.setHex(light.zenith);
      uniforms.sunDirection.value.fromArray(light.sunDirection);
      uniforms.moonDirection.value.fromArray(light.moonDirection);
      uniforms.sunset.value=light.sunset;
    },
  };
}
