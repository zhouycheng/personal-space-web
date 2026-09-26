import * as THREE from 'three';
import { ACTION_LABELS, type StudioAction } from '../../../contracts/studio';

type Options = {
  canvas: HTMLCanvasElement; mount: HTMLElement; tooltip: HTMLElement;
  bounds(): DOMRect; requestDraw(): void; signal: AbortSignal;
};

/** One bounded clone per original material; the scene keeps ownership of originals. */
export function createStudioHover({ canvas, mount, tooltip, bounds, requestDraw, signal }: Options) {
  const cache = new Map<THREE.Material, THREE.Material>();
  const highlighted: { mesh: THREE.Mesh; original: THREE.Material | THREE.Material[] }[] = [];
  let target: THREE.Group | undefined, label = '', tooltipWidth = 0, tooltipHeight = 0;
  let materialCreated = 0, materialDisposed = 0;
  function reportMaterials() {
    mount.dataset.hoverMaterialCreated = String(materialCreated);
    mount.dataset.hoverMaterialDisposed = String(materialDisposed);
  }
  function clear() {
    for (const item of highlighted) item.mesh.material = item.original;
    if (highlighted.length) requestDraw();
    highlighted.length = 0; target = undefined; label = '';
    tooltip.hidden = true; canvas.style.cursor = 'grab'; reportMaterials();
  }
  function glow(original: THREE.Material) {
    let material = cache.get(original);
    if (!material) {
      material = original.clone(); cache.set(original, material); materialCreated++;
    } else material.copy(original);
    // Original lamp colors and textures can change between hover visits.
    if (material instanceof THREE.MeshStandardMaterial && original instanceof THREE.MeshStandardMaterial && original.emissive.getHex() === 0) {
      material.emissive.copy(original.color); material.emissiveIntensity = .06;
    }
    material.needsUpdate = true;
    return material;
  }
  function highlight(group: THREE.Group | undefined) {
    target = group;
    group?.traverse(object => {
      if (!(object instanceof THREE.Mesh) || object.userData.hitProxy) return;
      const original = object.material;
      highlighted.push({ mesh: object, original });
      object.material = Array.isArray(original) ? original.map(glow) : glow(original);
    });
    reportMaterials(); requestDraw();
  }
  function show(group: THREE.Group | undefined, x: number, y: number) {
    if (group !== target) { clear(); highlight(group); }
    if (!target) return;
    const next = target.userData.label ?? ACTION_LABELS[target.userData.action as StudioAction];
    if (next !== label || tooltip.hidden) {
      label = next; tooltip.textContent = next; tooltip.hidden = false;
      tooltipWidth = tooltip.offsetWidth;
      tooltipHeight = tooltip.offsetHeight;
    }
    const rect = bounds();
    const pointerX = x - rect.left, pointerY = y - rect.top;
    const left = Math.max(8, Math.min(rect.width - tooltipWidth - 8, pointerX + 7 - tooltipWidth / 2));
    const below = pointerY + 24;
    const top = Math.max(8, below + tooltipHeight <= rect.height - 8 ? below : pointerY - tooltipHeight - 12);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    canvas.style.cursor = target.userData.action ? 'pointer' : 'help';
  }
  signal.addEventListener('abort', () => {
    clear();
    for (const material of cache.values()) {
      try { material.dispose(); materialDisposed++; } catch (error) { console.error('Hover material cleanup failed', error); }
    }
    cache.clear(); reportMaterials();
  }, { once: true });
  return { clear, highlight, show, get target() { return target; } };
}
