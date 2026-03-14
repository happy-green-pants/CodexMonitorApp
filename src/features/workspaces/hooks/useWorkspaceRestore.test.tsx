// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "@/types";
import { useWorkspaceRestore } from "./useWorkspaceRestore";

const workspace: WorkspaceInfo = {
  id: "ws-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useWorkspaceRestore", () => {
  it("restores each workspace only once across rerenders", async () => {
    const connectWorkspace = vi.fn().mockResolvedValue(undefined);
    const listThreadsForWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { rerender } = renderHook(
      ({ workspaces, hasLoaded }: { workspaces: WorkspaceInfo[]; hasLoaded: boolean }) =>
        useWorkspaceRestore({
          workspaces,
          hasLoaded,
          connectWorkspace,
          listThreadsForWorkspaces,
        }),
      {
        initialProps: { workspaces: [workspace], hasLoaded: true },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(listThreadsForWorkspaces).toHaveBeenCalledTimes(1);

    rerender({ workspaces: [{ ...workspace }], hasLoaded: true });

    await act(async () => {
      await Promise.resolve();
    });

    expect(listThreadsForWorkspaces).toHaveBeenCalledTimes(1);
  });
});
