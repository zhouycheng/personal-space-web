import { readFile, writeFile } from 'node:fs/promises';

const directory = '.workspace/remediation/ui-probes';
const read = async name => JSON.parse(await readFile(`${directory}/${name}.json`, 'utf8'));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const flatten = (value, prefix = '') => Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
  const path = prefix ? `${prefix}.${key}` : key;
  return typeof item === 'number' ? [[path, item]] : item && typeof item === 'object' ? Object.entries(flatten(item, path)) : [];
}));
const scenarios = ['reducedDome', 'normalDome', 'zeroDome', 'canvasZoom', 'canvasDrag', 'galleryDrag', 'desktopDrag'];
const strictZero = new Set([
  'reducedDome.rafScheduled', 'reducedDome.rafExecuted', 'reducedDome.domeDraws',
  'zeroDome.rafScheduled', 'zeroDome.rafExecuted', 'zeroDome.domeDraws',
  'canvasZoom.canvasStorageReads', 'canvasDrag.canvasStorageReads',
]);

if (process.argv.includes('--freeze')) {
  const baseline = await read('B1');
  const budgets = {};
  for (const scenario of scenarios) {
    const samples = baseline.results.map(run => flatten(run[scenario]));
    for (const key of Object.keys(samples[0])) {
      const id = `${scenario}.${key}`;
      const values = samples.map(sample => sample[key]);
      const center = median(values), range = Math.max(...values) - Math.min(...values);
      const tolerance = Math.max(center * .05, range);
      const budget = { values, median: center, range, tolerance, minimum: 0, maximum: center + tolerance, gate: 'upper-bound' };
      if (strictZero.has(id)) { budget.maximum = 0; budget.gate = 'strict-zero'; }
      if (id === 'normalDome.domeDraws') { budget.minimum = center - tolerance; budget.gate = 'stable-animation'; }
      if (key === 'durationMs') budget.gate = 'diagnostic';
      // Pointer moves were previously written immediately. Their new RAF count measures
      // coalescing, so enforce the known 48 moves + final flush rather than a zero baseline.
      if (scenario === 'galleryDrag' && key.startsWith('raf')) {
        budget.maximum = 50;
        budget.gate = 'bounded-input-coalescing';
      }
      budgets[id] = budget;
    }
  }
  await writeFile(`${directory}/B1-budgets.json`, JSON.stringify({
    frozenAt: new Date().toISOString(), baselineCapturedAt: baseline.capturedAt,
    rule: 'median plus max(5 percent of median, observed three-run range); each repeat must meet the gate',
    notes: ['Duration includes Playwright dispatch and intentional waits, so is diagnostic rather than input latency.',
      'Reduced-motion and zero-size dome must schedule and draw zero idle frames; canvas must not reread positions during zoom/drag.',
      'Normal-motion draw count remains within baseline tolerance; no visual parameters or DPR are lowered.',
      'Gallery RAF is newly introduced input coalescing, capped at the 48 input steps plus final flush and one tolerance callback.'],
    budgets,
  }, null, 2) + '\n', { flag: 'wx' });
  console.log('UI B1 budgets frozen before B2');
} else {
  const { budgets, frozenAt } = await read('B1-budgets');
  const candidate = await read('B2');
  const comparisons = Object.entries(budgets).map(([id, budget]) => {
    const [scenario, ...field] = id.split('.');
    const values = candidate.results.map(run => flatten(run[scenario])[field.join('.')]);
    const passed = budget.gate === 'diagnostic' || values.every(value => value >= budget.minimum && value <= budget.maximum);
    return { id, ...budget, candidate: values, candidateMedian: median(values), passed };
  });
  const failures = comparisons.filter(item => !item.passed);
  await writeFile(`${directory}/B1-B2-comparison.json`, JSON.stringify({ frozenAt, comparedAt: new Date().toISOString(), passed: !failures.length, failures, comparisons }, null, 2) + '\n');
  console.log(`UI B1/B2: ${comparisons.length - failures.length}/${comparisons.length} frozen budgets met`);
  if (failures.length) { console.log(JSON.stringify(failures, null, 2)); process.exitCode = 1; }
}
