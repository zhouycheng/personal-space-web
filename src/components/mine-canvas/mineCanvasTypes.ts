import type { Edge, Node, Viewport } from "@xyflow/react";

export type MineCanvasNodeKind = "text" | "image" | "quote" | "link" | "timeline" | "monitor" | "businesscard";

export type MineCanvasTextStyle = {
  fontSize: number;
  fontWeight: "regular" | "medium" | "bold";
  align: "left" | "center" | "right";
  color: string;
};

export type MineCanvasTimelineItem = {
  id: string;
  time: string;
  title: string;
  subtitle: string;
  color: string;
  hollow: boolean;
};

type MineCanvasNodeCommon = {
  kind: MineCanvasNodeKind;
  title: string;
  accent: string;
  width: number;
  height: number;
};

export type MineCanvasTextNodeData = MineCanvasNodeCommon & {
  kind: "text";
  bodyHtml: string;
  heightMode: "auto" | "manual";
  textStyle?: MineCanvasTextStyle;
} & Record<string, unknown>;

export type MineCanvasImageNodeData = MineCanvasNodeCommon & {
  kind: "image";
  src?: string;
  fileName?: string;
  naturalRatio?: number;
} & Record<string, unknown>;

export type MineCanvasQuoteNodeData = MineCanvasNodeCommon & {
  kind: "quote";
  contentHtml: string;
  author: string;
} & Record<string, unknown>;

export type MineCanvasLinkNodeData = MineCanvasNodeCommon & {
  kind: "link";
  summary: string;
  url: string;
} & Record<string, unknown>;

export type MineCanvasTimelineNodeData = MineCanvasNodeCommon & {
  kind: "timeline";
  items: MineCanvasTimelineItem[];
} & Record<string, unknown>;

export type MineCanvasMonitorNodeData = MineCanvasNodeCommon & {
  kind: "monitor";
} & Record<string, unknown>;

export type MineCanvasBusinessCardNodeData = MineCanvasNodeCommon & {
  kind: "businesscard";
  avatarSrc?: string;
  avatarFileName?: string;
  name: string;
  intro: string;
  tags: string[];
} & Record<string, unknown>;

export type MineCanvasNodeData =
  | MineCanvasTextNodeData
  | MineCanvasImageNodeData
  | MineCanvasQuoteNodeData
  | MineCanvasLinkNodeData
  | MineCanvasTimelineNodeData
  | MineCanvasMonitorNodeData
  | MineCanvasBusinessCardNodeData;

export type MineCanvasEdgeData = {
  sourceControl?: {
    dx: number;
    dy: number;
  };
  targetControl?: {
    dx: number;
    dy: number;
  };
  control?: {
    x: number;
    y: number;
  };
} & Record<string, unknown>;

export type MineCanvasNode = Node<MineCanvasNodeData, "mine">;
export type MineCanvasEdge = Edge<MineCanvasEdgeData, "default" | "smoothstep" | "mineCurve">;

export type MineCanvasDocument = {
  version: 3;
  nodes: MineCanvasNode[];
  edges: MineCanvasEdge[];
  viewport: Viewport;
};
