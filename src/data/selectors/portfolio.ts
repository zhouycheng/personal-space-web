import type { ProjectRecord, SiteContentRepository } from "../../contracts/content";

export function selectPortfolioProjects(repository: Pick<SiteContentRepository, "projects">) {
  return repository.projects().map((project: ProjectRecord, index) => ({
    ...project,
    index,
    primaryLinks: project.links.filter(link => link.kind === "github"),
    secondaryLinks: project.links.filter(link => link.kind !== "github"),
  }));
}
