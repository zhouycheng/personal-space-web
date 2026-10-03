import { expect, test } from 'playwright/test';
import { oceanWavesGLSL } from '../../src/presentation/scene/studio/oceanShader';

test('Gerstner GPU particles move laterally and vertically with consistent non-overturning tangents',async({page})=>{
  await page.goto('about:blank');
  const samples=await page.evaluate(source=>{
    const gl=document.createElement('canvas').getContext('webgl2')!;
    if(!gl)throw new Error('WebGL2 unavailable');
    const program=gl.createProgram()!;
    const shader=(type:number,body:string)=>{
      const shader=gl.createShader(type)!;gl.shaderSource(shader,body);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)!);
      gl.attachShader(program,shader);gl.deleteShader(shader);
    };
    shader(gl.VERTEX_SHADER,`#version 300 es
      precision highp float;
      uniform float time;
      layout(location=0) in vec2 rest;
      out vec3 displacement;out vec3 tx;out vec3 tz;
      ${source}
      void main(){OceanParticle p=oceanParticle(rest,time,0.0);displacement=p.offset;tx=p.tangentX;tz=p.tangentZ;gl_Position=vec4(0,0,0,1);}`);
    shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1);}');
    gl.transformFeedbackVaryings(program,['displacement','tx','tz'],gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)!);
    gl.useProgram(program);
    const points=[];
    for(const [x,z] of [[0,0],[2,4],[10,-12],[40,50]]) points.push(x,z,x+.001,z,x-.001,z,x,z+.001,x,z-.001);
    const input=gl.createBuffer(),output=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,input);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.TRANSFORM_FEEDBACK_BUFFER,output);gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER,points.length/2*9*4,gl.STREAM_READ);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER,0,output);
    const results=[];
    for(const time of [0,1,4,12]) {
      gl.uniform1f(gl.getUniformLocation(program,'time'),time);
      gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS,0,points.length/2);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
      const values=new Float32Array(points.length/2*9);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,values);
      results.push(Array.from(values));
    }
    gl.deleteBuffer(input);gl.deleteBuffer(output);gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return results;
  },oceanWavesGLSL);
  expect(Math.abs(samples[0][0]-samples[1][0])).toBeGreaterThan(.001);
  expect(Math.abs(samples[0][1]-samples[1][1])).toBeGreaterThan(.001);
  for(const samplesAtTime of samples) for(let base=0;base<samplesAtTime.length;base+=45) {
    const tx=samplesAtTime.slice(base+3,base+6),tz=samplesAtTime.slice(base+6,base+9);
    expect(tz[2]*tx[0]-tz[0]*tx[2]).toBeGreaterThan(0);
    for(let axis=0;axis<3;axis++) {
      const numericX=(samplesAtTime[base+9+axis]-samplesAtTime[base+18+axis])/.002+(axis===0?1:0);
      const numericZ=(samplesAtTime[base+27+axis]-samplesAtTime[base+36+axis])/.002+(axis===2?1:0);
      expect(Math.abs(tx[axis]-numericX)).toBeLessThan(.012);
      expect(Math.abs(tz[axis]-numericZ)).toBeLessThan(.012);
    }
  }
});
