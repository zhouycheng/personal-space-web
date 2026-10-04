import type { Observation, RegionId } from '../../contracts/environment';
import { isRegion, observatories, validObserver } from '../../config/observatories.ts';

export const REGION_KEY='justin-sky-region', LOCATION_KEY='justin-sky-location';
export const LOCATION_TTL=24*60*60*1000;
type StorageAccess = () => Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const local:StorageAccess=()=>localStorage, session:StorageAccess=()=>sessionStorage;
export function regionObservation(region:RegionId):Observation {
  const {latitude,longitude}=observatories[region];
  return {latitude,longitude,region,source:'region'};
}
export function readObservation(now=Date.now(), localAccess=local, sessionAccess=session):Observation {
  let region:RegionId='east';
  try {const value=localAccess().getItem(REGION_KEY);if(isRegion(value))region=value;}catch {}
  try {
    const saved=JSON.parse(sessionAccess().getItem(LOCATION_KEY)??'null');
    const acquiredAt=saved?.acquiredAt;
    if(validObserver(saved)&&typeof acquiredAt==='number'&&now>=acquiredAt&&now-acquiredAt<LOCATION_TTL)
      return {latitude:saved.latitude,longitude:saved.longitude,acquiredAt,region,source:'location'};
    sessionAccess().removeItem(LOCATION_KEY);
  }catch {}
  return regionObservation(region);
}
export function saveRegion(region:RegionId, localAccess=local, sessionAccess=session) {
  try{localAccess().setItem(REGION_KEY,region);}catch {}
  try{sessionAccess().removeItem(LOCATION_KEY);}catch {}
}
export function saveLocation(observation:Observation, sessionAccess=session) {
  try{sessionAccess().setItem(LOCATION_KEY,JSON.stringify({latitude:observation.latitude,longitude:observation.longitude,acquiredAt:observation.acquiredAt}));}catch {}
}
/** No permission request occurs until the caller explicitly invokes this function. */
export function locate(geolocation:Pick<Geolocation,'getCurrentPosition'>|undefined, signal:AbortSignal):Promise<{latitude:number;longitude:number}> {
  return new Promise((resolve,reject)=>{
    if(!geolocation){reject(new Error('此浏览器无法定位，请选择代表地区。'));return;}
    if(signal.aborted){reject(new Error('定位已取消'));return;}
    let settled=false;
    const finish=(error?:Error,coords?:{latitude:number;longitude:number})=>{
      if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
      if(error)reject(error);else resolve(coords!);
    };
    const abort=()=>finish(new Error('定位已取消'));
    const timer=setTimeout(()=>finish(new Error('定位超时，请重试或选择代表地区。')),8000);
    signal.addEventListener('abort',abort,{once:true});
    try{geolocation.getCurrentPosition(position=>{
      const {latitude,longitude}=position.coords;
      if(!validObserver({latitude,longitude}))finish(new Error('无法读取位置，请选择代表地区。'));
      else finish(undefined,{latitude,longitude});
    },error=>finish(new Error(error.code===1?'未获得定位授权，继续使用当前地区。':error.code===3?'定位超时，请重试或选择代表地区。':'暂时无法定位，请重试或选择代表地区。')),{enableHighAccuracy:false,timeout:8000,maximumAge:0});}
    catch{finish(new Error('此环境无法定位，请选择代表地区。'));}
  });
}
