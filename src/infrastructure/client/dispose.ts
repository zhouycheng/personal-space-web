/** One failing owner must not prevent the remaining resources from being released. */
export function disposeSafely(tasks: Iterable<() => void>, report: (error: unknown) => void = error => console.error('Resource cleanup failed', error)) {
  for (const dispose of tasks) {
    try { dispose(); }
    catch (error) { try { report(error); } catch { /* Diagnostics cannot interrupt cleanup. */ } }
  }
}
