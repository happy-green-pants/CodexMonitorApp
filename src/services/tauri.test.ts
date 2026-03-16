/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import * as notification from "@tauri-apps/plugin-notification";
import * as capacitorLocalNotifications from "@capacitor/local-notifications";
import {
  browserRemoteInvoke,
  loadBrowserRemoteSettings,
  saveBrowserRemoteSettings,
} from "./browserRemote";
import {
  exportMarkdownFile,
  addWorkspace,
  addWorkspaceFromGitUrl,
  compactThread,
  createGitHubRepo,
  fetchGit,
  forkThread,
  getAppSettings,
  getAppsList,
  getAgentsSettings,
  getExperimentalFeatureList,
  getGitHubIssues,
  getGitLog,
  getGitStatus,
  getOpenAppIcon,
  listThreads,
  listMcpServerStatus,
  readGlobalAgentsMd,
  readGlobalCodexConfigToml,
  listWorkspaces,
  openWorkspaceIn,
  readAgentMd,
  stageGitAll,
  respondToServerRequest,
  respondToUserInputRequest,
  sendUserMessage,
  steerTurn,
  sendNotification,
  setCodexFeatureFlag,
  setAgentsCoreSettings,
  setTrayRecentThreads,
  setTraySessionUsage,
  startReview,
  setThreadName,
  tailscaleDaemonStart,
  tailscaleDaemonCommandPreview,
  tailscaleDaemonStatus,
  tailscaleDaemonStop,
  tailscaleStatus,
  pickWorkspacePaths,
  pickImageFiles,
  updateAppSettings,
  writeGlobalAgentsMd,
  writeGlobalCodexConfigToml,
  createAgent,
  updateAgent,
  deleteAgent,
  readAgentConfigToml,
  readImageAsDataUrl,
  generateAgentDescription,
  writeAgentConfigToml,
  writeAgentMd,
} from "./tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: vi.fn(),
  requestPermission: vi.fn(),
  sendNotification: vi.fn(),
}));

const capacitorIsNativePlatformMock = vi.fn(() => false);
const capacitorGetPlatformMock = vi.fn(() => "web");

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => capacitorIsNativePlatformMock(),
    getPlatform: () => capacitorGetPlatformMock(),
  },
}));

vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    requestPermissions: vi.fn(),
    schedule: vi.fn(),
    createChannel: vi.fn(),
  },
}));

vi.mock("./browserRemote", () => ({
  browserRemoteInvoke: vi.fn(),
  loadBrowserRemoteSettings: vi.fn(),
  saveBrowserRemoteSettings: vi.fn(),
  shouldUseBrowserRemoteTransport: vi.fn(() => false),
}));

