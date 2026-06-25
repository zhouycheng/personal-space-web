type Locale = "zh" | "en";

const ACTIVITY_ENTRIES = [
  {
    aliases: ["cursor"],
    text: {
      zh: "正在用 Cursor 写代码",
      en: "Coding in Cursor",
    },
  },
  {
    aliases: ["codex"],
    text: {
      zh: "正在用 Codex 协作开发",
      en: "Working with Codex",
    },
  },
  {
    aliases: ["kiro"],
    text: {
      zh: "正在用 Kiro 工作",
      en: "Working in Kiro",
    },
  },
  {
    aliases: ["safari", "safari浏览器", "google chrome", "chrome"],
    text: {
      zh: "正在查资料",
      en: "Researching",
    },
  },
  {
    aliases: ["微信"],
    text: {
      zh: "正在处理微信消息",
      en: "Replying in WeChat",
    },
  },
  {
    aliases: ["微信开发者工具", "wechat devtools", "wechat developer tools"],
    text: {
      zh: "正在调试小程序",
      en: "Debugging a mini program",
    },
  },
  {
    aliases: ["android studio"],
    text: {
      zh: "正在用 Android Studio 开发",
      en: "Building in Android Studio",
    },
  },
  {
    aliases: ["语雀"],
    text: {
      zh: "正在更新语雀文档",
      en: "Updating Yuque docs",
    },
  },
  {
    aliases: ["滴答清单", "ticktick"],
    text: {
      zh: "正在整理滴答清单",
      en: "Organizing TickTick",
    },
  },
  {
    aliases: ["xcode"],
    text: {
      zh: "正在用 Xcode 开发 iOS",
      en: "Building iOS in Xcode",
    },
  },
  {
    aliases: ["figma"],
    text: {
      zh: "正在用 Figma 设计界面",
      en: "Designing in Figma",
    },
  },
  {
    aliases: ["iterm2", "ghostty"],
    text: {
      zh: "正在使用终端",
      en: "Working in terminal",
    },
  },
  {
    aliases: ["webstorm"],
    text: {
      zh: "正在用 WebStorm 开发网页",
      en: "Developing web in WebStorm",
    },
  },
  {
    aliases: ["intellij idea"],
    text: {
      zh: "正在写后端代码",
      en: "Writing backend code",
    },
  },
] as const;

function normalizeAppName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveActivityText(appName: string, locale: Locale = "zh"): string | null {
  const normalized = normalizeAppName(appName);
  const entry = ACTIVITY_ENTRIES.find(({ aliases }) =>
    aliases.some((alias) => normalizeAppName(alias) === normalized)
  );

  return entry?.text[locale] ?? null;
}
