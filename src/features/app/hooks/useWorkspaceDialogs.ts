import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ask, message } from "@tauri-apps/plugin-dialog";
import type { DirectoryEntry, WorkspaceInfo } from "../../../types";
import { isMobilePlatform } from "../../../utils/platformPaths";
import { listDirectoryEntries, pickWorkspacePaths } from "../../../services/tauri";
import type { AddWorkspacesFromPathsResult } from "../../workspaces/hooks/useWorkspaceCrud";

const RECENT_REMOTE_WORKSPACE_PATHS_STORAGE_KEY = "mobile-remote-workspace-recent-paths";
const RECENT_REMOTE_WORKSPACE_PATHS_LIMIT = 5;

function isBrowserRuntime() {
  return typeof window !== "undefined" && !isTauri();
}

function isRemoteUnavailableError(error: unknown) {
  if (error instanceof TypeError) {
    return error.message.includes("Failed to fetch") || error.message.includes("NetworkError");
  }
  if (error instanceof Error) {
    return error.message.includes("Remote server is unreachable");
  }
  return false;
}

function parseWorkspacePathInput(value: string) {
  const stripWrappingQuotes = (entry: string) => {
    const trimmed = entry.trim();
    if (trimmed.length < 2) {
      return trimmed;
    }
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === "'" || first === '"') && first === last) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };

  return value
    .split(/\r?\n|,|;/)
    .map((entry) => stripWrappingQuotes(entry))
    .filter(Boolean);
}

function appendPathIfMissing(value: string, path: string) {
  const trimmedPath = path.trim();
  if (!trimmedPath) {
    return value;
  }
  const entries = parseWorkspacePathInput(value);
  if (entries.includes(trimmedPath)) {
    return value;
  }
  return [...entries, trimmedPath].join("\n");
}

function loadRecentRemoteWorkspacePaths(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(RECENT_REMOTE_WORKSPACE_PATHS_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, RECENT_REMOTE_WORKSPACE_PATHS_LIMIT);
  } catch {
    return [];
  }
}

