import type { ProjectRecord, ResumeRecord, SiteContentRepository, SiteIdentity, StudioFileEntry } from '../../contracts/content';

type ObjectRecord = Record<string, unknown>;
function record(value: unknown, label: string): asserts value is ObjectRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}: expected object`);
}
function text(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}: expected non-empty text`);
}
function list(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label}: expected array`);
}
function strings(value: unknown, label: string) {
  list(value, label); value.forEach(item => text(item, label));
}
function href(value: unknown, label: string) {
  text(value, label);
  if (value.startsWith('/') && !value.startsWith('//')) {
    if (value.split('/').some(part => ['..', '.'].includes(decodeURIComponent(part)))) throw new Error(`${label}: unsafe path`);
    return;
  }
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${label}: invalid URL`); }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`${label}: invalid URL protocol`);
}
function identifier(value: unknown, seen: Set<string>, label: string) {
  text(value, label);
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(value) || seen.has(value)) throw new Error(`${label}: invalid or duplicate ID ${value}`);
  seen.add(value);
}

export function validateSiteIdentity(input: unknown): SiteIdentity {
  record(input, 'site');
  for (const key of ['brand', 'author', 'description', 'signature', 'journalTitle', 'journalDescription', 'pageTitleTemplate', 'articleTitleTemplate']) text(input[key], `site.${key}`);
  if (!String(input.pageTitleTemplate).includes('{page}') || !String(input.articleTitleTemplate).includes('{article}')) throw new Error('site: title template missing placeholder');
  return input as SiteIdentity;
}

export function createSiteRepository(projects: unknown, resume: unknown, files: unknown): SiteContentRepository {
  list(projects, 'projects'); record(resume, 'resume'); list(files, 'studio files');
  const projectIds = new Set<string>();
  for (const project of projects) {
    record(project, 'project'); identifier(project.id, projectIds, 'project');
    for (const key of ['title', 'navLabel', 'summary', 'description', 'lastUpdatedText', 'startedText']) text(project[key], `project.${key}`);
    strings(project.tags, 'project.tags');
    if (project.highlights !== undefined) strings(project.highlights, 'project.highlights');
    record(project.preview, 'project.preview'); text(project.preview.alt, 'preview.alt');
    if (project.preview.kind === 'image') href(project.preview.src, 'preview.src');
    else if (project.preview.kind !== 'framelean-workbench') throw new Error('preview: invalid kind');
    list(project.links, 'project.links');
    for (const link of project.links) {
      record(link, 'link'); text(link.label, 'link.label'); href(link.href, 'link.href');
      if (!['github', 'gitee', 'website', 'docs'].includes(String(link.kind))) throw new Error('link: invalid kind');
    }
    if (project.downloads !== undefined) {
      record(project.downloads, 'downloads'); text(project.downloads.version, 'downloads.version'); href(project.downloads.releasePage, 'downloads.releasePage');
      list(project.downloads.packages, 'downloads.packages'); const ids = new Set<string>();
      for (const pkg of project.downloads.packages) {
        record(pkg, 'package'); identifier(pkg.id, ids, 'package'); href(pkg.href, 'package.href');
        for (const key of ['format', 'label', 'description']) text(pkg[key], `package.${key}`);
        if (!['macos', 'windows'].includes(String(pkg.platform))) throw new Error('package: invalid platform');
        for (const key of ['recommended', 'defaultForPlatform']) if (pkg[key] !== undefined && typeof pkg[key] !== 'boolean') throw new Error(`package.${key}: expected boolean`);
      }
    }
  }
  for (const key of ['name', 'role', 'phone', 'email', 'summary']) text(resume[key], `resume.${key}`);
  if (!Number.isInteger(resume.age) || Number(resume.age) < 0) throw new Error('resume.age: invalid age');
  if (resume.tags !== undefined) strings(resume.tags, 'resume.tags');
  list(resume.sections, 'resume.sections');
  for (const section of resume.sections) { record(section, 'section'); text(section.title, 'section.title'); strings(section.paragraphs, 'section.paragraphs'); }
  const fileIds = new Set<string>();
  for (const file of files) {
    record(file, 'file'); identifier(file.id, fileIds, 'file');
    if (file.kind === 'project') { if (!projectIds.has(String(file.source))) throw new Error(`Missing studio project: ${file.source}`); }
    else if (file.kind !== 'resume') throw new Error('file: invalid kind');
  }
  return { projects: () => projects as ProjectRecord[], resume: () => resume as ResumeRecord, studioFiles: () => files as StudioFileEntry[] };
}
