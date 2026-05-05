import { useWindowDrag } from "@/features/layout/hooks/useWindowDrag";
import {
  REMOTE_WORKSPACE_REFRESH_INTERVAL_MS,
  useWorkspaceRefreshOnFocus,
} from "@/features/workspaces/hooks/useWorkspaceRefreshOnFocus";
import { useWorkspaceRestore } from "@/features/workspaces/hooks/useWorkspaceRestore";
import { useTabActivationGuard } from "@app/hooks/useTabActivationGuard";
import {
  useRemoteThreadRefreshOnFocus,
} from "@app/hooks/useRemoteThreadRefreshOnFocus";
import { isMobilePlatform } from "@/utils/platformPaths";
import type { WorkspaceInfo } from "@/types";
import { useEffect, useRef } from "react";

type UseMainAppWorkspaceLifecycleArgs = {
  activeTab: "home" | "projects" | "codex" | "git" | "log";
  isTablet: boolean;
  setActiveTab: (tab: "home" | "projects" | "codex" | "git" | "log") => void;
  workspaces: WorkspaceInfo[];
  hasLoaded: boolean;
  connectWorkspace: (workspace: WorkspaceInfo) => Promise<void>;
  listThreadsForWorkspaces: (
    workspaces: WorkspaceInfo[],
    options?: { preserveState?: boolean; maxPages?: number; allWorkspaces?: WorkspaceInfo[] },
  ) => Promise<void>;
  refreshWorkspaces: () => Promise<void | WorkspaceInfo[]>;
  backendMode: "local" | "remote";
  lowBandwidthMode?: boolean;
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  threadStatusById: Record<string, { isProcessing: boolean }>;
  remoteThreadConnectionState: "live" | "polling" | "disconnected";
  refreshThread: (workspaceId: string, threadId: string) => Promise<unknown>;
  suspendRemoteLoading?: boolean;
};

export function useMainAppWorkspaceLifecycle({
  activeTab,
  isTablet,
  setActiveTab,
  workspaces,
  hasLoaded,
  connectWorkspace,
  listThreadsForWorkspaces,
  refreshWorkspaces,
  backendMode,
  lowBandwidthMode = false,
  activeWorkspace,
  activeThreadId,
  threadStatusById,
  remoteThreadConnectionState,
  refreshThread,
  suspendRemoteLoading = false,
}: UseMainAppWorkspaceLifecycleArgs) {
  const activeWorkspaceRef = useRef(activeWorkspace);
  const workspacesRef = useRef(workspaces);
  const connectWorkspaceRef = useRef(connectWorkspace);
  const listThreadsForWorkspacesRef = useRef(listThreadsForWorkspaces);
  const suspendRemoteLoadingRef = useRef(suspendRemoteLoading);
  const backendModeRef = useRef(backendMode);
  const lastResumeHandledAtMsRef = useRef(0);

  useEffect(() => {
    activeWorkspaceRef.current = activeWorkspace;
    workspacesRef.current = workspaces;
    connectWorkspaceRef.current = connectWorkspace;
    listThreadsForWorkspacesRef.current = listThreadsForWorkspaces;
    suspendRemoteLoadingRef.current = suspendRemoteLoading;
    backendModeRef.current = backendMode;
  }, [
    activeWorkspace,
    backendMode,
    connectWorkspace,
    listThreadsForWorkspaces,
    suspendRemoteLoading,
    workspaces,
  ]);

  useTabActivationGuard({
    activeTab,
    isTablet,
    setActiveTab,
  });

  useWindowDrag("titlebar");

  useWorkspaceRestore({
    workspaces,
    hasLoaded,
    connectWorkspace,
    listThreadsForWorkspaces,
  });

  useWorkspaceRefreshOnFocus({
    workspaces,
    refreshWorkspaces,
    listThreadsForWorkspaces,
    backendMode,
    lowBandwidthMode,
    pollIntervalMs: REMOTE_WORKSPACE_REFRESH_INTERVAL_MS,
    suspended: suspendRemoteLoading,
  });

  useEffect(() => {
    if (!isMobilePlatform()) {
      return;
    }
    let didCleanup = false;
    let removeListener: (() => void) | null = null;

    void (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) {
          return;
        }
        const { App } = await import("@capacitor/app");
        const registration = await App.addListener(
          "appStateChange",
          (state: { isActive: boolean }) => {
            if (didCleanup || !state.isActive) {
              return;
            }
            if (backendModeRef.current !== "remote") {
              return;
            }
            if (suspendRemoteLoadingRef.current) {
              return;
            }
            const workspace = activeWorkspaceRef.current;
            if (!workspace?.id) {
              return;
            }
            const now = Date.now();
            if (now - lastResumeHandledAtMsRef.current < 2000) {
              return;
            }
            lastResumeHandledAtMsRef.current = now;

            void (async () => {
              try {
                if (!workspace.connected) {
                  await connectWorkspaceRef.current(workspace);
                }
              } catch {
                // Silent: lifecycle resume shouldn't toast.
              }
              try {
                await listThreadsForWorkspacesRef.current([workspace], {
                  preserveState: true,
                  maxPages: 1,
                  allWorkspaces: workspacesRef.current,
                });
              } catch {
                // Silent: list errors surface elsewhere.
              }
            })();
          },
        );
        if (didCleanup) {
          registration.remove();
          return;
        }
        removeListener = () => {
          registration.remove();
        };
      } catch {
        // Ignore: capacitor may be unavailable in non-native runtimes.
      }
    })();

    return () => {
      didCleanup = true;
      if (removeListener) {
        removeListener();
      }
    };
  }, []);

  useRemoteThreadRefreshOnFocus({
    backendMode,
    lowBandwidthMode,
    activeWorkspace,
    activeThreadId,
    activeThreadIsProcessing: Boolean(
      activeThreadId && threadStatusById[activeThreadId]?.isProcessing,
    ),
    remoteThreadConnectionState,
    suspendPolling:
      suspendRemoteLoading ||
      (backendMode === "remote" && remoteThreadConnectionState === "live"),
    reconnectWorkspace: connectWorkspace,
    refreshThread,
  });
}
