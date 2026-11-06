import { publishedSite } from '../data/repositories/site.ts';
import { selectStudioFiles } from '../data/selectors/studioFiles.ts';
import type { StudioSceneFile } from '../contracts/studio';

export const studioFiles = selectStudioFiles(publishedSite);
export const sceneFiles: StudioSceneFile[] = studioFiles.map(file => ({ id: file.id, title: file.title, kind: file.kind }));
