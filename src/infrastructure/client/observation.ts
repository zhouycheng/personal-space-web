import type { Observation, RegionId } from '../../contracts/environment';
import { isRegion, observatories, validObserver } from '../../config/observatories.ts';

export const REGION_KEY='justin-sky-region', LOCATION_KEY='justin-sky-location';
export const LOCATION_TTL=24*60*60*1000;
type StorageAccess = () => Pick<Storage,'getItem'|'removeItem'>;
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
