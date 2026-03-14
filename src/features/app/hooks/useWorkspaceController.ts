import { useCallback } from "react";
import { useWorkspaces } from "../../workspaces/hooks/useWorkspaces";
import type { AppSettings, WorkspaceInfo } from "../../../types";
import type { DebugEntry } from "../../../types";
import { useWorkspaceDialogs } from "./useWorkspaceDialogs";
import { isMobilePlatform } from "../../../utils/platformPaths";

type WorkspaceControllerOptions = {
  appSettings: AppSettings;
  addDebugEntry: (entry: DebugEntry) => void;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
  suspendInitialRefresh?: boolean;
  onRemoteSetupRequired?: (message?: string | null) => void;
};

export function useWorkspaceController({
  appSettings,
  addDebugEntry,
  queueSaveSettings,
  suspendInitialRefresh = false,
  onRemoteSetupRequired,
}: WorkspaceControllerOptions) {
  const workspaceCore = useWorkspaces({
    onDebug: addDebugEntry,
    appSettings,
    onUpdateAppSettings: queueSaveSettings,
    suspendInitialRefresh,
    onRemoteSetupRequired,
  });

  const {
    workspaces,
    addWorkspacesFromPaths: addWorkspacesFromPathsCore,
    removeWorkspace: removeWorkspaceCore,
    removeWorktree: removeWorktreeCore,
  } = workspaceCore;

  const {
    requestWorkspacePaths,
    mobileRemoteWorkspacePathPrompt,
    updateMobileRemoteWorkspacePathInput,
    cancelMobileRemoteWorkspacePathPrompt,
    submitMobileRemoteWorkspacePathPrompt,
    appendMobileRemoteWorkspacePathFromRecent,
    rememberRecentMobileRemoteWorkspacePaths,
    directoryBrowserPrompt,
    onDirectoryBrowserNavigate,
    onDirectoryBrowserConfirm,
    onDirectoryBrowserCancel,
    showAddWorkspacesResult,
    confirmWorkspaceRemoval,
    confirmWorktreeRemoval,
    showWorkspaceRemovalError,
    showWorktreeRemovalError,
  } = useWorkspaceDialogs();

  const runAddWorkspacesFromPaths = useCallback(
    async (
      paths: string[],
      options?: { rememberMobileRemoteRecents?: boolean },
    ) => {
      const result = await addWorkspacesFromPathsCore(paths);
      await showAddWorkspacesResult(result);
      if (options?.rememberMobileRemoteRecents && result.added.length > 0) {
        rememberRecentMobileRemoteWorkspacePaths(result.added.map((entry) => entry.path));
      }
      return result;
    },
    [
      addWorkspacesFromPathsCore,
      rememberRecentMobileRemoteWorkspacePaths,
      showAddWorkspacesResult,
    ],
  );

  const addWorkspacesFromPaths = useCallback(
    async (paths: string[]): Promise<WorkspaceInfo | null> => {
      const result = await runAddWorkspacesFromPaths(paths);
      return result.firstAdded;
    },
    [runAddWorkspacesFromPaths],
  );

  const addWorkspace = useCallback(async (): Promise<WorkspaceInfo | null> => {
    const paths = await requestWorkspacePaths(appSettings.backendMode);
    if (paths.length === 0) {
      return null;
    }
    const result = await runAddWorkspacesFromPaths(paths, {
      rememberMobileRemoteRecents: isMobilePlatform() && appSettings.backendMode === "remote",
    });
    return result.firstAdded;
  }, [appSettings.backendMode, requestWorkspacePaths, runAddWorkspacesFromPaths]);

  const removeWorkspace = useCallback(
    async (workspaceId: string) => {
      const confirmed = await confirmWorkspaceRemoval(workspaces, workspaceId);
      if (!confirmed) {
        return;
      }
      try {
        await removeWorkspaceCore(workspaceId);
      } catch (error) {
        await showWorkspaceRemovalError(error);
      }
    },
    [confirmWorkspaceRemoval, removeWorkspaceCore, showWorkspaceRemovalError, workspaces],
  );

  const removeWorktree = useCallback(
    async (workspaceId: string) => {
      const confirmed = await confirmWorktreeRemoval(workspaces, workspaceId);
      if (!confirmed) {
        return;
      }
      try {
        await removeWorktreeCore(workspaceId);
      } catch (error) {
        await showWorktreeRemovalError(error);
      }
    },
    [confirmWorktreeRemoval, removeWorktreeCore, showWorktreeRemovalError, workspaces],
  );

  return {
    ...workspaceCore,
    addWorkspace,
    addWorkspacesFromPaths,
    mobileRemoteWorkspacePathPrompt,
    updateMobileRemoteWorkspacePathInput,
    cancelMobileRemoteWorkspacePathPrompt,
    submitMobileRemoteWorkspacePathPrompt,
    appendMobileRemoteWorkspacePathFromRecent,
    directoryBrowserPrompt,
    onDirectoryBrowserNavigate,
    onDirectoryBrowserConfirm,
    onDirectoryBrowserCancel,
    removeWorkspace,
    removeWorktree,
  };
}
