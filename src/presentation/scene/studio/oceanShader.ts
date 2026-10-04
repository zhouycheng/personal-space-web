// Lagrangian Gerstner surface: p is a particle's REST coordinate, not its
// displaced world position. Wave packets bend crests and vary their strength.
// Q*k*A sums to 0.6; packet/phase gradients keep the upper bound below 0.75.
// Reference: NVIDIA GPU Gems, chapter 1, equations 9–12.
import { oceanWaves,oceanSteepness } from '../../../config/oceanWaves.ts';
export { oceanWaves,oceanSteepness } from '../../../config/oceanWaves.ts';

export const oceanWavesGLSL = `
  struct OceanParticle { vec3 offset; vec3 tangentX; vec3 tangentZ; };
  OceanParticle oceanParticle(vec2 p, float time, float footprint) {
    OceanParticle result;
    result.offset=vec3(0.0);
    result.tangentX=vec3(1.0,0.0,0.0);
    result.tangentZ=vec3(0.0,0.0,1.0);
    ${oceanWaves.map(([length, amplitude, direction, phase], index) => {
      const k = Math.PI*2/length, x=Math.cos(direction), z=Math.sin(direction);
      const horizontal = oceanSteepness / (oceanWaves.length*k);
      const crossDirection=direction+1.15+index*0.37;
      const wx=Math.cos(crossDirection)*k*.23,wz=Math.sin(crossDirection)*k*.23;
      const px=Math.cos(direction-.8)*k*.13,pz=Math.sin(direction-.8)*k*.13;
      return `{
        vec2 direction = vec2(${x.toFixed(8)},${z.toFixed(8)});
        float k = ${k.toFixed(8)};
        vec2 warpK=vec2(${wx.toFixed(8)},${wz.toFixed(8)});
        vec2 packetK=vec2(${px.toFixed(8)},${pz.toFixed(8)});
        float warp=dot(warpK,p)+time*0.035+${(phase*1.71).toFixed(6)};
        float packet=dot(packetK,p)-time*0.045+${(phase*2.13).toFixed(6)};
        float envelope=0.72+0.28*sin(packet);
        vec2 envelopeGradient=0.28*cos(packet)*packetK;
        float phase = dot(direction*k,p) - ${Math.sqrt(9.81*k).toFixed(6)}*time*0.45 + ${phase.toFixed(2)} + 0.9*sin(warp);
        vec2 phaseGradient=direction*k+0.9*cos(warp)*warpK;
        float bandWeight = 1.0-smoothstep(${(length*.12).toFixed(6)},${(length*.5).toFixed(6)},footprint);
        float amplitude = ${amplitude.toFixed(6)}*bandWeight;
        float lateral = ${horizontal.toFixed(8)}*bandWeight;
        float s=sin(phase), c=cos(phase);
        vec3 orbit=vec3(direction.x*lateral*c,amplitude*s,direction.y*lateral*c);
        vec3 derivative=vec3(-direction.x*lateral*s,amplitude*c,-direction.y*lateral*s);
        result.offset += orbit*envelope;
        result.tangentX += derivative*phaseGradient.x*envelope + orbit*envelopeGradient.x;
        result.tangentZ += derivative*phaseGradient.y*envelope + orbit*envelopeGradient.y;
      }`;
    }).join("\n")}
    return result;
  }
`;
