import * as THREE from 'three';
import type {StudioPrimitives} from './studioPrimitives.ts';

/** Rooted flame tongues share a turbulent updraft; emission accumulates through their volume. */
export function createCampfireFlame(p:StudioPrimitives,parent:THREE.Object3D,materials:Set<THREE.Material>) {
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.FrontSide,
    uniforms:{time:{value:0},eye:{value:new THREE.Vector3()}},
    vertexShader:`varying vec3 localPosition;void main(){localPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision highp float;
      varying vec3 localPosition;uniform vec3 eye;uniform float time;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float tongue(vec3 p,vec2 root,float seed){
        float height=.73+.14*sin(time*2.7+seed)+.10*sin(time*4.1+seed*3.);
        height+=seed<.5?.25:0.;
        float h=(p.y-.015)/height;
        if(h<0.||h>1.)return 0.;
        vec2 bend=vec2(sin(h*9.-time*3.9+seed),cos(h*8.2-time*3.1+seed))*h*h*.16;
        vec2 center=root*(1.-h*.42)+bend;
        vec3 flow=p*vec3(7.,3.5,7.)-vec3(0.,time*2.9,0.);
        float turbulence=noise(flow+seed*4.)*.65+noise(flow*2.03+vec3(7.,-time,3.))*.35;
        float radius=(.22+.045*sin(seed*7.))*pow(1.-h,.82);
        radius*=.5+.85*turbulence+.14*sin(h*19.-time*6.+seed);
        float distance=length(p.xz-center)/max(.003,radius);
        float body=1.-smoothstep(.2,1.,distance);
        return body*smoothstep(0.,.07,h)*(1.-smoothstep(.9,1.,h));
      }
      void main(){
        vec3 ray=normalize(localPosition-eye),point=localPosition+ray*.002;
        vec4 sum=vec4(0.);
        for(int i=0;i<64;i++){
          if(abs(point.x)>.58||abs(point.z)>.52||point.y<0.||point.y>1.3)break;
          float density=tongue(point,vec2(.01,-.03),0.);
          density+=tongue(point,vec2(-.24,.09),1.7);
          density+=tongue(point,vec2(.22,.12),3.2);
          density+=tongue(point,vec2(.12,-.24),4.8);
          density+=tongue(point,vec2(-.2,-.19),6.1);
          density=min(density,1.4);
          float heat=clamp(density*.64+(1.-point.y/1.3)*.28,0.,1.);
          vec3 color=mix(vec3(1.05,.045,.002),vec3(1.5,.46,.025),smoothstep(.08,.7,heat));
          color=mix(color,vec3(1.85,1.15,.42),smoothstep(.7,1.,heat)*(1.-smoothstep(.25,.65,point.y)));
          float alpha=1.-exp(-density*.024*8.);
          sum.rgb+=(1.-sum.a)*color*alpha;sum.a+=(1.-sum.a)*alpha;
          if(sum.a>.97)break;
          point+=ray*.024;
        }
        if(sum.a<.005)discard;
        gl_FragColor=vec4(sum.rgb/max(sum.a,.001),sum.a);
        #include <colorspace_fragment>
      }`});
  materials.add(material);
  const geometry=new THREE.BoxGeometry(1.16,1.3,1.04);geometry.translate(0,.65,0);
  const flame=p.mesh(parent,geometry,material,0,.15,0);flame.name='turbulent-fire-volume';flame.castShadow=flame.receiveShadow=false;
  const eye=new THREE.Vector3();flame.onBeforeRender=(_renderer,_scene,camera)=>{camera.getWorldPosition(eye);flame.worldToLocal(eye);material.uniforms.eye.value.copy(eye);};
  return flame;
}
