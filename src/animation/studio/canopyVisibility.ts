const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

/** The roof belongs in the island overview, but clears the desk inspection area
 * even at eye level. Distance, rather than a far-away sightline, owns visibility. */
export function canopyDistanceOpacity(camera:readonly number[]) {
  return smooth((Math.hypot(camera[0]+.1,camera[1]-1.43,camera[2]+1.25)-7)/4);
}

export function fadeCanopyOpacity(current:number,target:number,elapsed:number,reduced=false) {
  if(reduced)return target;
  const next=current+(target-current)*(1-Math.exp(-Math.max(0,Math.min(50,elapsed))/(target<current?180:300)));
  return Math.abs(next-target)<.001?target:next;
}
