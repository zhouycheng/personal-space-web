export type KitCategory = "HTML" | "JS Motion" | "Design" | "Flutter";

export type KitItem = {
  id: string;
  category: KitCategory;
  title: string;
  summary: string;
  status: "extracted" | "planned";
  tags: string[];
  sourcePath: string;
  preview: {
    label: string;
    kind: "cursor-reveal" | "activity-status" | "symbol-dome" | "design-system" | "flutter-card";
  };
};

export const KIT_CATEGORIES: KitCategory[] = [
  "HTML",
  "JS Motion",
  "Design",
  "Flutter",
];

export const KIT_ITEMS: KitItem[] = [
  {
    id: "cursor-reveal-hero",
    category: "HTML",
    title: "Cursor Reveal Hero",
    summary: "首页圆形光标遮罩效果，黑白双层 Hero 在鼠标下互相显影。",
    status: "extracted",
    tags: ["mask", "clip-path", "hero"],
    sourcePath: "src/justin-kit/components/cursor-reveal-hero",
    preview: {
      label: "试用遮罩",
      kind: "cursor-reveal",
    },
  },
  {
    id: "local-activity-status",
    category: "JS Motion",
    title: "Local Activity Status",
    summary: "macOS 前台窗口监听，通过本地脚本、API 与 SSE 显示实时状态。",
    status: "extracted",
    tags: ["SSE", "macOS", "local"],
    sourcePath: "src/justin-kit/components/local-activity-status",
    preview: {
      label: "查看状态",
      kind: "activity-status",
    },
  },
  {
    id: "symbol-dome-background",
    category: "JS Motion",
    title: "Symbol Dome Background",
    summary: "Justin OS 桌面背景的单面符号半球，使用 %、x 和 # 采样点缓慢右转。",
    status: "extracted",
    tags: ["canvas", "background", "motion"],
    sourcePath: "src/justin-kit/components/symbol-dome-background",
    preview: {
      label: "查看半球",
      kind: "symbol-dome",
    },
  },
  {
    id: "justin-brand-dna",
    category: "Design",
    title: "Justin Brand DNA",
    summary: "Justin OS 的纯克莱因蓝主题、终端动效、布局规则和视觉禁忌清单。",
    status: "planned",
    tags: ["tokens", "layout", "taste"],
    sourcePath: "src/justin-kit/design",
    preview: {
      label: "看规范",
      kind: "design-system",
    },
  },
  {
    id: "flutter-status-chip",
    category: "Flutter",
    title: "Flutter Status Chip",
    summary: "为桌面工具和移动端 App 准备的可复制状态徽章组件。",
    status: "planned",
    tags: ["Dart", "widget", "copyable"],
    sourcePath: "src/justin-kit/flutter/status-chip",
    preview: {
      label: "预览组件",
      kind: "flutter-card",
    },
  },
];
