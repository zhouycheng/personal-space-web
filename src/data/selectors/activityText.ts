type Locale = "zh" | "en";

const ACTIVITY_ENTRIES = [
  {
    aliases: ["cursor"],
    text: { zh: "用 Cursor 抓老鼠中", en: "Bug hunting in Cursor" },
  },
  {
    aliases: ["codex"],
    text: { zh: "一起搬砖中", en: "Building together" },
  },
  {
    aliases: ["codex++"],
    text: { zh: "升级 CodeX 中", en: "Upgrading CodeX" },
  },
  {
    aliases: ["trae cn", "trae"],
    text: { zh: "古法coding进行中", en: "Old-school coding" },
  },
  {
    aliases: ["safari", "safari浏览器"],
    text: { zh: "高强度冲浪中", en: "Surfing hard" },
  },
  {
    aliases: ["google chrome", "chrome"],
    text: { zh: "搜来搜去，看来看去", en: "Searching and browsing" },
  },
  {
    aliases: ["微信", "wechat"],
    text: { zh: "在摸鱼中", en: "Slacking off" },
  },
  {
    aliases: ["微信开发者工具", "wechat devtools", "wechat developer tools"],
    text: { zh: "诶，又哪出问题了？", en: "What broke this time?" },
  },
  {
    aliases: ["飞书", "lark"],
    text: { zh: "在知识库里记点啥呢", en: "Writing in the knowledge base" },
  },
  {
    aliases: ["钉钉", "dingtalk"],
    text: { zh: "真的不想回，甚至不想打开", en: "Really don't want to open this" },
  },
  {
    aliases: ["qq"],
    text: { zh: "观望各种群的聊天中", en: "Lurking in group chats" },
  },
  {
    aliases: ["网易云音乐", "neteasemusic"],
    text: { zh: "哔哔哔哔，啦啦啦啦", en: "Beep beep, la la la" },
  },
  {
    aliases: ["bob"],
    text: { zh: "鲍勃，这个单词啥意思？", en: "Bob, what does this word mean?" },
  },
  {
    aliases: ["typora"],
    text: { zh: "在看某 README 中", en: "Reading some README" },
  },
  {
    aliases: ["抖音", "douyin", "tiktok"],
    text: { zh: "什么！又有新技术了？", en: "What! A new tech stack?" },
  },
  {
    aliases: ["blender"],
    text: { zh: "对着刚建的 Box 发呆中", en: "Staring at a default cube" },
  },
  {
    aliases: ["photoshop", "adobe photoshop"],
    text: { zh: "我PPPPPPPP", en: "Photoshopping away" },
  },
  {
    aliases: ["figma"],
    text: { zh: "我画画画画画画", en: "Drawing away" },
  },
  {
    aliases: ["xcode"],
    text: { zh: "说实话，我真的觉得SwiftUI比Flutter难", en: "SwiftUI is harder than Flutter, honestly" },
  },
  {
    aliases: ["android studio"],
    text: { zh: "用最古老的方式炼化仙丹中", en: "Alchemizing with ancient methods" },
  },
  {
    aliases: ["ghostty"],
    text: { zh: "大概率在 CC 中无法自拔", en: "Probably stuck in CC" },
  },
  {
    aliases: ["滴答清单", "ticktick"],
    text: { zh: "让我看看我还有啥事没干", en: "Let me check what I forgot" },
  },
  {
    aliases: ["linear"],
    text: { zh: "诶！我又有新的idea了", en: "Oh! I have a new idea" },
  },
  {
    aliases: ["wps office", "wpsoffice"],
    text: { zh: "在这WPS里干啥我就不多说了", en: "Let's not talk about what I'm doing in WPS" },
  },
  {
    aliases: ["腾讯会议", "tencentmeeting", "voov meeting"],
    text: { zh: "假装在听", en: "Pretending to listen" },
  },
  {
    aliases: ["postman", "apifox"],
    text: { zh: "对着接口发呆", en: "Staring at an API endpoint" },
  },
  {
    aliases: ["charles"],
    text: { zh: "抓包中", en: "Packet sniffing" },
  },
  {
    aliases: ["docker"],
    text: { zh: "等容器启动", en: "Waiting for containers" },
  },
  {
    aliases: ["navicat", "navicat premium"],
    text: { zh: "翻翻数据库", en: "Browsing the database" },
  },
  {
    aliases: ["unity"],
    text: { zh: "搭场景", en: "Building a scene" },
  },
  {
    aliases: ["爱奇艺", "iqiyi"],
    text: { zh: "追剧中", en: "Watching a show" },
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
