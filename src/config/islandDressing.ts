/** Fixed layout: ornaments move to clear furniture and guy ropes, never vice versa. */
export const dressingPlants = [
  {x:-3.9,z:-3.0,height:1.9,radius:.7,seed:151},
  {x:-.8,z:-3.6,height:2.15,radius:.85,seed:163},
  {x:3.9,z:-3.0,height:2.05,radius:.7,seed:179},
  {x:1.25,z:-3.65,height:1.7,radius:.65,seed:281},
  {x:-1.6,z:-4.45,height:2.3,radius:.8,seed:283},
  {x:3.95,z:-2.1,height:1.15,radius:.52,seed:293},
  {x:4.75,z:2.9,height:1.5,radius:.55,seed:359},
  {x:3.9,z:3.65,height:1.05,radius:.48,seed:367},
  {x:-5.45,z:2.75,height:1.45,radius:.5,seed:373},
  {x:-4.75,z:1.25,height:1.2,radius:.47,seed:379},
] as const;
export const dressingFerns = [
  {x:-4.5,z:-2.8,scale:.5,seed:181}, {x:-2.1,z:-4.3,scale:.46,seed:191},
  {x:.65,z:-4.2,scale:.5,seed:193}, {x:2.1,z:-4.35,scale:.43,seed:197},
  {x:4.7,z:-2.8,scale:.48,seed:199}, {x:4.6,z:.35,scale:.42,seed:211},
  {x:-3.8,z:2.5,scale:.48,seed:223},
  {x:-3.65,z:-2.65,scale:.36,seed:301}, {x:-3.9,z:-.35,scale:.35,seed:307},
  {x:3.8,z:-.9,scale:.32,seed:311}, {x:4.15,z:.7,scale:.34,seed:313},
  {x:-.15,z:-3.25,scale:.43,seed:317}, {x:1.6,z:-3.4,scale:.33,seed:331},
] as const;
export const dressingProps = {
  suitcase:{x:-3.32,z:-1.65,width:1.05,depth:.64,height:.47,angle:-.28,seed:227},
  backpack:{x:-3.55,z:-2.45,width:.55,depth:.38,height:.76,angle:.35,seed:229},
  cabinet:{x:2.8,z:-1.85,width:1.26,depth:.64,height:2.05,angle:-.16,seed:233},
  sideTable:{x:2.95,z:-.2,width:.76,depth:.68,height:.65,angle:.34,seed:239},
  supplyCrate:{x:-3.15,z:-.3,width:.88,depth:.66,height:1.32,angle:.22,seed:241},
  basket:{x:3.5,z:-1.05,width:.55,depth:.52,height:.43,angle:-.34,seed:243},
  lowCase:{x:-3.8,z:.45,width:.68,depth:.48,height:.34,angle:-.24,seed:347},
  bookCrate:{x:3.75,z:.3,width:.74,depth:.5,height:.48,angle:.32,seed:349},
} as const;
const midRocks=[[-4.85,-2.3,.37,.29,.4],[-5.1,-1.65,.27,.23,.3],[-4.95,-.95,.2,.18,.22],
  [4.95,-1.4,.34,.27,.37],[5.15,-.5,.26,.22,.3],[4.85,.5,.2,.17,.23]];
const smallRocks=[[-3.98,2.27,.12,.09,.12],[-3.65,2.66,.09,.075,.1],[-2.95,2.44,.085,.07,.09],[-3.9,1.9,.075,.065,.08]];
export const dressingRocks=[...midRocks,...smallRocks,...Array.from({length:18},(_,i)=>{
  const side=i<9?-1:1,t=i%9,a=t*2.39996+.7,r=.15+(t%4)*.14;
  return [side*(4.85+Math.cos(a)*r),-.8+Math.sin(a)*r,.04+(t%3)*.025,.035+(t%2)*.02,.055+(t%3)*.022];
})].map(([x,z,width,depth,height],i)=>({x,z,width,depth,height,rotation:i*1.73,seed:251+i,burial:1/3}));

export const dressingFootprints=[
  ...Object.values(dressingProps).map(p=>({x:p.x,z:p.z,radius:Math.hypot(p.width,p.depth)/2})),
  ...dressingPlants.map(p=>({x:p.x,z:p.z,radius:p.radius})),
  ...dressingFerns.map(p=>({x:p.x,z:p.z,radius:p.scale*1.5})),
  ...dressingRocks.map(p=>({x:p.x,z:p.z,radius:Math.hypot(p.width,p.depth)*1.16})),
];
