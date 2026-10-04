import { getPosition, getMoonPosition, getMoonIllumination } from 'suncalc';
import type { DayPhase, EnvironmentSnapshot, Observer, RGB } from '../contracts/environment';
import { observatories } from './observatories.ts';

export const clockText = (date:Date, showDate = false) => (showDate ? [date.getMonth()+1,date.getDate()] : [date.getHours(),date.getMinutes()]).map(value=>String(value).padStart(2,'0')).join(showDate ? '.' : ':');
export const studioObservatory: Observer = observatories.east;
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const rgb=(hex:number):RGB=>[hex>>16&255,hex>>8&255,hex&255];
const mix=(a:RGB,b:RGB,t:number):RGB=>a.map((v,i)=>Math.round(v+(b[i]-v)*t)) as unknown as RGB;
const hex=(color:RGB)=>color.reduce((n,v)=>(n<<8)|v,0);
const blend=(a:number,b:number,t:number)=>hex(mix(rgb(a),rgb(b),t));
const css=(color:number)=>`#${color.toString(16).padStart(6,'0')}`;

/** SunCalc 2 uses degrees clockwise from north; desk north=-Z, east=+X. */
export function celestialDirection(azimuth:number,altitude:number):readonly [number,number,number] {
  const a=azimuth*Math.PI/180,h=altitude*Math.PI/180;
  return [Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)];
}

// Zenith, horizon, ambient and cloud colors. Altitude drives the stops;
// morning and evening branches meet continuously at noon and nadir.
const stops = [
  { altitude:-18, morning:[0x091225,0x14233d,0x647899,0x1c283d], evening:[0x091225,0x14233d,0x647899,0x1c283d] },
  { altitude:-12, morning:[0x14274a,0x394867,0x7182a0,0x37445d], evening:[0x152340,0x3d3d58,0x7b819b,0x3d4055] },
  { altitude:-6, morning:[0x294776,0xc3949e,0xb0a6b5,0x827e95], evening:[0x283451,0xc78569,0xb2a09e,0x8a7884] },
  { altitude:0, morning:[0x487caf,0xf5cba0,0xe8ccc0,0xc4b5b0], evening:[0x496b99,0xffc767,0xf1c598,0xc7aa88] },
  { altitude:6, morning:[0x438bc3,0xf8ddac,0xf5e3ca,0xe1d5bd], evening:[0x4083b4,0xffd477,0xffdfa6,0xe6ce9f] },
  { altitude:18, morning:[0x287fb9,0xb5dbea,0xe4eaf0,0xc8dbe3], evening:[0x2d80b9,0xf0d6ac,0xf5e4c9,0xded4bd] },
  { altitude:45, morning:[0x1975b6,0x9ccfe8,0xe4edf4,0xcddfe7], evening:[0x1975b6,0x9ccfe8,0xe4edf4,0xcddfe7] },
  { altitude:90, morning:[0x126bae,0x8bc7e5,0xebf2f7,0xd9e5eb], evening:[0x126bae,0x8bc7e5,0xebf2f7,0xd9e5eb] },
] as const;

export function environmentAt(date = new Date(), observer: Observer = studioObservatory): EnvironmentSnapshot {
  const solar=getPosition(date,observer.latitude,observer.longitude);
  const lunar=getMoonPosition(date,observer.latitude,observer.longitude);
  const illumination=getMoonIllumination(date);
  const h=solar.altitude;
  const slope=getPosition(new Date(date.getTime()-30*60_000),observer.latitude,observer.longitude).altitude
    -getPosition(new Date(date.getTime()+30*60_000),observer.latitude,observer.longitude).altitude;
  const ascending=slope<=0, evening=smooth(-2,2,slope);
  let index=0;
  while(index<stops.length-2&&h>stops[index+1].altitude)index++;
  const a=stops[index],b=stops[index+1],t=smooth(a.altitude,b.altitude,h);
  const colors=a.morning.map((_,i)=>blend(blend(a.morning[i],a.evening[i],evening),blend(b.morning[i],b.evening[i],evening),t));
  const [zenith,horizon,sky,mist]=colors;
  const daylight=smooth(-12,24,h),daylightPower=daylight*daylight;
  const golden=(1-smooth(6,24,h))*smooth(-8,0,h);
  const sun=blend(0xfff8ed,blend(0xffd6a0,0xffcf69,evening),golden);
  const phase:DayPhase=h< -18?'night':h< -12?(ascending?'predawn':'night'):h< -6?(ascending?'predawn':'twilight'):h<0?(ascending?'dawn':'twilight'):h<6?(ascending?'sunrise':'sunset'):h<18?(ascending?'morning':'sunset'):Math.abs(slope)<3?'noon':ascending?'morning':'afternoon';
  const mistLuma=rgb(mist).reduce((sum,value,i)=>sum+value*[.2126,.7152,.0722][i],0);
  const foreground=mistLuma<130?0xf4eee5:0x172535;
  const lighting={
    daylight, background:css(mist), foreground:css(foreground), sky, sun,
    sunIntensity:2.5*daylightPower*smooth(0,4,h),
    moonIntensity:.2*illumination.fraction*smooth(0,12,lunar.altitude)*(1-daylight),
    ambientIntensity:.23+daylight*.95,
    lampIntensity:7-5.8*daylightPower, screenSpillIntensity:.08*(1-daylight)**2,
    sunDirection:celestialDirection(solar.azimuth,h),moonDirection:celestialDirection(lunar.azimuth,lunar.altitude),
    zenith,horizon,sunset:golden,
  };
  return { timestamp:date.getTime(),observer,phase,solarAltitude:h,lunarAltitude:lunar.altitude,moonFraction:illumination.fraction,lighting,
    palette:{ background:rgb(mist),foreground:rgb(foreground),mist:rgb(mist),
      mistLight:rgb(blend(mist,sun,.22+.12*daylight)),mistShadow:rgb(blend(mist,zenith,.55)),
      cloud:rgb(blend(mist,horizon,.18)),titleShadow:rgb(blend(zenith,0x07101d,.45)),
      progress:rgb(foreground),progressPending:rgb(blend(mist,foreground,.65)),focus:rgb(foreground) },
  };
}
export function studioLighting(date = new Date(), observer: Observer = studioObservatory) {
  return environmentAt(date,observer).lighting;
}
