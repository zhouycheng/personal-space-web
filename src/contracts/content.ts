export type ProjectLink = {
  kind: "github" | "gitee" | "website" | "docs";
  label: string;
  href: string;
};

export type DownloadPackage = {
  id: string;
  platform: "macos" | "windows";
  format: string;
  label: string;
  description: string;
  href: string;
  defaultForPlatform?: boolean;
  recommended?: boolean;
};

export type ProjectRecord = {
  id: string;
  navLabel: string;
  title: string;
  tags: string[];
  summary: string;
  highlights?: string[];
  description: string;
  lastUpdatedText: string;
  startedText: string;
  preview: { kind: "image"; src: string; alt: string } | { kind: "framelean-workbench"; alt: string };
  links: ProjectLink[];
  downloads?: { version: string; releasePage: string; packages: DownloadPackage[] };
};

export type ResumeRecord = {
  name: string;
  role: string;
  phone: string;
  email: string;
  age: number;
  summary: string;
  sections: { title: string; paragraphs: string[] }[];
};

export type StudioFileEntry =
  | { id: string; kind: "project"; source: string }
  | { id: string; kind: "resume" };

export type SiteContentRepository = {
  projects(): readonly ProjectRecord[];
  resume(): ResumeRecord;
  studioFiles(): readonly StudioFileEntry[];
};
