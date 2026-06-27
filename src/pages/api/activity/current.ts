import { getActivityStore } from "../../../lib/activity/store";

export const prerender = false;

export async function GET() {
  const snapshot = getActivityStore().getSnapshot();
  return new Response(JSON.stringify(snapshot), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
  });
}
