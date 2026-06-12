import type { Locale } from "@/lib/i18n/config";

type ProjectCopy = {
  kind: string;
  title: string;
  summary: string;
  facts: string[];
};

type FeaturedProject = {
  id: string;
  repo: string;
  href: string;
  stack: string[];
  zh: ProjectCopy;
  en: ProjectCopy;
};

type FeaturedProjectsSectionProps = {
  locale: Locale;
};

const SECTION_COPY = {
  zh: {
    eyebrow: "Projects / 03",
    title: "项目",
    sourceLabel: "github.com/zhouycheng",
    visitLabel: "GitHub",
  },
  en: {
    eyebrow: "Projects / 03",
    title: "Projects",
    sourceLabel: "github.com/zhouycheng",
    visitLabel: "GitHub",
  },
} satisfies Record<Locale, Record<string, string>>;

const FEATURED_PROJECTS = [
  {
    id: "framelean",
    repo: "FrameLean",
    href: "https://github.com/zhouycheng/FrameLean",
    stack: ["Flutter", "Riverpod", "Drift", "SQLite", "FFmpeg"],
    zh: {
      kind: "Desktop",
      title: "本地视频压缩桌面应用",
      summary:
        "用 Flutter Desktop 把 FFmpeg 压缩流程整理成可配置的桌面工具，覆盖任务记录、默认参数和 macOS / Windows 运行时处理。",
      facts: ["macOS / Windows", "FFmpeg 7.1.1", "硬件编码检测"],
    },
    en: {
      kind: "Desktop",
      title: "Local video compression app",
      summary:
        "A Flutter Desktop app that turns FFmpeg compression into a configurable workflow with task history, defaults, and macOS / Windows runtime handling.",
      facts: ["macOS / Windows", "FFmpeg 7.1.1", "Encoder detection"],
    },
  },
  {
    id: "exercises-eagles",
    repo: "ExercisesEagles",
    href: "https://github.com/zhouycheng/ExercisesEagles",
    stack: ["WeChat Mini Program", "JavaScript", "WXML", "WXSS"],
    zh: {
      kind: "Mini Program",
      title: "题小鹰期末刷题小程序",
      summary:
        "围绕本地题库做选题、作答、解析、交卷和逐题回顾，保留后续接入云开发的结构。",
      facts: ["本地题库 MVP", "答题状态", "错题回顾"],
    },
    en: {
      kind: "Mini Program",
      title: "Exam practice mini program",
      summary:
        "A question-bank MVP for selecting questions, answering, reading explanations, submitting, and reviewing each result, with room for cloud development later.",
      facts: ["Local MVP", "Quiz state", "Review flow"],
    },
  },
  {
    id: "cleanproject",
    repo: "CleanProject",
    href: "https://github.com/zhouycheng/CleanProject",
    stack: ["Go", "CLI", "YAML", "JSON"],
    zh: {
      kind: "CLI",
      title: "开发项目清理工具",
      summary:
        "扫描常见项目类型，只处理白名单里的依赖、构建产物和缓存；支持 dry-run / JSON 输出，默认移入废纸篓。",
      facts: ["项目类型扫描", "白名单清理", "废纸篓策略"],
    },
    en: {
      kind: "CLI",
      title: "Developer project cleanup tool",
      summary:
        "Scans common project types and only cleans allowlisted dependencies, build artifacts, and caches, with dry-run / JSON output and trash-first cleanup.",
      facts: ["Project scanning", "Allowlisted cleanup", "Trash-first"],
    },
  },
] satisfies FeaturedProject[];

export function FeaturedProjectsSection({ locale }: FeaturedProjectsSectionProps) {
  const section = SECTION_COPY[locale];

  return (
    <div className="featured-projects-shell w-full max-w-6xl px-6 md:px-10 lg:px-12">
      <header className="project-index-header">
        <div>
          <p className="site-label font-home-mono">{section.eyebrow}</p>
          <h2 className="font-home-system text-4xl font-bold text-[var(--page-heading)] md:text-5xl">
            {section.title}
          </h2>
        </div>
        <a
          href="https://github.com/zhouycheng"
          target="_blank"
          rel="noreferrer"
          className="project-index-source font-home-mono"
        >
          {section.sourceLabel}
        </a>
      </header>

      <ol className="project-index-list mt-8">
        {FEATURED_PROJECTS.map((project, index) => {
          const copy = project[locale];

          return (
            <li key={project.id}>
              <a
                href={project.href}
                target="_blank"
                rel="noreferrer"
                className="project-index-row"
              >
                <span className="project-index-number font-home-mono">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="project-index-main">
                  <div className="project-index-title-line">
                    <h3 className="project-index-name">{project.repo}</h3>
                    <span className="project-index-kind font-home-mono">{copy.kind}</span>
                  </div>

                  <p className="project-index-title">{copy.title}</p>
                  <p className="project-index-summary">{copy.summary}</p>

                  <div className="project-index-meta">
                    <ul className="project-index-facts font-home-mono">
                      {copy.facts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>

                    <div className="project-index-stack">
                      {project.stack.map((item) => (
                        <span key={item} className="project-stack-chip font-home-mono">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <span className="project-index-action font-home-mono">{section.visitLabel}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