describe("tauri invoke wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      if (command === "get_app_settings") {
        return { backendMode: "local" };
      }
      if (command === "is_mobile_runtime") {
        return false;
      }
      return undefined;
    });
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(loadBrowserRemoteSettings).mockReturnValue({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://monitor.example.com",
      remoteBackendToken: "token-1",
      remoteBackends: [],
      activeRemoteBackendId: "remote-default",
    });
  });

  it("uses path-only payload for addWorkspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ id: "ws-1" });

    await addWorkspace("/tmp/project");

    expect(invokeMock).toHaveBeenCalledWith("add_workspace", {
      path: "/tmp/project",
    });
  });

  it("picks an image as a data URL in non-Tauri environments", async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const restoreFileReader = (() => {
      const OriginalFileReader = globalThis.FileReader;
      class MockFileReader {
        result: string | ArrayBuffer | null = null;
        onload: null | (() => void) = null;
        onerror: null | (() => void) = null;
        readAsDataURL() {
          this.result = "data:image/png;base64,MOCK";
          this.onload?.();
        }
      }
      globalThis.FileReader = MockFileReader as unknown as typeof FileReader;
      return () => {
        globalThis.FileReader = OriginalFileReader;
      };
    })();

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName.toLowerCase() !== "input") {
          return element;
        }
        const input = element as HTMLInputElement;
        const file = new File(["data"], "photo.png", { type: "image/png" });
        Object.defineProperty(input, "files", {
          value: [file],
          configurable: true,
        });
        vi.spyOn(input, "click").mockImplementation(() => {
          input.dispatchEvent(new Event("change"));
        });
        return input;
      });

    try {
      const picked = await pickImageFiles();
      expect(picked).toEqual(["data:image/png;base64,MOCK"]);
      expect(vi.mocked(open)).not.toHaveBeenCalled();
    } finally {
      createElementSpy.mockRestore();
      restoreFileReader();
    }
  });

  it("returns an empty array when browser image picking is canceled", async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    vi.useFakeTimers();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName.toLowerCase() !== "input") {
          return element;
        }
        const input = element as HTMLInputElement;
        Object.defineProperty(input, "files", {
          value: [],
          configurable: true,
        });
        vi.spyOn(input, "click").mockImplementation(() => {
          window.dispatchEvent(new Event("focus"));
        });
        return input;
      });

    try {
      const pending = pickImageFiles();
      await vi.runAllTimersAsync();
      await expect(pending).resolves.toEqual([]);
      expect(vi.mocked(open)).not.toHaveBeenCalled();
    } finally {
      createElementSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("maps payload for addWorkspaceFromGitUrl", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ id: "ws-1" });
    invokeMock.mockResolvedValueOnce({ id: "ws-2" });

    await addWorkspaceFromGitUrl(
      "https://github.com/org/repo.git",
      "/tmp/workspaces",
      "repo",
    );
    await addWorkspaceFromGitUrl("https://github.com/org/repo2.git", "/tmp/workspaces");

    expect(invokeMock).toHaveBeenNthCalledWith(1, "add_workspace_from_git_url", {
      url: "https://github.com/org/repo.git",
      destinationPath: "/tmp/workspaces",
      targetFolderName: "repo",
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "add_workspace_from_git_url", {
      url: "https://github.com/org/repo2.git",
      destinationPath: "/tmp/workspaces",
      targetFolderName: null,
    });
  });

  it("returns an empty list when workspace picker is cancelled", async () => {
    const openMock = vi.mocked(open);
    openMock.mockResolvedValueOnce(null);

    await expect(pickWorkspacePaths()).resolves.toEqual([]);
  });

  it("wraps a single workspace selection in an array", async () => {
    const openMock = vi.mocked(open);
    openMock.mockResolvedValueOnce("/tmp/project");

    await expect(pickWorkspacePaths()).resolves.toEqual(["/tmp/project"]);
  });

  it("returns multiple workspace selections as-is", async () => {
    const openMock = vi.mocked(open);
    openMock.mockResolvedValueOnce(["/tmp/one", "/tmp/two"]);

    await expect(pickWorkspacePaths()).resolves.toEqual(["/tmp/one", "/tmp/two"]);
  });

  it("returns null when markdown export is cancelled", async () => {
    const saveMock = vi.mocked(save);
    const invokeMock = vi.mocked(invoke);
    saveMock.mockResolvedValueOnce(null);

    await expect(exportMarkdownFile("# Plan")).resolves.toBeNull();
    expect(invokeMock).not.toHaveBeenCalledWith(
      "write_text_file",
      expect.anything(),
    );
  });

  it("writes markdown to the selected path", async () => {
    const saveMock = vi.mocked(save);
    const invokeMock = vi.mocked(invoke);
    saveMock.mockResolvedValueOnce("/tmp/plan.md");

    await expect(exportMarkdownFile("# Plan", "my-plan.md")).resolves.toBe("/tmp/plan.md");

    expect(saveMock).toHaveBeenCalledWith({
      title: "Export plan as Markdown",
      defaultPath: "my-plan.md",
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    expect(invokeMock).toHaveBeenCalledWith("write_text_file", {
      path: "/tmp/plan.md",
      content: "# Plan",
    });
  });

  it("maps workspace_id to workspaceId for git status", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      branchName: "main",
      files: [],
      stagedFiles: [],
      unstagedFiles: [],
      totalAdditions: 0,
      totalDeletions: 0,
    });

    await getGitStatus("ws-1");

    expect(invokeMock).toHaveBeenCalledWith("get_git_status", {
      workspaceId: "ws-1",
    });
  });

  it("maps args for createGitHubRepo", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ status: "ok", repo: "me/repo" });

    await createGitHubRepo("ws-77", "me/repo", "private", "main");

    expect(invokeMock).toHaveBeenCalledWith("create_github_repo", {
      workspaceId: "ws-77",
      repo: "me/repo",
      visibility: "private",
      branch: "main",
    });
  });

  it("maps workspace_id to workspaceId for GitHub issues", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ total: 0, issues: [] });

    await getGitHubIssues("ws-2");

    expect(invokeMock).toHaveBeenCalledWith("get_github_issues", {
      workspaceId: "ws-2",
    });
  });

  it("returns an empty list when the Tauri invoke bridge is missing", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockRejectedValueOnce(
      new TypeError("Cannot read properties of undefined (reading 'invoke')"),
    );

    await expect(listWorkspaces()).resolves.toEqual([]);
    expect(invokeMock).toHaveBeenCalledWith("list_workspaces");
  });

  it("loads app settings from browser storage outside Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(loadBrowserRemoteSettings).mockReturnValue({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
      remoteBackendToken: "token-1",
      remoteBackends: [],
      activeRemoteBackendId: "remote-default",
    });

    await expect(getAppSettings()).resolves.toMatchObject({
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
    });
  });

  it("uses browser rpc for workspace listing outside Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(browserRemoteInvoke).mockResolvedValueOnce([{ id: "ws-browser" }]);

    await expect(listWorkspaces()).resolves.toEqual([{ id: "ws-browser" }]);
    expect(browserRemoteInvoke).toHaveBeenCalledWith("list_workspaces", {});
  });

  it("persists browser app settings outside Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    vi.mocked(saveBrowserRemoteSettings).mockReturnValue({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
      remoteBackendToken: "token-2",
      remoteBackends: [],
      activeRemoteBackendId: "remote-default",
    });

    await expect(
      updateAppSettings({
        backendMode: "remote",
        remoteBackendProvider: "http",
        remoteBackendHost: "https://codex.example.com",
        remoteBackendToken: "token-2",
      } as any),
    ).resolves.toMatchObject({
      remoteBackendProvider: "http",
      remoteBackendToken: "token-2",
    });

    expect(saveBrowserRemoteSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteBackendProvider: "http",
        remoteBackendHost: "https://codex.example.com",
        remoteBackendToken: "token-2",
      }),
    );
  });

  it("applies default limit for git log", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      total: 0,
      entries: [],
      ahead: 0,
      behind: 0,
      aheadEntries: [],
      behindEntries: [],
      upstream: null,
    });

    await getGitLog("ws-3");

    expect(invokeMock).toHaveBeenCalledWith("get_git_log", {
      workspaceId: "ws-3",
      limit: 40,
    });
  });

  it("maps workspaceId and threadId for fork_thread", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await forkThread("ws-9", "thread-9");

    expect(invokeMock).toHaveBeenCalledWith("fork_thread", {
      workspaceId: "ws-9",
      threadId: "thread-9",
    });
  });

  it("maps workspaceId and threadId for compact_thread", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await compactThread("ws-10", "thread-10");

    expect(invokeMock).toHaveBeenCalledWith("compact_thread", {
      workspaceId: "ws-10",
      threadId: "thread-10",
    });
  });

  it("maps workspaceId/threadId/name for set_thread_name", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await setThreadName("ws-9", "thread-9", "New Name");

    expect(invokeMock).toHaveBeenCalledWith("set_thread_name", {
      workspaceId: "ws-9",
      threadId: "thread-9",
      name: "New Name",
    });
  });

  it("maps workspaceId/cursor/limit for list_mcp_server_status", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await listMcpServerStatus("ws-10", "cursor-1", 25);

    expect(invokeMock).toHaveBeenCalledWith("list_mcp_server_status", {
      workspaceId: "ws-10",
      cursor: "cursor-1",
      limit: 25,
    });
  });

  it("maps workspaceId/cursor/limit/sortKey for list_threads", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await listThreads("ws-10", "cursor-1", 25, "updated_at");

    expect(invokeMock).toHaveBeenCalledWith("list_threads", {
      workspaceId: "ws-10",
      cursor: "cursor-1",
      limit: 25,
      sortKey: "updated_at",
    });
  });

  it("maps entries for set_tray_recent_threads", async () => {
    const invokeMock = vi.mocked(invoke);
    const entries = [
      {
        workspaceId: "ws-1",
        workspaceLabel: "Workspace",
        threadId: "thread-1",
        threadLabel: "Alpha",
        updatedAt: 10,
      },
    ];

    await setTrayRecentThreads(entries);

    expect(invokeMock).toHaveBeenCalledWith("set_tray_recent_threads", {
      entries,
    });
  });

  it("maps usage for set_tray_session_usage", async () => {
    const invokeMock = vi.mocked(invoke);
    const usage = {
      sessionLabel: "12% used · Resets 2 hours",
      weeklyLabel: "67% used · Resets in 2 days",
    };

    await setTraySessionUsage(usage);

    expect(invokeMock).toHaveBeenCalledWith("set_tray_session_usage", {
      usage,
    });
  });

  it("maps workspaceId/cursor/limit/threadId for apps_list", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await getAppsList("ws-11", "cursor-1", 25, "thread-11");

    expect(invokeMock).toHaveBeenCalledWith("apps_list", {
      workspaceId: "ws-11",
      cursor: "cursor-1",
      limit: 25,
      threadId: "thread-11",
    });
  });

  it("maps workspaceId/cursor/limit for experimental_feature_list", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await getExperimentalFeatureList("ws-11", "cursor-2", 50);

    expect(invokeMock).toHaveBeenCalledWith("experimental_feature_list", {
      workspaceId: "ws-11",
      cursor: "cursor-2",
      limit: 50,
    });
  });

  it("maps feature key and enabled for set_codex_feature_flag", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce(undefined);

    await setCodexFeatureFlag("apps", true);

    expect(invokeMock).toHaveBeenCalledWith("set_codex_feature_flag", {
      featureKey: "apps",
      enabled: true,
    });
  });

  it("invokes stage_git_all", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await stageGitAll("ws-6");

    expect(invokeMock).toHaveBeenCalledWith("stage_git_all", {
      workspaceId: "ws-6",
    });
  });

  it("invokes fetch_git", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await fetchGit("ws-7");

    expect(invokeMock).toHaveBeenCalledWith("fetch_git", {
      workspaceId: "ws-7",
    });
  });

  it("maps openWorkspaceIn options", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await openWorkspaceIn("/tmp/project", {
      appName: "Xcode",
      args: ["--reuse-window"],
    });

    expect(invokeMock).toHaveBeenCalledWith("open_workspace_in", {
      path: "/tmp/project",
      app: "Xcode",
      command: null,
      args: ["--reuse-window"],
      line: null,
      column: null,
    });
  });

  it("passes line-aware openWorkspaceIn options", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await openWorkspaceIn("/tmp/project/src/App.tsx", {
      command: "code",
      args: ["--reuse-window"],
      line: 33,
      column: 7,
    });

    expect(invokeMock).toHaveBeenCalledWith("open_workspace_in", {
      path: "/tmp/project/src/App.tsx",
      app: null,
      command: "code",
      args: ["--reuse-window"],
      line: 33,
      column: 7,
    });
  });

  it("invokes get_open_app_icon", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce("data:image/png;base64,abc");

    await getOpenAppIcon("Xcode");

    expect(invokeMock).toHaveBeenCalledWith("get_open_app_icon", {
      appName: "Xcode",
    });
  });

  it("invokes tailscale wrappers", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValue(undefined);

    await tailscaleStatus();
    await tailscaleDaemonCommandPreview();
    await tailscaleDaemonStart();
    await tailscaleDaemonStop();
    await tailscaleDaemonStatus();

    expect(invokeMock).toHaveBeenCalledWith("tailscale_status");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_command_preview");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_start");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_stop");
    expect(invokeMock).toHaveBeenCalledWith("tailscale_daemon_status");
  });

  it("reads agent.md for a workspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ exists: true, content: "# Agent", truncated: false });

    await readAgentMd("ws-agent");

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "workspace",
      kind: "agents",
      workspaceId: "ws-agent",
    });
  });

  it("writes agent.md for a workspace", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeAgentMd("ws-agent", "# Agent");

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "workspace",
      kind: "agents",
      workspaceId: "ws-agent",
      content: "# Agent",
    });
  });

  it("reads global AGENTS.md", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ exists: true, content: "# Global", truncated: false });

    await readGlobalAgentsMd();

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "global",
      kind: "agents",
      workspaceId: undefined,
    });
  });

  it("writes global AGENTS.md", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeGlobalAgentsMd("# Global");

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "global",
      kind: "agents",
      workspaceId: undefined,
      content: "# Global",
    });
  });

  it("reads global config.toml", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({ exists: true, content: "model = \"gpt-5\"", truncated: false });

    await readGlobalCodexConfigToml();

    expect(invokeMock).toHaveBeenCalledWith("file_read", {
      scope: "global",
      kind: "config",
      workspaceId: undefined,
    });
  });

  it("writes global config.toml", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeGlobalCodexConfigToml("model = \"gpt-5\"");

    expect(invokeMock).toHaveBeenCalledWith("file_write", {
      scope: "global",
      kind: "config",
      workspaceId: undefined,
      content: "model = \"gpt-5\"",
    });
  });

  it("reads agents settings", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      configPath: "/Users/me/.codex/config.toml",
      multiAgentEnabled: true,
      maxThreads: 6,
      maxDepth: 1,
      agents: [],
    });

    await getAgentsSettings();

    expect(invokeMock).toHaveBeenCalledWith("get_agents_settings");
  });

  it("updates core agents settings", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      configPath: "/Users/me/.codex/config.toml",
      multiAgentEnabled: false,
      maxThreads: 4,
      maxDepth: 3,
      agents: [],
    });

    await setAgentsCoreSettings({
      multiAgentEnabled: false,
      maxThreads: 4,
      maxDepth: 3,
    });

    expect(invokeMock).toHaveBeenCalledWith("set_agents_core_settings", {
      input: { multiAgentEnabled: false, maxThreads: 4, maxDepth: 3 },
    });
  });

  it("creates an agent", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await createAgent({
      name: "researcher",
      description: "Research-focused role",
      developerInstructions: "Investigate root cause first.",
      template: "blank",
      model: "gpt-5-codex",
      reasoningEffort: "medium",
    });

    expect(invokeMock).toHaveBeenCalledWith("create_agent", {
      input: {
        name: "researcher",
        description: "Research-focused role",
        developerInstructions: "Investigate root cause first.",
        template: "blank",
        model: "gpt-5-codex",
        reasoningEffort: "medium",
      },
    });
  });

  it("updates an agent", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await updateAgent({
      originalName: "researcher",
      name: "code_reviewer",
      description: "Review-focused role",
      developerInstructions: "Focus on correctness and regression risk.",
      renameManagedFile: true,
    });

    expect(invokeMock).toHaveBeenCalledWith("update_agent", {
      input: {
        originalName: "researcher",
        name: "code_reviewer",
        description: "Review-focused role",
        developerInstructions: "Focus on correctness and regression risk.",
        renameManagedFile: true,
      },
    });
  });

  it("deletes an agent", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await deleteAgent({
      name: "researcher",
      deleteManagedFile: true,
    });

    expect(invokeMock).toHaveBeenCalledWith("delete_agent", {
      input: {
        name: "researcher",
        deleteManagedFile: true,
      },
    });
  });

  it("reads an agent config file", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce("model = \"gpt-5-codex\"");

    await readAgentConfigToml("researcher");

    expect(invokeMock).toHaveBeenCalledWith("read_agent_config_toml", {
      agentName: "researcher",
    });
  });

  it("writes an agent config file", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await writeAgentConfigToml("researcher", "model = \"gpt-5-codex\"");

    expect(invokeMock).toHaveBeenCalledWith("write_agent_config_toml", {
      agentName: "researcher",
      content: "model = \"gpt-5-codex\"",
    });
  });

  it("generates an improved agent description", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({
      description: "Stabilizes flaky test suites",
      developerInstructions:
        "Reproduce failures first.\nPrefer deterministic fixes.\nAdd targeted coverage.",
    });

    await generateAgentDescription("ws-agent", "tests");

    expect(invokeMock).toHaveBeenCalledWith("generate_agent_description", {
      workspaceId: "ws-agent",
      description: "tests",
    });
  });

  it("fills sendUserMessage defaults in payload", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await sendUserMessage("ws-4", "thread-1", "hello", {
      accessMode: "full-access",
      images: ["image.png"],
    });

    expect(invokeMock).toHaveBeenLastCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello",
      model: null,
      effort: null,
      accessMode: "full-access",
      images: ["image.png"],
    });
  });

  it("preserves explicit null serviceTier overrides", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await sendUserMessage("ws-4", "thread-1", "hello", {
      serviceTier: null,
    });

    expect(invokeMock).toHaveBeenLastCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello",
      model: null,
      effort: null,
      serviceTier: null,
      accessMode: null,
      images: null,
    });
  });

  it("maps read_image_as_data_url", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce("data:image/png;base64,abc");

    await readImageAsDataUrl("/tmp/image.png");

    expect(invokeMock).toHaveBeenCalledWith("read_image_as_data_url", {
      path: "/tmp/image.png",
    });
  });

  it("converts image paths before send_user_message in remote mode", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      if (command === "get_app_settings") {
        return { backendMode: "remote" };
      }
      if (command === "is_mobile_runtime") {
        return false;
      }
      if (command === "read_image_as_data_url") {
        return "data:image/png;base64,abc";
      }
      return undefined;
    });

    await sendUserMessage("ws-4", "thread-1", "hello", {
      images: ["/tmp/image.png"],
    });

    expect(invokeMock).toHaveBeenLastCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello",
      model: null,
      effort: null,
      accessMode: null,
      images: ["data:image/png;base64,abc"],
    });
  });

  it("includes app mentions when sending a message", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await sendUserMessage("ws-4", "thread-1", "hello $calendar", {
      appMentions: [{ name: "Calendar", path: "app://connector_calendar" }],
    });

    expect(invokeMock).toHaveBeenCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello $calendar",
      model: null,
      effort: null,
      accessMode: null,
      images: null,
      appMentions: [{ name: "Calendar", path: "app://connector_calendar" }],
    });
  });

  it("invokes turn_steer for steer payloads", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await steerTurn("ws-4", "thread-1", "turn-2", "continue", ["image.png"]);

    expect(invokeMock).toHaveBeenCalledWith("turn_steer", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      turnId: "turn-2",
      text: "continue",
      images: ["image.png"],
    });
  });

  it("converts image paths before turn_steer in remote mode", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      if (command === "get_app_settings") {
        return { backendMode: "remote" };
      }
      if (command === "is_mobile_runtime") {
        return false;
      }
      if (command === "read_image_as_data_url") {
        return "data:image/jpeg;base64,xyz";
      }
      return undefined;
    });

    await steerTurn("ws-4", "thread-1", "turn-2", "continue", ["/tmp/image.jpg"]);

    expect(invokeMock).toHaveBeenCalledWith("turn_steer", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      turnId: "turn-2",
      text: "continue",
      images: ["data:image/jpeg;base64,xyz"],
    });
  });

  it("converts image paths on mobile even in local backend mode", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      if (command === "get_app_settings") {
        return { backendMode: "local" };
      }
      if (command === "is_mobile_runtime") {
        return true;
      }
      if (command === "read_image_as_data_url") {
        return "data:image/png;base64,mobile";
      }
      return undefined;
    });

    await sendUserMessage("ws-4", "thread-1", "hello", {
      images: ["/private/var/mobile/sample.png"],
    });

    expect(invokeMock).toHaveBeenLastCalledWith("send_user_message", {
      workspaceId: "ws-4",
      threadId: "thread-1",
      text: "hello",
      model: null,
      effort: null,
      accessMode: null,
      images: ["data:image/png;base64,mobile"],
    });
  });

  it("fails when image conversion fails for send_user_message", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return false;
      }
      if (command === "get_app_settings") {
        return { backendMode: "remote" };
      }
      if (command === "is_mobile_runtime") {
        return false;
      }
      if (command === "read_image_as_data_url") {
        throw new Error("conversion failed");
      }
      return undefined;
    });

    await expect(
      sendUserMessage("ws-4", "thread-1", "hello", { images: ["/tmp/image.png"] }),
    ).rejects.toThrow("conversion failed");
    expect(invokeMock).not.toHaveBeenCalledWith("send_user_message", expect.anything());
  });

  it("omits delivery when starting reviews without override", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await startReview("ws-5", "thread-2", { type: "uncommittedChanges" });

    expect(invokeMock).toHaveBeenCalledWith("start_review", {
      workspaceId: "ws-5",
      threadId: "thread-2",
      target: { type: "uncommittedChanges" },
    });
  });

  it("includes delivery when starting detached reviews", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await startReview("ws-5", "thread-2", { type: "uncommittedChanges" }, "detached");

    expect(invokeMock).toHaveBeenCalledWith("start_review", {
      workspaceId: "ws-5",
      threadId: "thread-2",
      target: { type: "uncommittedChanges" },
      delivery: "detached",
    });
  });

  it("nests decisions for server request responses", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await respondToServerRequest("ws-6", 101, "accept");

    expect(invokeMock).toHaveBeenCalledWith("respond_to_server_request", {
      workspaceId: "ws-6",
      requestId: 101,
      result: { decision: "accept" },
    });
  });

  it("nests answers for user input responses", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    await respondToUserInputRequest("ws-7", 202, {
      confirm_path: { answers: ["Yes"] },
    });

    expect(invokeMock).toHaveBeenCalledWith("respond_to_server_request", {
      workspaceId: "ws-7",
      requestId: 202,
      result: {
        answers: {
          confirm_path: { answers: ["Yes"] },
        },
      },
    });
  });

  it("passes through multiple user input answers", async () => {
    const invokeMock = vi.mocked(invoke);
    invokeMock.mockResolvedValueOnce({});

    const answers = {
      confirm_path: { answers: ["Yes"] },
      notes: { answers: ["First line", "Second line"] },
    };

    await respondToUserInputRequest("ws-8", 303, answers);

    expect(invokeMock).toHaveBeenCalledWith("respond_to_server_request", {
      workspaceId: "ws-8",
      requestId: 303,
      result: {
        answers,
      },
    });
  });

  it("sends a notification without re-requesting permission when already granted", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const requestPermissionMock = vi.mocked(notification.requestPermission);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    isPermissionGrantedMock.mockResolvedValueOnce(true);

    await sendNotification("Hello", "World");

    expect(isPermissionGrantedMock).toHaveBeenCalledTimes(1);
    expect(requestPermissionMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Hello",
      body: "World",
    });
  });

  it("passes extra metadata when provided", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    isPermissionGrantedMock.mockResolvedValueOnce(true);

    await sendNotification("Hello", "World", {
      extra: { kind: "thread", workspaceId: "ws-1", threadId: "t-1" },
    });

    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Hello",
      body: "World",
      extra: { kind: "thread", workspaceId: "ws-1", threadId: "t-1" },
    });
  });

  it("requests permission once when needed and sends on grant", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const requestPermissionMock = vi.mocked(notification.requestPermission);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    isPermissionGrantedMock.mockResolvedValueOnce(false);
    requestPermissionMock.mockResolvedValueOnce("granted");

    await sendNotification("Grant", "Please");

    expect(isPermissionGrantedMock).toHaveBeenCalledTimes(1);
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).toHaveBeenCalledWith({
      title: "Grant",
      body: "Please",
    });
  });

  it("does not send and warns when permission is denied", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const requestPermissionMock = vi.mocked(notification.requestPermission);
    const sendNotificationMock = vi.mocked(notification.sendNotification);
    const invokeMock = vi.mocked(invoke);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    isPermissionGrantedMock.mockResolvedValueOnce(false);
    requestPermissionMock.mockResolvedValueOnce("denied");

    await sendNotification("Denied", "Nope");

    expect(isPermissionGrantedMock).toHaveBeenCalledTimes(1);
    expect(requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "Notification permission not granted.",
      { permission: "denied" },
    );
    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Denied",
      body: "Nope",
    });
    warnSpy.mockRestore();
  });

  it("falls back when the notification plugin throws", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const invokeMock = vi.mocked(invoke);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    isPermissionGrantedMock.mockRejectedValueOnce(new Error("boom"));

    await sendNotification("Plugin", "Failed");

    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Plugin",
      body: "Failed",
    });
    warnSpy.mockRestore();
  });

  it("prefers the fallback on macOS debug builds", async () => {
    const isPermissionGrantedMock = vi.mocked(notification.isPermissionGranted);
    const invokeMock = vi.mocked(invoke);

    invokeMock.mockImplementation(async (command: string) => {
      if (command === "is_macos_debug_build") {
        return true;
      }
      if (command === "send_notification_fallback") {
        return undefined;
      }
      return undefined;
    });

    await sendNotification("Dev", "Fallback");

    expect(invokeMock).toHaveBeenCalledWith("is_macos_debug_build");
    expect(invokeMock).toHaveBeenCalledWith("send_notification_fallback", {
      title: "Dev",
      body: "Fallback",
    });
    expect(isPermissionGrantedMock).not.toHaveBeenCalled();
  });

  it("uses Capacitor LocalNotifications when running in a Capacitor native runtime", async () => {
    const requestPermissionsMock = vi.mocked(
      capacitorLocalNotifications.LocalNotifications.requestPermissions,
    );
    const createChannelMock = vi.mocked(
      capacitorLocalNotifications.LocalNotifications.createChannel,
    );
    const scheduleMock = vi.mocked(
      capacitorLocalNotifications.LocalNotifications.schedule,
    );
    const sendNotificationMock = vi.mocked(notification.sendNotification);

    capacitorIsNativePlatformMock.mockReturnValue(true);
    capacitorGetPlatformMock.mockReturnValue("android");
    requestPermissionsMock.mockResolvedValueOnce({ display: "granted" });
    createChannelMock.mockResolvedValueOnce();
    scheduleMock.mockResolvedValueOnce({ notifications: [{ id: 123 }] });

    await sendNotification("Hello", "World", {
      autoCancel: true,
      group: "thread/ws-1",
      extra: { kind: "thread", workspaceId: "ws-1", threadId: "t-1" },
    });

    expect(requestPermissionsMock).toHaveBeenCalledTimes(1);
    expect(createChannelMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "codexmonitor" }),
    );
    expect(scheduleMock).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          title: "Hello",
          body: "World",
          autoCancel: true,
          extra: { kind: "thread", workspaceId: "ws-1", threadId: "t-1" },
          group: "thread/ws-1",
        }),
      ],
    });
    // The Tauri notification plugin should not be used in Capacitor runtime.
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });
});
