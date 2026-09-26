import projects from "../../content/site/projects.json" with { type: "json" };
import resume from "../../content/site/resume.json" with { type: "json" };
import studioFiles from "../../content/site/studio-files.json" with { type: "json" };
import { createSiteRepository } from './siteValidation.ts';

export const publishedSite = createSiteRepository(projects, resume, studioFiles);
