// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isTauri } from "@tauri-apps/api/core";
import type { AppSettings } from "../../../types";
import { listWorkspaces } from "../../../services/tauri";
import { isMobilePlatform } from "../../../utils/platformPaths";
import { useMobileServerSetup } from "./useMobileServerSetup";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("../../../services/tauri", () => ({
  listWorkspaces: vi.fn(),
}));

vi.mock("../../../utils/platformPaths", () => ({
  isMobilePlatform: vi.fn(() => true),
}));

const listWorkspacesMock = vi.mocked(listWorkspaces);
const isTauriMock = vi.mocked(isTauri);
const isMobilePlatformMock = vi.mocked(isMobilePlatform);

const baseSettings = {
  backendMode: "remote",
  remoteBackendProvider: "http",
  remoteBackendHost: "https://codex.example.com",
  remoteBackendToken: "token-1",
  activeRemoteBackendId: "remote-web",
  remoteBackends: [
    {
      id: "remote-web",
      name: "Primary remote",
      provider: "http",
      host: "https://codex.example.com",
      token: "token-1",
      lastConnectedAtMs: null,
    },
  ],
} as AppSettings;

describe("useMobileServerSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock.mockReturnValue(true);
    isMobilePlatformMock.mockReturnValue(true);
    listWorkspacesMock.mockResolvedValue([]);
  });

  it("keeps the configured provider when saving remote settings", async () => {
    const queueSaveSettings = vi.fn(async (next: AppSettings) => next);
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: baseSettings,
        appSettingsLoading: true,
        queueSaveSettings,
        refreshWorkspaces,
      }),
    );

    await act(async () => {
      result.current.mobileSetupWizardProps.onConnectTest();
    });

    await waitFor(() => expect(queueSaveSettings).toHaveBeenCalled());

    expect(queueSaveSettings).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        remoteBackendProvider: "http",
        remoteBackendHost: "https://codex.example.com",
        remoteBackendToken: "token-1",
      }),
    );
  });

  it("shows the setup wizard on web before a remote is configured", async () => {
    isTauriMock.mockReturnValue(false);
    isMobilePlatformMock.mockReturnValue(false);
    const queueSaveSettings = vi.fn(async (next: AppSettings) => next);
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMobileServerSetup({
        appSettings: {
          ...baseSettings,
          remoteBackendHost: "",
          remoteBackendToken: null,
        },
        appSettingsLoading: false,
        queueSaveSettings,
        refreshWorkspaces,
      }),
    );

    await waitFor(() => expect(result.current.showMobileSetupWizard).toBe(true));

    expect(result.current.isMobileRuntime).toBe(false);
    expect(result.current.requiresRemoteSetup).toBe(true);
    expect(result.current.mobileSetupWizardProps.statusError).toBe(true);
    expect(result.current.mobileSetupWizardProps.statusMessage).toContain("Enter your remote server endpoint");
    expect(listWorkspacesMock).not.toHaveBeenCalled();
  });

  it("keeps the setup wizard open after runtime setup errors", async () => {
    isTauriMock.mockReturnValue(false);
    isMobilePlatformMock.mockReturnValue(false);
    localStorage.setItem(
      "codex-monitor.browser-remote-settings.v1",
      JSON.stringify({
        backendMode: "remote",
        remoteBackendProvider: "http",
        remoteBackendHost: "https://codex.example.com",
        remoteBackendToken: null,
        remoteBackends: [],
        activeRemoteBackendId: "remote-default",
      }),
    );

    const queueSaveSettings = vi.fn(async (next: AppSettings) => next);
    const refreshWorkspaces = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(() =>
      useMobileServerSetup({
        appSettings: {
          ...baseSettings,
          remoteBackendToken: null,
        },
        appSettingsLoading: false,
        queueSaveSettings,
        refreshWorkspaces,
      }),
    );

    expect(result.current.showMobileSetupWizard).toBe(false);

    act(() => {
      result.current.notifyRemoteSetupRequired("Remote backend token is missing or invalid.");
    });

    rerender();

    expect(result.current.showMobileSetupWizard).toBe(true);
    expect(result.current.mobileSetupWizardProps.statusMessage).toContain("token is missing or invalid");
  });
});
