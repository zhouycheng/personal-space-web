export function readOceanAudioPreferences():{enabled:boolean;volume:number} {
  try {
    const value=JSON.parse(localStorage.getItem('justin-ocean-audio')??'{}');
    return {enabled:typeof value?.enabled==='boolean'?value.enabled:true,
      volume:typeof value?.volume==='number'&&Number.isFinite(value.volume)?Math.max(0,Math.min(1,value.volume)):.2};
  } catch {return {enabled:true,volume:.2};}
}
export function saveOceanAudioPreferences(enabled:boolean,volume:number) {
  try {localStorage.setItem('justin-ocean-audio',JSON.stringify({enabled,volume}));}catch {/* Audio remains usable without storage. */}
}
