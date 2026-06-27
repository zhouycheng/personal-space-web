import { useLayoutEffect, useRef, type RefObject } from "react";

export function useMeasuredNodeHeight(
  elementRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  onMeasure: (height: number) => void,
) {
  const onMeasureRef = useRef(onMeasure);
  const frameRef = useRef<number | null>(null);
  const previousHeightRef = useRef(0);

  onMeasureRef.current = onMeasure;

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    const measure = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const height = Math.ceil(element.scrollHeight);
        if (Math.abs(previousHeightRef.current - height) < 1) return;
        previousHeightRef.current = height;
        onMeasureRef.current(height);
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [elementRef, enabled]);
}
