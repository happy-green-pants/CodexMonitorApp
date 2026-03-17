import { useCallback, useEffect, useRef } from "react";
import { useUpdater } from "../../update/hooks/useUpdater";
import { useAgentSoundNotifications } from "../../notifications/hooks/useAgentSoundNotifications";
import { useAgentSystemNotifications } from "../../notifications/hooks/useAgentSystemNotifications";
import { useWindowFocusState } from "../../layout/hooks/useWindowFocusState";
import { useTauriEvent } from "./useTauriEvent";
import { playNotificationSound } from "../../../utils/notificationSounds";
import { subscribeUpdaterCheck } from "../../../services/events";
import { ensureNotificationPermission, sendNotification } from "../../../services/tauri";
import type { DebugEntry, NotificationIntensity } from "../../../types";

type Params = {
  enabled?: boolean;
  notificationSoundsEnabled: boolean;
  systemNotificationsEnabled: boolean;
  subagentSystemNotificationsEnabled: boolean;
  notificationIntensity: NotificationIntensity;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  isChatVisible: boolean;
  isSubagentThread?: (workspaceId: string, threadId: string) => boolean;
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  onThreadNotificationSent?: (workspaceId: string, threadId: string) => void;
  onDebug: (entry: DebugEntry) => void;
  successSoundUrl: string;
  errorSoundUrl: string;
};

export function useUpdaterController({
  enabled = true,
  notificationSoundsEnabled,
  systemNotificationsEnabled,
  subagentSystemNotificationsEnabled,
  notificationIntensity,
  activeWorkspaceId,
  activeThreadId,
  isChatVisible,
  isSubagentThread,
  getWorkspaceName,
  onThreadNotificationSent,
  onDebug,
  successSoundUrl,
  errorSoundUrl,
}: Params) {
  const {
    state: updaterState,
    startUpdate,
    checkForUpdates,
    dismiss,
    postUpdateNotice,
    dismissPostUpdateNotice,
  } = useUpdater({
    enabled,
    onDebug,
  });
  const isWindowFocused = useWindowFocusState();
  const nextTestSoundIsError = useRef(false);

  const subscribeUpdaterCheckEvent = useCallback(
    (handler: () => void) =>
      subscribeUpdaterCheck(handler, {
        onError: (error) => {
          onDebug({
            id: `${Date.now()}-client-updater-menu-error`,
            timestamp: Date.now(),
            source: "error",
            label: "updater/menu-error",
            payload: error instanceof Error ? error.message : String(error),
          });
        },
      }),
    [onDebug],
  );

  useTauriEvent(
    subscribeUpdaterCheckEvent,
    () => {
      void checkForUpdates({ announceNoUpdate: true });
    },
    { enabled },
  );

  useAgentSoundNotifications({
    enabled: notificationSoundsEnabled,
    isWindowFocused,
    onDebug,
  });

  useAgentSystemNotifications({
    enabled: systemNotificationsEnabled,
    notificationIntensity,
    activeWorkspaceId,
    activeThreadId,
    isChatVisible,
    subagentNotificationsEnabled: subagentSystemNotificationsEnabled,
    isSubagentThread,
    isWindowFocused,
    getWorkspaceName,
    onThreadNotificationSent,
    onDebug,
  });

  useEffect(() => {
    if (!systemNotificationsEnabled) {
      return;
    }
    void ensureNotificationPermission();
  }, [systemNotificationsEnabled]);

  const handleTestNotificationSound = useCallback(() => {
    const useError = nextTestSoundIsError.current;
    nextTestSoundIsError.current = !useError;
    const type = useError ? "error" : "success";
    const url = useError ? errorSoundUrl : successSoundUrl;
    playNotificationSound(url, type, onDebug);
  }, [errorSoundUrl, onDebug, successSoundUrl]);

  const handleTestSystemNotification = useCallback(() => {
    if (!systemNotificationsEnabled) {
      return;
    }
    void sendNotification(
      "Test Notification",
      "This is a test notification from CodexMonitor.",
    ).catch((error) => {
      onDebug({
        id: `${Date.now()}-client-notification-test-error`,
        timestamp: Date.now(),
        source: "error",
        label: "notification/test-error",
        payload: error instanceof Error ? error.message : String(error),
      });
    });
  }, [onDebug, systemNotificationsEnabled]);

  return {
    updaterState,
    startUpdate,
    checkForUpdates,
    dismissUpdate: dismiss,
    postUpdateNotice,
    dismissPostUpdateNotice,
    handleTestNotificationSound,
    handleTestSystemNotification,
  };
}
