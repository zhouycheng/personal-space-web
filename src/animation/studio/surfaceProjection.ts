import type { SurfaceRect } from "../../contracts/studioPorts";
import { smooth, surfaceOpacity } from "./studioMotion";
const sizes=new WeakMap<HTMLElement,{width:number;height:number;observer:ResizeObserver}>();

export function beginSurfaceProjection(surface: HTMLElement, enter: boolean): void {
  surface.classList.add("studio-projecting");
  sizes.get(surface)?.observer.disconnect();
  const state={width:Math.max(1,surface.clientWidth),height:Math.max(1,surface.clientHeight),observer:new ResizeObserver(()=>{
    state.width=Math.max(1,surface.clientWidth);state.height=Math.max(1,surface.clientHeight);
  })};
  state.observer.observe(surface);sizes.set(surface,state);
  surface.style.opacity = enter ? "0" : "1";
}

export function updateSurfaceProjection(surface: HTMLElement, progress: number, rect: SurfaceRect): void {
  const size=sizes.get(surface)??{width:Math.max(1,surface.clientWidth),height:Math.max(1,surface.clientHeight)};
  surface.style.opacity = String(surfaceOpacity(progress));
  const settle = smooth((progress - 0.8) / 0.2);
  const width = rect.width + (size.width - rect.width) * settle;
  const height = rect.height + (size.height - rect.height) * settle;
  surface.style.transform = `translate(${rect.left * (1 - settle)}px,${rect.top * (1 - settle)}px) scale(${Math.max(0.001, width / size.width)},${Math.max(0.001, height / size.height)})`;
}

export function clearSurfaceProjection(surface: HTMLElement): void {
  sizes.get(surface)?.observer.disconnect();sizes.delete(surface);
  surface.classList.remove("studio-projecting");
  surface.style.removeProperty("transform");
  surface.style.removeProperty("opacity");
}
