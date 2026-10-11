/** Ground-level living groups around the office, game corner and landing. */
export const livingProps = {
  tea: {x:-2.94,z:-2.05,angle:.48},
  bench: {x:2.12,z:.53,angle:-1.05},
  blanketBasket: {x:1.84,z:1.55,angle:-.5},
  records: {x:-3.05,z:.98,angle:.62},
  stool: {x:-4.3,z:1.57,angle:.7},
  hammockTable: {x:-5.26,z:3.53,angle:.2},
  cushions: {x:-4.8,z:4.68,angle:-.4},
  loungeBasket: {x:-3.64,z:5.05,angle:-.22},
  firewood: {x:3.48,z:2.92,angle:-.5},
  pail: {x:4.35,z:3.55,angle:.2},
  fishing: {x:5.52,z:-.35,angle:-.22},
  rope: {x:6.02,z:1.02,angle:0},
} as const;
export const hammockLayout = {frontPalmSeed:53,rearPalmSeed:11,attachmentHeight:2.05,sag:1.12,width:1.58} as const;
export const livingPlanters = [
  {x:-1.45,z:-2.79,height:1.3,radius:.45,base:.37,seed:503},
  {x:.72,z:-3.02,height:.95,radius:.38,base:.28,seed:509},
  {x:4.23,z:-.32,height:1.12,radius:.48,base:.52,seed:521},
] as const;
export const livingFerns = [
  {x:-6.43,z:3.49,scale:.5,seed:541}, {x:-6.64,z:2.69,scale:.28,seed:547},
  {x:-5.7,z:4.92,scale:.32,seed:557}, {x:-5.59,z:4.37,scale:.24,seed:563},
  {x:5.01,z:1.04,scale:.4,seed:569}, {x:4.59,z:2.06,scale:.34,seed:571},
  {x:3.93,z:5.18,scale:.3,seed:577}, {x:5.57,z:4.43,scale:.3,seed:587},
  {x:-1.76,z:-3.63,scale:.46,seed:593}, {x:1.81,z:-2.63,scale:.38,seed:599},
] as const;
export const livingGrasses = [
  {x:-6.24,z:1.31,scale:.65,seed:607}, {x:-4.97,z:-3.1,scale:.7,seed:613},
  {x:4.59,z:-1.09,scale:.78,seed:617}, {x:5.48,z:2.54,scale:.4,seed:619},
  {x:4.65,z:5.23,scale:.4,seed:631},
] as const;
export const landingStones = [
  {x:4.64,z:4.38,angle:.22}, {x:5.13,z:3.7,angle:-.3},
  {x:5.56,z:3.03,angle:.08}, {x:5.87,z:2.35,angle:.2}, {x:5.83,z:1.64,angle:-.08},
] as const;
