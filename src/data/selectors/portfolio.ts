import type { ProjectRecord, SiteContentRepository } from "../../contracts/content";
import { publishedSite } from "../repositories/site.ts";

export function selectPortfolioProjects(repository: Pick<SiteContentRepository, "projects"> = publishedSite) {
  return repository.projects().map((project: ProjectRecord, index) => ({
    ...project,
    index,
    primaryLinks: project.links.filter(link => link.kind === "github"),
    secondaryLinks: project.links.filter(link => link.kind !== "github"),
  }));
}
