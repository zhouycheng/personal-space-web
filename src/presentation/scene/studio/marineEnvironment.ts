import * as THREE from 'three';
import { marineLife, marineReefs } from '../../../config/marineLife.ts';
import { marinePose } from '../../../animation/studio/marineMotion.ts';
import { createRockGeometry, createRockMaterial } from './islandRocks.ts';
import { createIslandGeometry } from './islandGeometry.ts';
import { createMarineAnimal, createMarineCoral, createHorizonGeometry } from './marineGeometry.ts';

const underwaterLayer = 1;

export const marineWaterGLSL = `
  uniform sampler2D marineColor, marineDepth;
  uniform vec2 marineViewport;
  uniform vec2 marineCameraRange;
  uniform float marineReady;
  varying float vWaterDepth;
  float marineViewDepth(float depth) {
    return marineCameraRange.x * marineCameraRange.y /
      (marineCameraRange.y - depth * (marineCameraRange.y - marineCameraRange.x));
  }
  vec3 marineWater(vec3 waterColor, vec2 distortion, float rayScale) {
    if(marineReady<.5)return waterColor;
    vec2 uv=gl_FragCoord.xy/marineViewport;
    float depth=texture2D(marineDepth,uv).r;
    vec4 sampleColor=texture2D(marineColor,uv);
    float distance=marineViewDepth(depth)-vWaterDepth;
    if(depth>=.99999||distance<=0.||sampleColor.a<.01)return waterColor;
    vec2 bent=uv+distortion*min(distance,.8)*.002;
    float bentDepth=texture2D(marineDepth,clamp(bent,vec2(0.),vec2(1.))).r;
    vec4 bentColor=texture2D(marineColor,clamp(bent,vec2(0.),vec2(1.)));
    float bentDistance=marineViewDepth(bentDepth)-vWaterDepth;
    if(all(greaterThan(bent,vec2(0.)))&&all(lessThan(bent,vec2(1.)))&&
       bentColor.a>.99&&bentDistance>0.&&abs(bentDistance-distance)<.12) {
      sampleColor=bentColor;distance=bentDistance;
    }
    vec3 transmission=exp(-vec3(.65,.32,.23)*distance*rayScale);
    return mix(waterColor,sampleColor.rgb*transmission+waterColor*(1.-transmission),sampleColor.a*.82);
  }
  float marineReefDistance(vec2 p) {
    float d=2.;
    ${marineReefs.map(r => `{
      vec2 q=p-vec2(${r.x.toFixed(5)},${r.z.toFixed(5)});
      if(abs(q.x)<${(Math.max(r.width,r.depth)+.6).toFixed(5)}&&abs(q.y)<${(Math.max(r.width,r.depth)+.6).toFixed(5)}){
        q=mat2(${Math.cos(r.rotation).toFixed(5)},${(-Math.sin(r.rotation)).toFixed(5)},${Math.sin(r.rotation).toFixed(5)},${Math.cos(r.rotation).toFixed(5)})*q;
        d=min(d,(length(q/vec2(${(r.width * .8).toFixed(5)},${(r.depth * .8).toFixed(5)}))-1.)*${r.depth.toFixed(5)});
      }
    }`).join('\n')}
    return d;
  }
`;

