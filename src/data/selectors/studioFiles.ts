import type { SiteContentRepository } from "../../contracts/content";
import { publishedSite } from "../repositories/site.ts";

export function selectStudioFiles(repository: SiteContentRepository) {
  const projects = new Map(repository.projects().map(project => [project.id, project]));
  const resume = repository.resume();
  const files = repository.studioFiles().map(file => {
    if (file.kind === "resume") return {
      id: file.id, kind: file.kind, title: `${resume.name}简历`,
      summary: resume.summary, tags: ["简历", "Flutter"], resume,
    };
    const project = projects.get(file.source);
    if (!project) throw new Error(`Missing studio project: ${file.source}`);
    return { id: file.id, kind: file.kind, title: project.title, summary: project.summary, tags: project.tags, project };
  });
  if (new Set(files.map(file => file.id)).size !== files.length) throw new Error("Duplicate studio file ID");
  return files;
}

export const studioFiles = selectStudioFiles(publishedSite);
