import type { Edge, Node } from "@xyflow/react";
import type { MineCanvasEdgeData, MineCanvasNodeData } from "../../../contracts/canvas";

export type FlowNode = Node<MineCanvasNodeData, "mine">;
export type FlowEdge = Edge<MineCanvasEdgeData, "default" | "smoothstep" | "mineCurve">;
