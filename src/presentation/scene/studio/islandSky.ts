/** One radiance model for the visible sky and its reflection on the ocean. */
export const islandSkyGLSL=`
uniform vec3 zenith, horizon, sunColor, sunDirection, moonDirection;
uniform float daylight, sunset;
vec3 skyRadiance(vec3 direction,float discStrength){
  vec3 d=normalize(direction);
  float height=max(d.y,0.0);
  // Twilight reaches above the horizon while the zenith retains its blue.
  float horizonWeight=exp(-height*mix(20.0,10.0,sunset));
  float facingSun=pow(max(dot(normalize(vec3(d.x,0.0001,d.z)),normalize(vec3(sunDirection.x,0.0001,sunDirection.z))),0.0),3.0);
  vec3 localHorizon=mix(mix(zenith,horizon,.55),horizon,.45+.55*facingSun);
  vec3 color=mix(zenith,localHorizon,horizonWeight);
  float solar=max(dot(d,sunDirection),0.0);
  float glow=pow(solar,32.0)*(.025+.28*sunset)*daylight;
  color+=sunColor*glow;
  float disc=smoothstep(.999987,.999991,solar)*smoothstep(0.0,.004,d.y)*step(0.0,sunDirection.y);
  color+=sunColor*disc*3.0*discStrength;
  // Actual angular radius, illuminated hemisphere oriented toward the sun.
  float radius=.00465;
  vec3 tangent=d-moonDirection*dot(d,moonDirection);
  float r2=dot(tangent,tangent)/(radius*radius);
  if(dot(d,moonDirection)>0.0&&r2<1.0&&d.y>0.0&&moonDirection.y>0.0){
    vec3 normal=normalize(tangent/radius-moonDirection*sqrt(max(0.0,1.0-r2)));
    float lit=smoothstep(-.025,.08,dot(normal,sunDirection));
    float maria=.83+.12*sin(normal.x*23.+normal.z*15.)*sin(normal.y*17.-normal.x*11.);
    float limb=1.-smoothstep(.88,1.,r2);
    color+=vec3(.78,.83,.92)*maria*lit*limb*(1.-.75*daylight)*discStrength;
  }
  return color;
}`;

export const islandSkyVertex=`varying vec3 vSkyDirection;
void main(){
  vSkyDirection=position;
  vec4 projected=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);
  gl_Position=projected.xyww;
}`;
export const islandSkyFragment=`varying vec3 vSkyDirection;
${islandSkyGLSL}
void main(){
  gl_FragColor=vec4(skyRadiance(vSkyDirection,1.0),1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
