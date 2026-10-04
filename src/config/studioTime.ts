import {getPosition,getMoonPosition,getMoonIllumination} from 'suncalc';
import type { StudioLighting } from '../contracts/studioPorts';

export const clockText = (date:Date, showDate = false) => (showDate ? [date.getMonth()+1,date.getDate()] : [date.getHours(),date.getMinutes()]).map(value=>String(value).padStart(2,'0')).join(showDate ? '.' : ':');

// Fixed observatory: Shanghai. Never request visitor location or infer it from time zone.
export const studioObservatory={latitude:31.2304,longitude:121.4737};
const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
/** SunCalc 2 uses degrees clockwise from north; desk north=-Z, east=+X. */
export function celestialDirection(azimuth:number,altitude:number):readonly [number,number,number] {
  const a=azimuth*Math.PI/180,h=altitude*Math.PI/180;
  return [Math.sin(a)*Math.cos(h),Math.sin(h),-Math.cos(a)*Math.cos(h)];
}
export function studioLighting(date=new Date(),observer=studioObservatory) {
  const solar=getPosition(date,observer.latitude,observer.longitude);
  const lunar=getMoonPosition(date,observer.latitude,observer.longitude);
  const illumination=getMoonIllumination(date);
  const daylight=smooth(-6,16,solar.altitude),daylightPower=daylight*daylight;
  const sunset=(1-smooth(0,22,solar.altitude))*smooth(-7,0,solar.altitude);
  const blend=(from:number,to:number,t:number)=>[16,8,0].reduce((color,shift)=>color|Math.round(((from>>shift)&255)*(1-t)+((to>>shift)&255)*t)<<shift,0);
  const sunDirection=celestialDirection(solar.azimuth,solar.altitude);
  const moonDirection=celestialDirection(lunar.azimuth,lunar.altitude);
  return {
    daylight,
    background:`#${blend(0x05070b,0xe7e3dc,daylight).toString(16).padStart(6,'0')}`,
    foreground:daylight<.35?'#e5e1d8':'#393632',
    sky:blend(0x172e59,0xe6e7e4,daylight),
    sun:blend(0xfff8ed,0xffac60,sunset),
    sunIntensity:2.5*daylightPower*smooth(-.5,2,solar.altitude),
    moonIntensity:.16*illumination.fraction*smooth(0,12,lunar.altitude)*(1-daylight),
    ambientIntensity:.18+daylight,
    lampIntensity:7-5.8*daylightPower,
    screenSpillIntensity:.08*(1-daylight)**2,
    sunDirection,moonDirection,
    zenith:blend(0x101c39,0x227ec2,daylight),
    horizon:blend(blend(0x24344e,0x8ecde8,daylight),0xe6ad84,sunset*Math.sqrt(daylight)),
    sunset,
  } satisfies StudioLighting;
}