export function createMarineEnvironment(materials: Set<THREE.Material>, geometries: Set<THREE.BufferGeometry>) {
  const group = new THREE.Group();group.name = 'marine-environment';
  group.userData.excludeZoom = true;
  const time = { value: 0 };
  const underwaterPass = { value: 0 };
  const uniforms = {
    marineColor: { value: null as THREE.Texture | null }, marineDepth: { value: null as THREE.DepthTexture | null },
    marineViewport: { value: new THREE.Vector2(1, 1) }, marineCameraRange: { value: new THREE.Vector2(.1, 900) },
    marineReady: { value: 0 },
  };
  function add(mesh: THREE.Mesh, name: string, surface = false) {
    mesh.name = name;mesh.userData.excludeZoom = true;
    mesh.layers.set(underwaterLayer);if (surface) mesh.layers.enable(0);
    group.add(mesh);geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    return mesh;
  }
  const reefs = add(new THREE.Mesh(createRockGeometry(marineReefs, 2), createRockMaterial()), 'marine-reefs', true);
  const haze = { value: new THREE.Color(0xe7e3dc) };
  const distantMaterial = new THREE.MeshStandardMaterial({ color: 0x52635c, roughness: 1 });
  distantMaterial.onBeforeCompile = shader => {
    shader.uniforms.marineHaze = haze;
    shader.fragmentShader = `uniform vec3 marineHaze;\n${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>', `
      outgoingLight=mix(outgoingLight,marineHaze,.25+.45*smoothstep(100.,420.,length(vViewPosition)));
      #include <opaque_fragment>`);
  };
  const distant = add(new THREE.Mesh(createHorizonGeometry(), distantMaterial), 'marine-horizon-islands', true);
  distant.layers.set(0);
  const coral = add(new THREE.Mesh(createMarineCoral(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92 })), 'marine-coral');
  // A coarse copy of the same seabed blocks submerged objects without shading the island twice.
  const bed = add(new THREE.Mesh(createIslandGeometry(96, 32), new THREE.MeshBasicMaterial({ colorWrite: false })), 'marine-depth-bed');
  bed.renderOrder = -1;
  function animalMaterial(kind: 'shark' | 'school' | 'turtle') {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, side: THREE.DoubleSide });
    const length = marineLife[kind].length;
    material.onBeforeCompile = shader => {
      shader.uniforms.marineTime = time;
      shader.uniforms.marinePass = underwaterPass;
      shader.vertexShader = `uniform float marineTime;
        varying vec3 vMarinePosition;
        ${kind==='school'?'attribute float marineClown; varying float vMarineClown;':''}
        ${shader.vertexShader}`.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vMarinePosition=position;
        ${kind==='school'?'vMarineClown=marineClown;':''}
        float phase=0.;
        #ifdef USE_INSTANCING
          phase=instanceMatrix[3].x*2.1+instanceMatrix[3].z*1.3;
        #endif
        ${kind === 'turtle' ? `
          transformed.y+=sin(marineTime*1.7+position.z*.7+step(position.x,0.)*.8)*smoothstep(${length * .20},${length * .50},abs(position.z))*${length * .09};
        ` : `
          float tail=smoothstep(${length * .08},${length * .50},-position.x);
          transformed.z+=sin(marineTime*${kind === 'shark' ? '2.8' : '7.0'}+phase+position.x*${5 / length})*tail*${length * .055};
        `}`);
      shader.fragmentShader=`uniform float marinePass;varying vec3 vMarinePosition;
        ${kind==='school'?'varying float vMarineClown;':''}
        ${shader.fragmentShader}`;
      if(kind==='school')shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
        #include <color_fragment>
        if(vMarineClown>.5){
          float x=vMarinePosition.x/${length};
          float stripe=min(min(abs(x-.18)-.045,abs(x+.055)-.05),abs(x+.34)-.032);
          vec3 orange=vec3(.72,.17,.018),cream=vec3(.80,.82,.72),edge=vec3(.035,.030,.024);
          diffuseColor.rgb=mix(orange,edge,1.-smoothstep(.009,.018,stripe));
          diffuseColor.rgb=mix(diffuseColor.rgb,cream,1.-smoothstep(-.006,.003,stripe));
          diffuseColor.rgb*=.84+.16*smoothstep(-.02,.02,vMarinePosition.y);
        }
      `);
      if(kind==='shark')shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
        #include <opaque_fragment>
        gl_FragColor.a=mix(1.,.24,marinePass);
      `);
    };
    material.customProgramCacheKey = () => `marine-${kind}`;
    return material;
  }
  const shark = add(new THREE.Mesh(createMarineAnimal('shark'), animalMaterial('shark')), 'marine-shark', true);
  const turtle = add(new THREE.Mesh(createMarineAnimal('turtle'), animalMaterial('turtle')), 'marine-turtle');
  const fishGeometry = createMarineAnimal('school'), fishMaterial = animalMaterial('school');
  fishGeometry.setAttribute('marineClown',new THREE.InstancedBufferAttribute(
    Float32Array.from({length:marineLife.school.count},(_,i)=>i<3?1:0),1));
  const schools = marineLife.colonies.map((_, index) => {
    const mesh = new THREE.InstancedMesh(fishGeometry, fishMaterial, marineLife.school.count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    add(mesh, `marine-school-${index}`);return mesh;
  });
  const transform = new THREE.Object3D();
  let lastTime = Number.NaN;
  function update(seconds: number) {
    if (seconds === lastTime) return;
    lastTime = seconds;time.value = seconds;
    for (const [kind, mesh] of [['shark', shark], ['turtle', turtle]] as const) {
      const pose = marinePose(kind, seconds);
      mesh.position.set(pose.x, pose.y, pose.z);mesh.rotation.y = pose.heading;
    }
    schools.forEach((school, index) => {
      for (let fish = 0; fish < school.count; fish++) {
        const pose = marinePose('school', seconds, index, fish);
        transform.position.set(pose.x, pose.y, pose.z);transform.rotation.set(0, pose.heading, 0);
        transform.scale.setScalar(.84 + .16 * ((fish * 7 % 11) / 10));transform.updateMatrix();
        school.setMatrixAt(fish, transform.matrix);
      }
      school.instanceMatrix.needsUpdate = true;school.computeBoundingSphere();
    });
  }
  update(0);
  let target: THREE.WebGLRenderTarget | undefined;
  let lightLayersReady = false;
  const size = new THREE.Vector2(), clearColor = new THREE.Color();
  return {
    group, uniforms, update,
    render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
      if (!group.visible || !group.parent?.visible) { uniforms.marineReady.value = 0;return; }
      renderer.getDrawingBufferSize(size);uniforms.marineViewport.value.copy(size);
      const narrow = renderer.domElement.clientWidth <= 600;
      const settings = marineLife.target;
      const ratio = Math.min(narrow ? settings.narrowScale : settings.desktopScale,
        (narrow ? settings.narrowLimit : settings.desktopLimit) / Math.max(size.x, size.y));
      const width = Math.max(1, Math.round(size.x * ratio)), height = Math.max(1, Math.round(size.y * ratio));
      if (!target) {
        target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true,
          type: renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType });
        target.texture.colorSpace = THREE.LinearSRGBColorSpace;
        target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
        uniforms.marineColor.value = target.texture;uniforms.marineDepth.value = target.depthTexture;
      } else if (target.width !== width || target.height !== height) target.setSize(width, height);
      uniforms.marineCameraRange.value.set(camera.near, camera.far);
      const previousTarget = renderer.getRenderTarget(), mask = camera.layers.mask;
      const toneMapping = renderer.toneMapping, shadows = renderer.shadowMap.enabled;
      const alpha = renderer.getClearAlpha();renderer.getClearColor(clearColor);
      // Existing scene lights illuminate both passes; marine objects never cast shadows.
      if (!lightLayersReady) {
        scene.traverse(object => { if (object instanceof THREE.Light) object.layers.enable(underwaterLayer); });
        lightLayersReady = true;
      }
      try {
        underwaterPass.value=1;
        camera.layers.set(underwaterLayer);renderer.shadowMap.enabled = false;
        renderer.toneMapping = THREE.NoToneMapping;renderer.setClearColor(0, 0);
        renderer.setRenderTarget(target);renderer.render(scene, camera);
        uniforms.marineReady.value = 1;
      } finally {
        underwaterPass.value=0;
        renderer.setRenderTarget(previousTarget);camera.layers.mask = mask;
        renderer.toneMapping = toneMapping;renderer.shadowMap.enabled = shadows;renderer.setClearColor(clearColor, alpha);
      }
    },
    setLighting(daylight: number, horizon: number) {
      haze.value.setHex(horizon);
      (reefs.material as THREE.MeshStandardMaterial).emissiveIntensity = (1 - daylight) * .2;
      (coral.material as THREE.MeshStandardMaterial).emissive.setHex(0x10262b);
      (coral.material as THREE.MeshStandardMaterial).emissiveIntensity = (1 - daylight) * .08;
    },
    dispose() {
      target?.dispose();target = undefined;
      uniforms.marineColor.value=null;uniforms.marineDepth.value=null;uniforms.marineReady.value=0;
    },
  };
}
