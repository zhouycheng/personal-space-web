import { readFile, writeFile } from 'node:fs/promises';

const directory = process.env.PERF_DIRECTORY ?? '.workspace/remediation';
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
function samples(report) {
  const metrics = {};
  const add = (name, value) => (metrics[name] ??= []).push(value);
  for (const run of report.runs) {
    if (run.errors.length) throw new Error(`${report.label} contains page errors`);
    for (const scenario of run.scenarios) {
      if (scenario.name === 'home-idle') {
        const prefix = `home.${scenario.reducedMotion}`;
        for (const key of ['rafExecuted', 'drawCalls']) add(`${prefix}.${key}`, scenario.after.detail[key] - scenario.before.detail[key]);
        for (const key of ['TaskDuration', 'ScriptDuration', 'LayoutDuration']) add(`${prefix}.${key}`, scenario.after[key] - scenario.before[key]);
      }
      if (scenario.name === 'route-cycles') {
        const first = scenario.checkpoints[0].metrics, last = scenario.checkpoints.at(-1).metrics;
        add('cycles.heapBytes', last.JSHeapUsedSize);
        add('cycles.heapGrowth10to30', last.JSHeapUsedSize - first.JSHeapUsedSize);
        for (const key of ['nodes', 'jsEventListeners', 'documents']) add(`cycles.${key}`, last.dom[key]);
        for (const key of ['texture', 'buffer']) add(`cycles.live${key}`, last.detail[`${key}Created`] - last.detail[`${key}Deleted`]);
        add('cycles.inactiveActivityRequests', scenario.inactiveActivityRequests);
      }
    }
  }
  return metrics;
}
const read = label => readFile(`${directory}/${label}.json`, 'utf8').then(JSON.parse);
const b1 = samples(await read('B1'));
if (process.argv.includes('--freeze')) {
  const budgets = Object.fromEntries(Object.entries(b1).map(([name, values]) => {
    if (values.length !== 3) throw new Error(`${name} needs exactly three baseline repeats`);
    const center = median(values), noise = Math.max(...values) - Math.min(...values);
    const tolerance = Math.max(Math.abs(center) * .05, noise);
    return [name, { samples: values, median: center, tolerance, upper: center + tolerance }];
  }));
  await writeFile(`${directory}/B1-budgets.json`, JSON.stringify(budgets, null, 2), { flag: 'wx' });
  console.log('B1 budgets frozen before B2: median + max(5%, three-run range).');
} else {
  const b0 = samples(await read('B0')), b2 = samples(await read('B2'));
  const budgets = JSON.parse(await readFile(`${directory}/B1-budgets.json`, 'utf8'));
  const comparison = Object.fromEntries(Object.entries(budgets).map(([name, budget]) => {
    if (b2[name]?.length !== 3) throw new Error(`${name} needs exactly three candidate repeats`);
    const value = median(b2[name]);
    // More frames of the intentional steam animation can be an improvement.
    // Keep its frozen counts visible, but gate CPU time and retained resources.
    const diagnostic = /^home\.no-preference\.(rafExecuted|drawCalls)$/.test(name);
    return [name, { b0: median(b0[name]), b1: budget.median, b2: value,
      deltaPercent: budget.median === 0 ? null : (value - budget.median) / Math.abs(budget.median) * 100,
      upper: budget.upper, gate: diagnostic ? 'diagnostic-animation-count' : 'upper-bound',
      withinBudget: value <= budget.upper, beyondNoise: Math.abs(value - budget.median) > budget.tolerance }];
  }));
  await writeFile(`${directory}/comparison.json`, JSON.stringify(comparison, null, 2));
  console.table(comparison);
  if (Object.values(comparison).some(item => item.gate === 'upper-bound' && !item.withinBudget)) process.exitCode = 1;
}
