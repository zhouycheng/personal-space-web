export type FileGesture = {
  id: string | undefined;
  pointerId: number;
  x: number;
  y: number;
  scrollLeft: number;
  moved: boolean;
  ended: boolean;
};

export function snapFileIndex(current: number, displacement: number, stride: number, count: number) {
  const step = stride > 0 && Math.abs(displacement) >= stride * 0.25 ? Math.sign(displacement) : 0;
  return Math.max(0, Math.min(count - 1, current + step));
}

export function canOpenFile(gesture: FileGesture | null, id: string, event: { detail: number; pointerId?: number }) {
  // Keyboard and assistive activation have no pointer sequence.
  if (event.detail === 0) return true;
  return !!gesture && gesture.id === id && gesture.ended && !gesture.moved &&
    (event.pointerId === undefined || event.pointerId === gesture.pointerId);
}
