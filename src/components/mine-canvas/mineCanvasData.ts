import type { MineCanvasDocument, MineCanvasEdge, MineCanvasNode, MineCanvasNodeData, MineCanvasNodeKind } from "./mineCanvasTypes";

const edgeStyle = {
  stroke: "#aebbd2",
  strokeDasharray: "5 8",
  strokeWidth: 1.6,
};

const edge = (id: string, source: string, target: string): MineCanvasEdge => ({
  id,
  source,
  target,
  type: "mineCurve",
  animated: false,
  style: edgeStyle,
  data: {},
});

const paragraph = (text: string) => `<p>${text}</p>`;

const sizeByKind: Record<MineCanvasNodeKind, { width: number; height: number }> = {
  text: { width: 260, height: 170 },
  image: { width: 300, height: 190 },
  quote: { width: 270, height: 132 },
  link: { width: 278, height: 156 },
  timeline: { width: 330, height: 460 },
};

const node = (id: string, position: MineCanvasNode["position"], data: MineCanvasNodeData): MineCanvasNode => ({
  id,
  type: "mine",
  position,
  style: {
    width: data.width,
    height: data.height,
  },
  data,
});

export const mineCanvasSeed: MineCanvasDocument = {
  version: 3,
  viewport: { x: 280, y: 54, zoom: 0.72 },
  nodes: [
    node("intro", { x: 90, y: 170 }, {
      kind: "text",
      title: "个人 OS",
      bodyHtml: paragraph("把个人网站做成一个可以探索、编辑和展示的系统。画布里的每张卡片都连接一个判断、项目或长期线索。"),
      heightMode: "auto",
      accent: "#002FA7",
      width: sizeByKind.text.width,
      height: sizeByKind.text.height,
      textStyle: {
        fontSize: 15,
        fontWeight: "medium",
        align: "left",
        color: "#242733",
      },
    }),
    node("timeline", { x: 440, y: 90 }, {
      kind: "timeline",
      title: "经历时间线",
      accent: "#3f79d8",
      width: sizeByKind.timeline.width,
      height: sizeByKind.timeline.height,
      items: [
        {
          id: "now",
          time: "2025.12 - 至今",
          title: "火星回响 - ListenHub & ColaOS",
          subtitle: "Agent Native 时代",
          color: "#ffd84b",
          hollow: false,
        },
        {
          id: "mcn",
          time: "2025",
          title: "AI行业MCN - 达人运营",
          subtitle: "三个月升至运营主管",
          color: "#3f79d8",
          hollow: true,
        },
        {
          id: "market",
          time: "2022 - 2024",
          title: "设计软件达人运营 -> 自酒行业运营/市场",
          subtitle: "深耕 marketing",
          color: "#3f79d8",
          hollow: true,
        },
        {
          id: "grad",
          time: "2018 - 2022",
          title: "米兰理工大学",
          subtitle: "Architecture & Urban Design 硕士",
          color: "#3f79d8",
          hollow: true,
        },
        {
          id: "undergrad",
          time: "2015 - 2019",
          title: "南京大学",
          subtitle: "建筑学本科",
          color: "#3f79d8",
          hollow: false,
        },
      ],
    }),
    node("quote", { x: 108, y: 490 }, {
      kind: "quote",
      title: "引用",
      contentHtml: paragraph("找到你喜欢的事，然后让它杀死你。"),
      author: "Charles Bukowski",
      accent: "#3f79d8",
      width: sizeByKind.quote.width,
      height: sizeByKind.quote.height,
    }),
    node("agent-native", { x: 850, y: 150 }, {
      kind: "text",
      title: "AI 伙伴",
      bodyHtml: paragraph("不是给旧流程加 AI，而是让流程天然能与 Agent 协作：梳理、建造、复盘都在同一个系统里发生。"),
      heightMode: "auto",
      accent: "#002FA7",
      width: sizeByKind.text.width,
      height: sizeByKind.text.height,
      textStyle: {
        fontSize: 14,
        fontWeight: "regular",
        align: "left",
        color: "#303441",
      },
    }),
    node("colaos", { x: 1160, y: 360 }, {
      kind: "link",
      title: "ColaOS",
      summary: "一个与个人 OS 相互映照的产品方向：把想法、内容和工具组织起来。",
      url: "https://colaos.zhoust.com",
      accent: "#002FA7",
      width: sizeByKind.link.width,
      height: sizeByKind.link.height,
    }),
    node("works", { x: 760, y: 430 }, {
      kind: "link",
      title: "作品集",
      summary: "FrameLean、FacileIM、ExercisesEagles 和 JustinWeb 正在组成一个持续进化的作品系统。",
      url: "/works",
      accent: "#4b5565",
      width: sizeByKind.link.width,
      height: sizeByKind.link.height,
    }),
    node("image-placeholder", { x: 1180, y: 92 }, {
      kind: "image",
      title: "现场照片",
      accent: "#6b7280",
      width: sizeByKind.image.width,
      height: sizeByKind.image.height,
      fileName: "点击选择图片",
      naturalRatio: 1.58,
    }),
  ],
  edges: [
    edge("intro-to-timeline", "intro", "timeline"),
    edge("timeline-to-agent", "timeline", "agent-native"),
    edge("timeline-to-works", "timeline", "works"),
    edge("agent-to-colaos", "agent-native", "colaos"),
    edge("quote-to-intro", "quote", "intro"),
    edge("works-to-colaos", "works", "colaos"),
  ],
};
