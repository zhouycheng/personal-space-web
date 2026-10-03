/** One radiance model for the visible sky and its reflection on the ocean. */
export const islandSkyGLSL=`
uniform vec3 zenith, horizon, sunColor, sunDirection;
uniform float daylight, sunset;
vec3 skyRadiance(vec3 direction,float discStrength){
  vec3 d=normalize(direction);
  float height=max(d.y,0.0);
  // Clear air: confine pale haze to the horizon instead of washing out the sky.
  vec3 color=mix(zenith,horizon,exp(-height*32.0));
  float solar=max(dot(d,sunDirection),0.0);
  float glow=pow(solar,32.0)*(.025+.28*sunset)*daylight;
  color+=sunColor*glow;
  float disc=smoothstep(.99988,.99997,solar)*smoothstep(0.0,.2,daylight);
  color+=sunColor*disc*3.0*discStrength;
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
