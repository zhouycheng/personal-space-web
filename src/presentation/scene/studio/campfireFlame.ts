import * as THREE from 'three';
import type {StudioPrimitives} from './studioPrimitives.ts';

/** One bounded WebGL volume: advected turbulence, hot core and thinning flame tips. */
export function createCampfireFlame(p:StudioPrimitives,parent:THREE.Object3D,materials:Set<THREE.Material>) {
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,
    uniforms:{time:{value:0},eye:{value:new THREE.Vector3()}},
    vertexShader:`varying vec3 localPosition;void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision highp float;
      varying vec3 localPosition;uniform vec3 eye;uniform float time;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){
        vec3 ray=normalize(localPosition-eye),point=localPosition+ray*.002;
        vec4 sum=vec4(0.);
        for(int i=0;i<48;i++){
          if(abs(point.x)>.67||abs(point.z)>.60||point.y<0.||point.y>1.55)break;
          float h=point.y/1.55;
          vec3 q=point*vec3(9.,5.,9.)-vec3(0.,time*2.6,0.);
          float n=noise(q)+.48*noise(q*2.07+vec3(2.,-time*.8,7.));
          vec2 center=vec2(.10*sin(h*6.-time*1.6),.065*sin(h*9.-time*1.2))*h;
          float radius=mix(.49,.015,pow(h,.85));
          float radial=length((point.xz-center)*vec2(1.,1.1));
          float density=smoothstep(.0,.04,radius-radial+(n-.73)*(.20+.30*h));
          density*=smoothstep(.60,.83,n+.12*(1.-h)-radial*.20);
          density*=smoothstep(0.,.065,point.y)*(1.-smoothstep(.78,1.,h));
          float hot=clamp((1.-h)*1.45-radial*1.1+(n-.8)*.28,0.,1.);
          vec3 color=mix(vec3(1.,.035,.001),vec3(1.6,1.05,.25),pow(hot,1.7));
          float alpha=density*.22;
          sum.rgb+=(1.-sum.a)*color*alpha;sum.a+=(1.-sum.a)*alpha;
          if(sum.a>.97)break;
          point+=ray*.036;
        }
        if(sum.a<.005)discard;
        gl_FragColor=vec4(sum.rgb/max(sum.a,.001),sum.a);
        #include <colorspace_fragment>
      }`});
  materials.add(material);
  const geometry=new THREE.BoxGeometry(1.34,1.55,1.2);geometry.translate(0,.775,0);
  const flame=p.mesh(parent,geometry,material,0,.15,0);flame.name='turbulent-fire-volume';flame.castShadow=flame.receiveShadow=false;
  const eye=new THREE.Vector3();flame.onBeforeRender=(_renderer,_scene,camera)=>{camera.getWorldPosition(eye);flame.worldToLocal(eye);material.uniforms.eye.value.copy(eye);};
  return flame;
}
