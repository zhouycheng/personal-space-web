export function readMusicPreferences(): { id?: string; volume: number } {
  try {
    const value = JSON.parse(localStorage.getItem('justin-music') ?? '{}');
    return { id: typeof value.id === 'string' ? value.id : undefined, volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.max(0, Math.min(1, value.volume)) : .35 };
  } catch { return { volume: .35 }; }
}
export function saveMusicPreferences(id: string | undefined, volume: number) {
  try { localStorage.setItem('justin-music', JSON.stringify({ id, volume })); } catch { /* Playback also works without storage. */ }
}
