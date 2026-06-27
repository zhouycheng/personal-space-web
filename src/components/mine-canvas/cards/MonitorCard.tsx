import { Activity } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { registerCard } from "../../../lib/canvas/card-registry";
import type { ActivitySnapshot } from "../../../lib/activity/types";
import type { MineCanvasNodeData } from "../mineCanvasTypes";
import { NodeHeader } from "../MineCanvasCardShared";

type MonitorState =
  | { status: "offline" }
  | { status: "known"; appName: string; text: string }
  | { status: "unknown"; appName: string };

function MonitorCard({ data, nodeId, update }: {
  data: Extract<MineCanvasNodeData, { kind: "monitor" }>;
  nodeId: string;
  update: (updater: (current: MineCanvasNodeData) => MineCanvasNodeData) => void;
}) {
  const [monitor, setMonitor] = useState<MonitorState>({ status: "offline" });

  const poll = useCallback(() => {
    fetch("/api/activity/current")
      .then((res) => res.json())
      .then((json: ActivitySnapshot | null) => {
        if (!json) {
          setMonitor({ status: "offline" });
        } else if (json.text !== null) {
          setMonitor({ status: "known", appName: json.appName, text: json.text });
        } else {
          setMonitor({ status: "unknown", appName: json.appName });
        }
      })
      .catch(() => { /* keep last known state */ });
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [poll]);

  const accent = monitor.status === "offline" ? "#9ca3af" : data.accent;

  return (
    <div className="mine-card mine-card--monitor" style={{ "--mine-node-accent": accent } as React.CSSProperties}>
      <NodeHeader
        label="笔记本窗口监听器"
        nodeId={nodeId}
        title={data.title}
        onTitleChange={(title) => update((current) => ({ ...current, title } as MineCanvasNodeData))}
      />
      <div className="mine-monitor-body">
        {monitor.status === "offline" && (
          <div className="mine-monitor-activity">
            <span className="mine-monitor-app">好像关机了</span>
            <span className="mine-monitor-text">应该是睡觉去了，反正电脑是关的</span>
          </div>
        )}
        {monitor.status === "known" && (
          <div className="mine-monitor-activity">
            <span className="mine-monitor-app">{monitor.appName}</span>
            <span className="mine-monitor-text">{monitor.text}</span>
          </div>
        )}
        {monitor.status === "unknown" && (
          <div className="mine-monitor-activity">
            <span className="mine-monitor-app">不知道是啥窗口</span>
            <span className="mine-monitor-text">不知道偷偷摸摸干什么呢，我不认识这个窗口</span>
          </div>
        )}
      </div>
    </div>
  );
}

registerCard({
  kind: "monitor",
  label: "本地窗口监听卡片",
  accent: "#059669",
  defaultSize: { width: 320, height: 140 },
  icon: Activity,
  authorOnly: true,
  createDefaultData: () => ({
    kind: "monitor",
    title: "我正在使用",
    accent: "#059669",
    width: 320,
    height: 140,
  }),
  Component: MonitorCard as import("../../../lib/canvas/card-registry").CardDefinition["Component"],
});
