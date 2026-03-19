// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { useSystemNotificationThreadLinks } from "./useSystemNotificationThreadLinks";

function makeWorkspace(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return {
    id: "ws-1",
    name: "Workspace",
    path: "/tmp/workspace",
    connected: true,
    settings: { sidebarCollapsed: false },
    ...overrides,
  };
}

describe("useSystemNotificationThreadLinks", () => {
  it("navigates to the thread when the app regains focus", async () => {
    const workspace = makeWorkspace({ connected: true });
    const workspacesById = new Map([[workspace.id, workspace]]);

    const refreshWorkspaces = vi.fn(async () => [workspace]);
    const connectWorkspace = vi.fn(async () => {});
    const openThreadLink = vi.fn();

    const { result } = renderHook(() =>
      useSystemNotificationThreadLinks({
        hasLoadedWorkspaces: true,
        workspacesById,
        refreshWorkspaces,
        connectWorkspace,
        openThreadLink,
      }),
    );

    act(() => {
      result.current.recordPendingThreadLink("ws-1", "t-1");
    });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(openThreadLink).toHaveBeenCalledWith("ws-1", "t-1");
    expect(connectWorkspace).not.toHaveBeenCalled();
    expect(refreshWorkspaces).not.toHaveBeenCalled();
  });

  it("connects the workspace before selecting the thread when needed", async () => {
    const workspace = makeWorkspace({ connected: false });
    const workspacesById = new Map([[workspace.id, workspace]]);

    const refreshWorkspaces = vi.fn(async () => [workspace]);
    const connectWorkspace = vi.fn(async () => {});
    const openThreadLink = vi.fn();

    const { result } = renderHook(() =>
      useSystemNotificationThreadLinks({
        hasLoadedWorkspaces: true,
        workspacesById,
        refreshWorkspaces,
        connectWorkspace,
        openThreadLink,
      }),
    );

    act(() => {
      result.current.recordPendingThreadLink("ws-1", "t-1");
    });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await Promise.resolve();
    });

    expect(connectWorkspace).toHaveBeenCalledTimes(1);
    expect(openThreadLink).toHaveBeenCalledWith("ws-1", "t-1");
  });

  it("navigates immediately when openThreadLinkOrQueue is used after load", async () => {
    const workspace = makeWorkspace({ connected: true });
    const workspacesById = new Map([[workspace.id, workspace]]);

    const refreshWorkspaces = vi.fn(async () => [workspace]);
    const connectWorkspace = vi.fn(async () => {});
    const openThreadLink = vi.fn();

    const { result } = renderHook(() =>
      useSystemNotificationThreadLinks({
        hasLoadedWorkspaces: true,
        workspacesById,
        refreshWorkspaces,
        connectWorkspace,
        openThreadLink,
      }),
    );

    await act(async () => {
      result.current.openThreadLinkOrQueue("ws-1", "t-2");
      await Promise.resolve();
    });

    expect(openThreadLink).toHaveBeenCalledWith("ws-1", "t-2");
  });

  it("opens a thread from notification metadata when both workspace and thread ids exist", async () => {
    const workspace = makeWorkspace({ connected: true });
    const workspacesById = new Map([[workspace.id, workspace]]);

    const refreshWorkspaces = vi.fn(async () => [workspace]);
    const connectWorkspace = vi.fn(async () => {});
    const openThreadLink = vi.fn();

    const { result } = renderHook(() =>
      useSystemNotificationThreadLinks({
        hasLoadedWorkspaces: true,
        workspacesById,
        refreshWorkspaces,
        connectWorkspace,
        openThreadLink,
      }),
    );

    await act(async () => {
      result.current.openThreadLinkFromNotification({
        workspaceId: "ws-1",
        threadId: "t-3",
      });
      await Promise.resolve();
    });

    expect(openThreadLink).toHaveBeenCalledWith("ws-1", "t-3");
  });

  it("ignores notification metadata without a thread id", async () => {
    const workspace = makeWorkspace({ connected: true });
    const workspacesById = new Map([[workspace.id, workspace]]);

    const refreshWorkspaces = vi.fn(async () => [workspace]);
    const connectWorkspace = vi.fn(async () => {});
    const openThreadLink = vi.fn();

    const { result } = renderHook(() =>
      useSystemNotificationThreadLinks({
        hasLoadedWorkspaces: true,
        workspacesById,
        refreshWorkspaces,
        connectWorkspace,
        openThreadLink,
      }),
    );

    await act(async () => {
      result.current.openThreadLinkFromNotification({
        workspaceId: "ws-1",
      });
      await Promise.resolve();
    });

    expect(openThreadLink).not.toHaveBeenCalled();
  });
});
