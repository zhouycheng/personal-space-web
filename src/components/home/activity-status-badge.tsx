"use client";

import type { Locale } from "@/lib/i18n/config";
import { resolveActivityText } from "@/lib/activity/catalog";

import { useActivityStatus } from "./use-activity-status";

type ActivityStatusBadgeProps = {
  locale: Locale;
};

export function ActivityStatusBadge({ locale }: ActivityStatusBadgeProps) {
  const status = useActivityStatus();

  if (!status) {
    return null;
  }

  const text = resolveActivityText(status.appName, locale) ?? status.text;

  return (
    <div
      aria-live="polite"
      className="site-status-badge flex items-center gap-2 rounded-xl px-4 py-3 font-home-system text-[12px] font-medium"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--page-accent)]" />
      <span className="site-status-copy min-w-0 max-w-[220px] truncate">{text}</span>
    </div>
  );
}
