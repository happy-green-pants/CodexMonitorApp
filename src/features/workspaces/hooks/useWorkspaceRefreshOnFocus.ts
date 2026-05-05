import { useEffect, useRef } from "react";
import type { WorkspaceInfo } from "../../../types";

export const REMOTE_WORKSPACE_REFRESH_INTERVAL_MS = 15_000;

type WorkspaceRefreshOptions = {
  workspaces: WorkspaceInfo[];
  refreshWorkspaces: () => Promise<WorkspaceInfo[] | void>;
  listThreadsForWorkspaces: (
    workspaces: WorkspaceInfo[],
    options?: { preserveState?: boolean; allWorkspaces?: WorkspaceInfo[] },
  ) => Promise<void>;
  backendMode?: string;
  lowBandwidthMode?: boolean;
  pollIntervalMs?: number;
  suspended?: boolean;
};

export function useWorkspaceRefreshOnFocus({
  workspaces,
  refreshWorkspaces,
  listThreadsForWorkspaces,
  backendMode = "local",
  lowBandwidthMode = false,
  pollIntervalMs = REMOTE_WORKSPACE_REFRESH_INTERVAL_MS,
  suspended = false,
}: WorkspaceRefreshOptions) {
  const optionsRef = useRef({
    workspaces,
    refreshWorkspaces,
    listThreadsForWorkspaces,
    backendMode,
    lowBandwidthMode,
    pollIntervalMs,
    suspended,
  });
  useEffect(() => {
    optionsRef.current = {
      workspaces,
      refreshWorkspaces,
      listThreadsForWorkspaces,
      backendMode,
      lowBandwidthMode,
      pollIntervalMs,
      suspended,
    };
  });

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let refreshInFlight = false;

    const runRefreshCycle = () => {
      if (refreshInFlight) {
        return;
      }
      if (optionsRef.current.suspended) {
        return;
      }
      refreshInFlight = true;
      const {
        workspaces: ws,
        refreshWorkspaces: refresh,
        listThreadsForWorkspaces: listThreads,
      } = optionsRef.current;
      void (async () => {
        let latestWorkspaces = ws;
        try {
          const entries = await refresh();
          if (entries) {
            latestWorkspaces = entries;
          }
        } catch {
          // Silent: refresh errors show in debug panel.
        }
        const connected = latestWorkspaces.filter((entry) => entry.connected);
        if (connected.length > 0) {
          await listThreads(connected, {
            preserveState: true,
            allWorkspaces: latestWorkspaces,
          });
        }
      })().finally(() => {
        refreshInFlight = false;
      });
    };

    const updatePolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      const {
        backendMode: currentBackendMode,
        lowBandwidthMode: currentLowBandwidthMode,
        pollIntervalMs: intervalMs,
      } = optionsRef.current;
      if (
        optionsRef.current.suspended ||
        currentLowBandwidthMode ||
        currentBackendMode !== "remote" ||
        document.visibilityState !== "visible"
      ) {
        return;
      }
      pollTimer = setInterval(() => {
        runRefreshCycle();
      }, intervalMs);
    };

    const scheduleRefresh = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        runRefreshCycle();
      }, 500);
    };

    const handleFocus = () => {
      scheduleRefresh();
      updatePolling();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
      }
      updatePolling();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    updatePolling();
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [backendMode, lowBandwidthMode, pollIntervalMs, suspended]);
}
