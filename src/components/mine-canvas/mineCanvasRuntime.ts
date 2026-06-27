import type { Editor } from "@tiptap/react";
import { createContext } from "react";
import type { MineCanvasFont } from "./mineCanvasFonts";
import type { MineCanvasNodeData } from "./mineCanvasTypes";
import type { CanvasControlOffset } from "./mineCanvasGeometry";

export type BeginMineCanvasEditOptions = {
  fieldKey: string;
  timelineItemId?: string;
};

export type MineCanvasRuntime = {
  activeEditor: Editor | null;
  isAuthor: boolean;
  activeLinkNodeId: string;
  activeTimelineItemId: string;
  editingFieldKey: string;
  editingNodeId: string;
  fonts: MineCanvasFont[];
  beginEditing: (nodeId: string, options: BeginMineCanvasEditOptions) => void;
  deleteNode: (nodeId: string) => void;
  finishEditing: () => void;
  registerActiveEditor: (nodeId: string, editor: Editor | null) => void;
  reportNodeHeight: (nodeId: string, measuredHeight: number, minimumHeight: number) => void;
  requestImageFile: (nodeId: string) => void;
  setActiveLinkNodeId: (nodeId: string) => void;
  setActiveTimelineItemId: (itemId: string) => void;
  updateNodeData: (nodeId: string, updater: (data: MineCanvasNodeData) => MineCanvasNodeData) => void;
  updateNodeSize: (nodeId: string, width: number, height: number) => void;
  updateEdgeControl: (edgeId: string, field: "sourceControl" | "targetControl", offset: CanvasControlOffset) => void;
};

export const MineCanvasRuntimeContext = createContext<MineCanvasRuntime | null>(null);
