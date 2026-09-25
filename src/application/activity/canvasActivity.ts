import type { ActivitySnapshot } from '../../contracts/activity';

export type ActivityState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; snapshot: ActivitySnapshot | null };

export function activityCopy(state: ActivityState, now = Date.now()) {
  if (state.status === 'loading') return { title: '正在获取状态…', detail: '' };
  if (state.status === 'error') return { title: '暂时无法获取状态', detail: '' };
  const snapshot = state.snapshot;
  if (!snapshot || snapshot.expiresAt <= now) {
    return { title: '好像关机了', detail: '应该是睡觉去了，反正电脑是关的' };
  }
  return { title: snapshot.appName, detail: snapshot.text ?? '正在使用' };
}
