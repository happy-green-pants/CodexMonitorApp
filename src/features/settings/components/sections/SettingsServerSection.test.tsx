// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/types";
import { SettingsServerSection } from "./SettingsServerSection";

const baseSettings = {
  backendMode: "remote",
  remoteBackendProvider: "http",
  remoteBackendHost: "https://codex.example.com",
  remoteBackendToken: "token-1",
  keepDaemonRunningAfterAppClose: false,
} as AppSettings;

describe("SettingsServerSection", () => {
  it("shows endpoint-first controls for mobile/web remotes", () => {
    render(
      <SettingsServerSection
        appSettings={baseSettings}
        onUpdateAppSettings={vi.fn().mockResolvedValue(undefined)}
        isMobilePlatform
        supportsDesktopControls={false}
        mobileConnectBusy={false}
        mobileConnectStatusText={null}
        mobileConnectStatusError={false}
        remoteBackends={[
          {
            id: "remote-web",
            name: "Remote web",
            provider: "http",
            host: "https://codex.example.com",
            token: "token-1",
            lastConnectedAtMs: null,
          },
        ]}
        activeRemoteBackendId="remote-web"
        remoteStatusText={null}
        remoteStatusError={false}
        remoteNameError={null}
        remoteHostError={null}
        remoteNameDraft="Remote web"
        remoteProviderDraft="http"
        remoteHostDraft="https://codex.example.com"
        remoteTokenDraft="token-1"
        nextRemoteNameSuggestion="Remote 2"
        tailscaleStatus={null}
        tailscaleStatusBusy={false}
        tailscaleStatusError={null}
        tailscaleCommandPreview={null}
        tailscaleCommandBusy={false}
        tailscaleCommandError={null}
        tcpDaemonStatus={null}
        tcpDaemonBusyAction={null}
        onSetRemoteNameDraft={vi.fn()}
        onSetRemoteProviderDraft={vi.fn()}
        onSetRemoteHostDraft={vi.fn()}
        onSetRemoteTokenDraft={vi.fn()}
        onCommitRemoteName={vi.fn().mockResolvedValue(undefined)}
        onCommitRemoteHost={vi.fn().mockResolvedValue(undefined)}
        onCommitRemoteToken={vi.fn().mockResolvedValue(undefined)}
        onSelectRemoteBackend={vi.fn().mockResolvedValue(undefined)}
        onAddRemoteBackend={vi.fn().mockResolvedValue(undefined)}
        onMoveRemoteBackend={vi.fn().mockResolvedValue(undefined)}
        onDeleteRemoteBackend={vi.fn().mockResolvedValue(undefined)}
        onRefreshTailscaleStatus={vi.fn()}
        onRefreshTailscaleCommandPreview={vi.fn()}
        onUseSuggestedTailscaleHost={vi.fn().mockResolvedValue(undefined)}
        onTcpDaemonStart={vi.fn().mockResolvedValue(undefined)}
        onTcpDaemonStop={vi.fn().mockResolvedValue(undefined)}
        onTcpDaemonStatus={vi.fn().mockResolvedValue(undefined)}
        onMobileConnectTest={vi.fn()}
      />,
    );

    expect(screen.getByText("Remote server / Endpoint")).toBeTruthy();
    expect((screen.getByLabelText("Remote provider") as HTMLSelectElement).value).toBe("http");
    expect(screen.getByPlaceholderText("https://codex.example.com")).toBeTruthy();
    expect(screen.queryByText(/Tailscale/i)).toBeNull();
  });

  it("renders and toggles the low bandwidth mode switch", async () => {
    const onUpdateAppSettings = vi.fn().mockResolvedValue(undefined);

    render(
      <SettingsServerSection
        appSettings={{
          ...baseSettings,
          remoteLowBandwidthMode: false,
        }}
        onUpdateAppSettings={onUpdateAppSettings}
        isMobilePlatform={false}
        supportsDesktopControls
        mobileConnectBusy={false}
        mobileConnectStatusText={null}
        mobileConnectStatusError={false}
        remoteBackends={[
          {
            id: "remote-tcp",
            name: "Remote tcp",
            provider: "tcp",
            host: "127.0.0.1:4732",
            token: "token-1",
            lastConnectedAtMs: null,
          },
        ]}
        activeRemoteBackendId="remote-tcp"
        remoteStatusText={null}
        remoteStatusError={false}
        remoteNameError={null}
        remoteHostError={null}
        remoteNameDraft="Remote tcp"
        remoteProviderDraft="tcp"
        remoteHostDraft="127.0.0.1:4732"
        remoteTokenDraft="token-1"
        nextRemoteNameSuggestion="Remote 2"
        tailscaleStatus={null}
        tailscaleStatusBusy={false}
        tailscaleStatusError={null}
        tailscaleCommandPreview={null}
        tailscaleCommandBusy={false}
        tailscaleCommandError={null}
        tcpDaemonStatus={null}
        tcpDaemonBusyAction={null}
        onSetRemoteNameDraft={vi.fn()}
        onSetRemoteProviderDraft={vi.fn()}
        onSetRemoteHostDraft={vi.fn()}
        onSetRemoteTokenDraft={vi.fn()}
        onCommitRemoteName={vi.fn().mockResolvedValue(undefined)}
        onCommitRemoteHost={vi.fn().mockResolvedValue(undefined)}
        onCommitRemoteToken={vi.fn().mockResolvedValue(undefined)}
        onSelectRemoteBackend={vi.fn().mockResolvedValue(undefined)}
        onAddRemoteBackend={vi.fn().mockResolvedValue(undefined)}
        onMoveRemoteBackend={vi.fn().mockResolvedValue(undefined)}
        onDeleteRemoteBackend={vi.fn().mockResolvedValue(undefined)}
        onRefreshTailscaleStatus={vi.fn()}
        onRefreshTailscaleCommandPreview={vi.fn()}
        onUseSuggestedTailscaleHost={vi.fn().mockResolvedValue(undefined)}
        onTcpDaemonStart={vi.fn().mockResolvedValue(undefined)}
        onTcpDaemonStop={vi.fn().mockResolvedValue(undefined)}
        onTcpDaemonStatus={vi.fn().mockResolvedValue(undefined)}
        onMobileConnectTest={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: "Remote low bandwidth mode",
    });
    fireEvent.click(toggle);

    expect(onUpdateAppSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        remoteLowBandwidthMode: true,
      }),
    );
  });
});
