export const ENTRANCE_SESSION_KEY = 'justin-entrance-completed';
let completedInPage = false;
export function entranceCompleted() {
  try { return completedInPage || sessionStorage.getItem(ENTRANCE_SESSION_KEY) === '1'; }
  catch { return completedInPage; }
}
export function isReloadNavigation() {
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return navigation?.type === 'reload';
}
export function completeEntrance() {
  completedInPage = true;
  try { sessionStorage.setItem(ENTRANCE_SESSION_KEY, '1'); } catch { /* Page-local success still permits access. */ }
}
