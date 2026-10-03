/** One travelling breeze, sampled in island coordinates; time advances only while visible. */
export function breezeAt(x:number,z:number,time:number) {
  const phase=x*.45+z*.28;
  return (Math.sin(time*1.3-phase)+.35*Math.sin(time*2.1-phase*1.8))
    *(.55+.25*Math.sin(time*.31+.3))*(1-Math.exp(-time*.7));
}
export const breezeGLSL=`
float breezeAt(vec2 p,float t) {
  float phase=dot(p,vec2(.45,.28));
  return (sin(t*1.3-phase)+.35*sin(t*2.1-phase*1.8))
    *(.55+.25*sin(t*.31+.3))*(1.0-exp(-t*.7));
}
`;
