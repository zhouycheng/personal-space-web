export const oldDirectories = ['components', 'features', 'server', 'lib', 'layouts', 'styles', 'assets', 'playground'];
export function layer(file) {
  const parts = file.split('/');
  return ['presentation', 'data', 'infrastructure'].includes(parts[1]) ? parts.slice(0, 3).join('/') : parts.slice(0, 2).join('/');
}
export const allowed = {
  'src/contracts': ['src/contracts'],
  'src/content': ['src/content', 'src/contracts'],
  'src/config': ['src/config', 'src/contracts'],
  'src/data/repositories': ['src/data/repositories', 'src/data/selectors', 'src/contracts', 'src/content', 'src/infrastructure'],
  'src/data/stores': ['src/data/stores', 'src/data/selectors', 'src/contracts', 'src/justin-kit'],
  'src/data/selectors': ['src/data/selectors', 'src/contracts', 'src/config'],
  'src/application': ['src/application', 'src/contracts', 'src/data', 'src/config'],
  'src/animation': ['src/animation', 'src/contracts', 'src/config'],
  'src/presentation/scene': ['src/presentation/scene', 'src/presentation/interaction', 'src/animation', 'src/contracts', 'src/config', 'src/data/selectors', 'src/infrastructure/client'],
  'src/presentation/interaction': ['src/presentation/interaction', 'src/contracts', 'src/config', 'src/animation', 'src/data/selectors'],
  'src/justin-kit': ['src/justin-kit'],
  'src/infrastructure/client': ['src/infrastructure/client', 'src/contracts', 'src/config', 'src/justin-kit'],
  'src/infrastructure/server': ['src/infrastructure/server', 'src/contracts', 'src/content', 'src/data', 'src/generated', 'src/justin-kit'],
};
export const pureLayers = new Set(['src/contracts', 'src/content', 'src/config', 'src/data/selectors', 'src/data/stores', 'src/data/repositories', 'src/application']);
export function inside(file, prefix) { return file === prefix || file.startsWith(`${prefix}/`); }
export function isServerFile(file) { return inside(file, 'src/infrastructure/server') || inside(file, 'src/pages/api') || file.endsWith('/desktop-scanner.ts'); }
