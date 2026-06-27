import type { ComponentType, RefObject } from "react";
import type { MineCanvasNodeData, MineCanvasNodeKind } from "../../components/mine-canvas/mineCanvasTypes";

export interface CardRenderProps {
  data: MineCanvasNodeData;
  nodeId: string;
  contentRef?: RefObject<HTMLDivElement | null>;
  update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void;
}

export interface CardDefinition {
  kind: MineCanvasNodeKind;
  label: string;
  accent: string;
  defaultSize: { width: number; height: number };
  icon: ComponentType<{ size?: number }>;
  createDefaultData: () => MineCanvasNodeData;
  Component: ComponentType<CardRenderProps>;
  authorOnly?: boolean;
}

export interface CreateOption {
  kind: MineCanvasNodeKind;
  icon: ComponentType<{ size?: number }>;
  label: string;
  authorOnly?: boolean;
}

const registry = new Map<MineCanvasNodeKind, CardDefinition>();

export function registerCard(def: CardDefinition): void {
  if (registry.has(def.kind)) {
    console.warn(`Card kind "${def.kind}" is already registered, overwriting.`);
  }
  registry.set(def.kind, def);
}

export function getCard(kind: MineCanvasNodeKind): CardDefinition | undefined {
  return registry.get(kind);
}

export function getAllCards(): CardDefinition[] {
  return Array.from(registry.values());
}

export function getCreateOptions(): CreateOption[] {
  return getAllCards().map(({ kind, icon, label, authorOnly }) => ({
    kind,
    icon,
    label,
    authorOnly,
  }));
}
