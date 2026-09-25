import type { SurfaceRect } from "../../contracts/studioPorts";
import { smooth, surfaceOpacity } from "./studioMotion";

export function beginSurfaceProjection(surface: HTMLElement, enter: boolean): void {
  surface.classList.add("studio-projecting");
  surface.style.opacity = enter ? "0" : "1";
}

export function updateSurfaceProjection(surface: HTMLElement, progress: number, rect: SurfaceRect): void {
  surface.style.opacity = String(surfaceOpacity(progress));
  const settle = smooth((progress - 0.8) / 0.2);
  const width = rect.width + (surface.clientWidth - rect.width) * settle;
  const height = rect.height + (surface.clientHeight - rect.height) * settle;
  surface.style.transform = `translate(${rect.left * (1 - settle)}px,${rect.top * (1 - settle)}px) scale(${Math.max(0.001, width / surface.clientWidth)},${Math.max(0.001, height / surface.clientHeight)})`;
}

export function clearSurfaceProjection(surface: HTMLElement): void {
  surface.classList.remove("studio-projecting");
  surface.style.removeProperty("transform");
  surface.style.removeProperty("opacity");
}
