import type { NotificationIntensity } from "@/types";

export type NotificationPolicyContext = {
  enabled: boolean;
  intensity: NotificationIntensity;
  isAppForeground: boolean;
  isChatVisible: boolean;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  eventWorkspaceId: string;
  eventThreadId: string | null;
};

function isActiveThread(ctx: NotificationPolicyContext): boolean {
  if (!ctx.activeWorkspaceId || !ctx.activeThreadId) {
    return false;
  }
  if (!ctx.eventThreadId) {
    return false;
  }
  return (
    ctx.activeWorkspaceId === ctx.eventWorkspaceId &&
    ctx.activeThreadId === ctx.eventThreadId
  );
}

export function shouldSendNotificationByIntensity(
  ctx: NotificationPolicyContext,
): boolean {
  if (!ctx.enabled) {
    return false;
  }

  if (ctx.intensity === "high") {
    return true;
  }

  if (ctx.intensity === "low") {
    return !ctx.isAppForeground;
  }

  // medium
  if (ctx.isAppForeground && ctx.isChatVisible && isActiveThread(ctx)) {
    return false;
  }
  return true;
}

