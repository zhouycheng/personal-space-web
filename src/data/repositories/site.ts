import projects from "../../content/site/projects.json" with { type: "json" };
import resume from "../../content/site/resume.json" with { type: "json" };
import studioFiles from "../../content/site/studio-files.json" with { type: "json" };
import type { ProjectRecord, ResumeRecord, SiteContentRepository, StudioFileEntry } from "../../contracts/content";

export const publishedSite: SiteContentRepository = {
  projects: () => projects as ProjectRecord[],
  resume: () => resume as ResumeRecord,
  studioFiles: () => studioFiles as StudioFileEntry[],
};