function persistRecentRemoteWorkspacePaths(paths: string[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(
    RECENT_REMOTE_WORKSPACE_PATHS_STORAGE_KEY,
    JSON.stringify(paths),
  );
}

function mergeRecentRemoteWorkspacePaths(current: string[], nextPaths: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  const push = (entry: string) => {
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    merged.push(trimmed);
  };
  nextPaths.forEach(push);
  current.forEach(push);
  return merged.slice(0, RECENT_REMOTE_WORKSPACE_PATHS_LIMIT);
}

type MobileRemoteWorkspacePathPromptState = {
  value: string;
  error: string | null;
  recentPaths: string[];
} | null;

type DirectoryBrowserPromptState = {
  currentPath: string | null;
  entries: DirectoryEntry[];
  isLoading: boolean;
  error: string | null;
} | null;

export function useWorkspaceDialogs() {
  const [recentMobileRemoteWorkspacePaths, setRecentMobileRemoteWorkspacePaths] = useState<
    string[]
  >(() => loadRecentRemoteWorkspacePaths());
  const [mobileRemoteWorkspacePathPrompt, setMobileRemoteWorkspacePathPrompt] =
    useState<MobileRemoteWorkspacePathPromptState>(null);
  const [directoryBrowserPrompt, setDirectoryBrowserPrompt] =
    useState<DirectoryBrowserPromptState>(null);
  const mobileRemoteWorkspacePathResolveRef = useRef<((paths: string[]) => void) | null>(
    null,
  );
  const directoryBrowserResolveRef = useRef<((paths: string[]) => void) | null>(null);

  const resolveMobileRemoteWorkspacePathRequest = useCallback((paths: string[]) => {
    const resolve = mobileRemoteWorkspacePathResolveRef.current;
    mobileRemoteWorkspacePathResolveRef.current = null;
    if (resolve) {
      resolve(paths);
    }
  }, []);

  const resolveDirectoryBrowserRequest = useCallback((paths: string[]) => {
    const resolve = directoryBrowserResolveRef.current;
    directoryBrowserResolveRef.current = null;
    if (resolve) {
      resolve(paths);
    }
  }, []);

  const requestMobileRemoteWorkspacePaths = useCallback(() => {
    if (mobileRemoteWorkspacePathResolveRef.current) {
      resolveMobileRemoteWorkspacePathRequest([]);
    }

    setMobileRemoteWorkspacePathPrompt({
      value: "",
      error: null,
      recentPaths: recentMobileRemoteWorkspacePaths,
    });

    return new Promise<string[]>((resolve) => {
      mobileRemoteWorkspacePathResolveRef.current = resolve;
    });
  }, [recentMobileRemoteWorkspacePaths, resolveMobileRemoteWorkspacePathRequest]);

  const updateMobileRemoteWorkspacePathInput = useCallback((value: string) => {
    setMobileRemoteWorkspacePathPrompt((prev) =>
      prev
        ? {
            ...prev,
            value,
            error: null,
          }
        : prev,
    );
  }, []);

  const cancelMobileRemoteWorkspacePathPrompt = useCallback(() => {
    setMobileRemoteWorkspacePathPrompt(null);
    resolveMobileRemoteWorkspacePathRequest([]);
  }, [resolveMobileRemoteWorkspacePathRequest]);

  const appendMobileRemoteWorkspacePathFromRecent = useCallback((path: string) => {
    setMobileRemoteWorkspacePathPrompt((prev) =>
      prev
        ? {
            ...prev,
            value: appendPathIfMissing(prev.value, path),
            error: null,
          }
        : prev,
    );
  }, []);

  const rememberRecentMobileRemoteWorkspacePaths = useCallback((paths: string[]) => {
    setRecentMobileRemoteWorkspacePaths((prev) => {
      const next = mergeRecentRemoteWorkspacePaths(prev, paths);
      persistRecentRemoteWorkspacePaths(next);
      return next;
    });
    setMobileRemoteWorkspacePathPrompt((prev) =>
      prev
        ? {
            ...prev,
            recentPaths: mergeRecentRemoteWorkspacePaths(prev.recentPaths, paths),
          }
        : prev,
    );
  }, []);

  const submitMobileRemoteWorkspacePathPrompt = useCallback(() => {
    if (!mobileRemoteWorkspacePathPrompt) {
      return;
    }
    const paths = parseWorkspacePathInput(mobileRemoteWorkspacePathPrompt.value);
    if (paths.length === 0) {
      setMobileRemoteWorkspacePathPrompt((prev) =>
        prev
          ? {
              ...prev,
              error: "Enter at least one absolute directory path.",
            }
          : prev,
      );
      return;
    }
    setMobileRemoteWorkspacePathPrompt(null);
    resolveMobileRemoteWorkspacePathRequest(paths);
  }, [mobileRemoteWorkspacePathPrompt, resolveMobileRemoteWorkspacePathRequest]);

  const navigateDirectoryBrowser = useCallback(async (path: string | null) => {
    setDirectoryBrowserPrompt((prev) => ({
      currentPath: path,
      entries: prev?.entries ?? [],
      isLoading: true,
      error: null,
    }));

    try {
      const result = await listDirectoryEntries(path, { limit: 200, showHidden: false });
      setDirectoryBrowserPrompt({
        currentPath: result.currentPath,
        entries: result.entries,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Remote server is unreachable.";
      const friendlyMessage = isRemoteUnavailableError(error)
        ? "Remote server is unreachable. Check Settings → Server and ensure the remote backend is running."
        : errorMessage.trim().length > 0
          ? errorMessage
          : "Remote server is unreachable. Check Settings → Server.";
      setDirectoryBrowserPrompt((prev) => ({
        currentPath: prev?.currentPath ?? path,
        entries: prev?.entries ?? [],
        isLoading: false,
        error: friendlyMessage,
      }));
    }
  }, []);

  const requestDirectoryBrowserPaths = useCallback(() => {
    if (directoryBrowserResolveRef.current) {
      resolveDirectoryBrowserRequest([]);
    }
    void navigateDirectoryBrowser(null);
    return new Promise<string[]>((resolve) => {
      directoryBrowserResolveRef.current = resolve;
    });
  }, [navigateDirectoryBrowser, resolveDirectoryBrowserRequest]);

  const confirmDirectoryBrowserSelection = useCallback(
    (path: string) => {
      setDirectoryBrowserPrompt(null);
      resolveDirectoryBrowserRequest([path]);
    },
    [resolveDirectoryBrowserRequest],
  );

  const cancelDirectoryBrowserPrompt = useCallback(() => {
    setDirectoryBrowserPrompt(null);
    resolveDirectoryBrowserRequest([]);
  }, [resolveDirectoryBrowserRequest]);

  useEffect(() => {
    return () => {
      resolveMobileRemoteWorkspacePathRequest([]);
      resolveDirectoryBrowserRequest([]);
    };
  }, [resolveDirectoryBrowserRequest, resolveMobileRemoteWorkspacePathRequest]);

  const requestWorkspacePaths = useCallback(
    async (backendMode?: string) => {
      if (backendMode === "remote" && isBrowserRuntime()) {
        return requestDirectoryBrowserPaths();
      }
      if (backendMode === "remote" && isMobilePlatform()) {
        return requestMobileRemoteWorkspacePaths();
      }
      return pickWorkspacePaths();
    },
    [requestDirectoryBrowserPaths, requestMobileRemoteWorkspacePaths],
  );

  const showAddWorkspacesResult = useCallback(
    async (result: AddWorkspacesFromPathsResult) => {
      const hasIssues =
        result.skippedExisting.length > 0 ||
        result.skippedInvalid.length > 0 ||
        result.failures.length > 0;
      if (!hasIssues) {
        return;
      }

      const lines: string[] = [];
      lines.push(
        `Added ${result.added.length} workspace${result.added.length === 1 ? "" : "s"}.`,
      );
      if (result.skippedExisting.length > 0) {
        lines.push(
          `Skipped ${result.skippedExisting.length} already added workspace${
            result.skippedExisting.length === 1 ? "" : "s"
          }.`,
        );
      }
      if (result.skippedInvalid.length > 0) {
        lines.push(
          `Skipped ${result.skippedInvalid.length} invalid path${
            result.skippedInvalid.length === 1 ? "" : "s"
          } (not a folder).`,
        );
      }
      if (result.failures.length > 0) {
        lines.push(
          `Failed to add ${result.failures.length} workspace${
            result.failures.length === 1 ? "" : "s"
          }.`,
        );
        const details = result.failures
          .slice(0, 3)
          .map(({ path, message: failureMessage }) => `- ${path}: ${failureMessage}`);
        if (result.failures.length > 3) {
          details.push(`- …and ${result.failures.length - 3} more`);
        }
        lines.push("");
        lines.push("Failures:");
        lines.push(...details);
      }

      const title =
        result.failures.length > 0
          ? "Some workspaces failed to add"
          : "Some workspaces were skipped";
      try {
        await message(lines.join("\n"), {
          title,
          kind: result.failures.length > 0 ? "error" : "warning",
        });
      } catch {
        if (typeof window !== "undefined") {
          window.alert(`${title}\n\n${lines.join("\n")}`);
        }
      }
    },
    [],
  );

  const confirmWorkspaceRemoval = useCallback(
    async (workspaces: WorkspaceInfo[], workspaceId: string) => {
      const workspace = workspaces.find((entry) => entry.id === workspaceId);
      const workspaceName = workspace?.name || "this workspace";
      const worktreeCount = workspaces.filter(
        (entry) => entry.parentId === workspaceId,
      ).length;
      const detail =
        worktreeCount > 0
          ? `\n\nThis will also delete ${worktreeCount} worktree${
              worktreeCount === 1 ? "" : "s"
            } on disk.`
          : "";
      const promptText = `Are you sure you want to delete "${workspaceName}"?\n\nThis will remove the workspace from CodexMonitor.${detail}`;

      try {
        return await ask(promptText, {
          title: "Delete Workspace",
          kind: "warning",
          okLabel: "Delete",
          cancelLabel: "Cancel",
        });
      } catch {
        if (typeof window !== "undefined") {
          return window.confirm(promptText);
        }
        return false;
      }
    },
    [],
  );

  const confirmWorktreeRemoval = useCallback(
    async (workspaces: WorkspaceInfo[], workspaceId: string) => {
      const workspace = workspaces.find((entry) => entry.id === workspaceId);
      const workspaceName = workspace?.name || "this worktree";
      const promptText = `Are you sure you want to delete "${workspaceName}"?\n\nThis will close the agent, remove its worktree, and delete it from CodexMonitor.`;
      try {
        return await ask(promptText, {
          title: "Delete Worktree",
          kind: "warning",
          okLabel: "Delete",
          cancelLabel: "Cancel",
        });
      } catch {
        if (typeof window !== "undefined") {
          return window.confirm(promptText);
        }
        return false;
      }
    },
    [],
  );

  const showWorkspaceRemovalError = useCallback(async (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      await message(errorMessage, {
        title: "Delete workspace failed",
        kind: "error",
      });
    } catch {
      if (typeof window !== "undefined") {
        window.alert(`Delete workspace failed\n\n${errorMessage}`);
      }
    }
  }, []);

  const showWorktreeRemovalError = useCallback(async (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    try {
      await message(errorMessage, {
        title: "Delete worktree failed",
        kind: "error",
      });
    } catch {
      if (typeof window !== "undefined") {
        window.alert(`Delete worktree failed\n\n${errorMessage}`);
      }
    }
  }, []);

  return {
    requestWorkspacePaths,
    mobileRemoteWorkspacePathPrompt,
    updateMobileRemoteWorkspacePathInput,
    cancelMobileRemoteWorkspacePathPrompt,
    submitMobileRemoteWorkspacePathPrompt,
    appendMobileRemoteWorkspacePathFromRecent,
    rememberRecentMobileRemoteWorkspacePaths,
    directoryBrowserPrompt,
    onDirectoryBrowserNavigate: navigateDirectoryBrowser,
    onDirectoryBrowserConfirm: confirmDirectoryBrowserSelection,
    onDirectoryBrowserCancel: cancelDirectoryBrowserPrompt,
    showAddWorkspacesResult,
    confirmWorkspaceRemoval,
    confirmWorktreeRemoval,
    showWorkspaceRemovalError,
    showWorktreeRemovalError,
  };
}
