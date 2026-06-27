export {
  getActivityStore,
  DEFAULT_ACTIVITY_TTL_MS,
} from "src/lib/activity/store";

import { getActivityStore } from "src/lib/activity/store";

/** @deprecated Use getActivityStore() instead */
export const activityStatusStore = getActivityStore();
