import { Activity } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { registerCard } from "../../../lib/canvas/card-registry";
import type { MineCanvasNodeData } from "../mineCanvasTypes";
import { NodeHeader } from "../MineCanvasCardShared";

interface ActivityData {
  appName?: string;
  text?: string;
  observedAt?: number;
  expiresAt?: number;
}

function MonitorCard({ data, nodeId, update }: {
  data: Extract<MineCanvasNodeData, { kind: "monitor" }>;
  nodeId: string;
  update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void;
}) {
  const [activity, setActivity] = useState<ActivityData | null>(null);

  const poll = useCallback(() => {
    fetch("/api/activity/current")
      .then((res) => res.json())
      .then((json) => {
        if (json && json.appName) {
          setActivity(json);
        } else {
          setActivity(null);
        }
      })
      .catch(() => { /* keep last known state */ });
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [poll]);

  return (
    <div className="mine-card mine-card--monitor">
      <NodeHeader
        label="窗口监听"
        nodeId={nodeId}
        title={data.title}
        onTitleChange={(title) => update((current) => ({ ...current, title } as MineCanvasNodeData))}
      />
      <div className="mine-monitor-body">
        {activity ? (
          <div className="mine-monitor-activity">
            <span className="mine-monitor-app">{activity.appName}</span>
            <span className="mine-monitor-text">{activity.text}</span>
          </div>
        ) : (
          <p className="mine-monitor-idle">当前无活动</p>
        )}
      </div>
    </div>
  );
}

registerCard({
  kind: "monitor",
  label: "窗口监听",
  accent: "#059669",
  defaultSize: { width: 320, height: 140 },
  icon: Activity,
  authorOnly: true,
  createDefaultData: () => ({
    kind: "monitor",
    title: "窗口监听",
    accent: "#059669",
    width: 320,
    height: 140,
  }),
  Component: MonitorCard as import("../../../lib/canvas/card-registry").CardDefinition["Component"],
});
