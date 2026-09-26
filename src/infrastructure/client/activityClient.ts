import { getBrowserActivitySource } from '../../justin-kit/components/local-activity-status/runtime/activitySource';
import type { ActivityUpdate } from '../../justin-kit/components/local-activity-status/runtime/activitySource';

export function subscribeActivity(listener: (state: ActivityUpdate) => void) {
  return getBrowserActivitySource('/api/activity/stream').subscribe(listener);
}
