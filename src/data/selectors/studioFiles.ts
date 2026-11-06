import type { SiteContentRepository } from "../../contracts/content";

export function selectStudioFiles(repository: SiteContentRepository) {
  const projects = new Map(repository.projects().map(project => [project.id, project]));
  const files = repository.studioFiles().map(file => {
    const project = projects.get(file.source);
    if (!project) throw new Error(`Missing studio project: ${file.source}`);
    return { id: file.id, kind: file.kind, title: project.title, summary: project.summary, tags: project.tags, project };
  });
  if (new Set(files.map(file => file.id)).size !== files.length) throw new Error("Duplicate studio file ID");
  return files;
}
