# 需求待办

待办变更需要明确确认后才能编辑。

优先级取值：`High`（高）、`Medium`（中）、`Low`（低）。

状态取值：`Candidate`（候选）、`Accepted`（已接受）、`Blocked`（阻塞）、`Done`（完成）、`Dropped`（已放弃）。

| ID | 领域 | 优先级 | 状态 | 候选需求 | 下一步 | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| JW-002 | 首页 | Medium | Candidate | 添加真实的作品集和我的 OS 页面内容，超越占位文案。 | 定义产品内容和交互边界。 | README |
| JW-003 | 本地活动 | Low | Candidate | 确认位置后，在公共 UI 中挂载 `LocalActivityStatus`。 | 决定位置和隐私文案。 | docs/README.md |
| JW-004 | 依赖 | High | Candidate | 生产依赖安全更新：2026-09-27 的容器审计报告 11 项（1 critical、7 high、2 moderate、1 low）。 | 按当前锁文件复核受影响的包，评估定向升级并执行相关回归。 | [CHANGELOG.md](../../CHANGELOG.md#2026-09-27--v110)，2026-09-27 |
