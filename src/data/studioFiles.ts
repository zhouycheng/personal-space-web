import projects from "./projects.json" with { type: "json" };
import resume from "./resume.json" with { type: "json" };

// This order is shared by the desk files and their reading view.
const manifest = [
  { id: "framelean", kind: "project", source: "framelean" },
  { id: "exercises-eagles", kind: "project", source: "exercises-eagles" },
  { id: "resume", kind: "resume", source: resume },
] as const;

export const studioFiles = manifest.map(file => {
  if (file.kind === "resume") return {
    id: file.id, kind: file.kind, title: `${file.source.name}简历`,
    summary: file.source.summary, tags: ["简历", "Flutter"], resume: file.source,
  };
  const project = projects.find(project => project.id === file.source);
  if (!project) throw new Error(`Missing studio project: ${file.source}`);
  return { id: file.id, kind: file.kind, title: project.title, summary: project.summary, tags: project.tags, project };
});
