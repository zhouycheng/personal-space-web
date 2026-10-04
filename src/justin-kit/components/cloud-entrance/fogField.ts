const smooth = (value:number) => {const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

/** Numerical density, not an image asset. Four advected volumes form one field. */
export function createFogField() {
  let seed=137;
  const random=()=>{seed=seed*16807%2147483647;return seed/2147483647;};
  const size=128;
  const grids=[2,4,8,16].map(side=>({side,values:Float32Array.from({length:side*side},random)}));
  const cells=[3,8].map(side=>({side,points:Float32Array.from({length:side*side*2},random)}));
  function billow(x:number,y:number,cell:typeof cells[number]) {
    const {side,points}=cell,gx=x*side,gy=y*side,ix=Math.floor(gx),iy=Math.floor(gy);
    let nearest=Infinity;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
      const cx=ix+dx,cy=iy+dy,index=(((cy+side)%side)*side+(cx+side)%side)*2;
      const px=cx+points[index]-gx,py=cy+points[index+1]-gy;
      nearest=Math.min(nearest,px*px+py*py);
    }
    return Math.exp(-nearest*3.2);
  }
  let noise=new Float32Array(size*size);
  let normalsX=new Float32Array(size*size),normalsY=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    let value=0,weight=1,total=0;
    for(const {side,values} of grids) {
      const gx=x/size*side,gy=y/size*side,ix=Math.floor(gx),iy=Math.floor(gy);
      const tx=smooth(gx-ix),ty=smooth(gy-iy);
      const a=values[iy*side+ix],b=values[iy*side+(ix+1)%side];
      const c=values[((iy+1)%side)*side+ix],d=values[((iy+1)%side)*side+(ix+1)%side];
      value+=((a+(b-a)*tx)*(1-ty)+(c+(d-c)*tx)*ty)*weight;
      total+=weight;weight*=.55;
    }
    // Large rounded lobes, smaller billows and fine erosion have distinct scales.
    noise[y*size+x]=value/total*.5+billow(x/size,y/size,cells[0])*.4+billow(x/size,y/size,cells[1])*.1;
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    normalsX[y*size+x]=(noise[y*size+(x+size-1)%size]-noise[y*size+(x+1)%size])*18;
    normalsY[y*size+x]=(noise[((y+size-1)%size)*size+x]-noise[((y+1)%size)*size+x])*18;
  }
  function sample(x:number,y:number,values=noise) {
    const gx=((x%1)+1)%1*size,gy=((y%1)+1)%1*size;
    const ix=Math.floor(gx),iy=Math.floor(gy),tx=gx-ix,ty=gy-iy;
    const a=values[iy*size+ix],b=values[iy*size+(ix+1)%size];
    const c=values[((iy+1)%size)*size+ix],d=values[((iy+1)%size)*size+(ix+1)%size];
    return (a+(b-a)*tx)*(1-ty)+(c+(d-c)*tx)*ty;
  }
  return {
    sample,
    dispose() { noise=normalsX=normalsY=new Float32Array(0); },
    paint(width:number,height:number,progress:number,pixels:Uint8ClampedArray) {
      const movement=smooth((progress-.1)/.72),center=.38+1.68*movement;
      const cover=1-smooth((progress-.13)/.21),fade=1-smooth((progress-.8)/.19);
      const envelopeX=new Float32Array(width),envelopeY=new Float32Array(height);
      for(let x=0;x<width;x++) {
        const nx=x/Math.max(1,width-1)*2-1;
        envelopeX[x]=Math.exp(-(((nx+center)/.7)**2))+Math.exp(-(((nx-center*1.03)/.73)**2));
      }
      for(let y=0;y<height;y++) {
        const ny=y/Math.max(1,height-1)*2-1;
        envelopeY[y]=Math.exp(-(((ny+center*.98)/.7)**2))+Math.exp(-(((ny-center)/.74)**2));
      }
      for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
        const nx=x/Math.max(1,width-1)*2-1,ny=y/Math.max(1,height-1)*2-1;
        // Continuous advection at the quadrant joins avoids seams or rotation.
        const dx=nx/Math.sqrt(nx*nx+.08),dy=ny/Math.sqrt(ny*ny+.08);
        const ux=(nx-dx*movement*.45)*.7+progress*.045,uy=(ny-dy*movement*.45)*.7-progress*.035;
        const n=sample(ux,uy),normalX=sample(ux,uy,normalsX),normalY=sample(ux,uy,normalsY);
        const light=Math.max(0,(-normalX*.45-normalY*.55+.7)/Math.hypot(normalX,normalY,1));
        const density=envelopeX[x]*envelopeY[y]*(.25+n*1.1)+cover;
        const alpha=smooth((density-.12)*2.7)*fade;
        // Soft top/side illumination, dark interiors and light through thin edges.
        const shade=188+light*58-Math.min(1,density)*8+(1-alpha)*15,index=(y*width+x)*4;
        pixels[index]=shade;pixels[index+1]=shade+5;pixels[index+2]=shade+8;pixels[index+3]=Math.round(alpha*255);
      }
    },
  };
}
