import { main } from '../src/justin-kit/components/local-activity-status/scripts/activity-cli.mjs';
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('需要 Node 22 或更新版本');
await main(['install']);
