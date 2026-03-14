import { useCallback, useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { hasSavedBrowserRemoteSettings } from "../../../services/browserRemote";
import { listWorkspaces } from "../../../services/tauri";
import type { AppSettings } from "../../../types";
import { isMobilePlatform } from "../../../utils/platformPaths";
import type { MobileServerSetupWizardProps } from "../components/MobileServerSetupWizard";

type UseMobileServerSetupParams = {
  appSettings: AppSettings;
  appSettingsLoading: boolean;
  queueSaveSettings: (next: AppSettings) => Promise<AppSettings>;
  refreshWorkspaces: () => Promise<unknown>;
};

type UseMobileServerSetupResult = {
  isMobileRuntime: boolean;
  requiresRemoteSetup: boolean;
  showMobileSetupWizard: boolean;
  mobileSetupWizardProps: MobileServerSetupWizardProps;
  handleMobileConnectSuccess: () => Promise<void>;
  notifyRemoteSetupRequired: (message?: string | null) => void;
};

const DEFAULT_REMOTE_TCP_HOST = "127.0.0.1:4732";

function activeRemoteLastConnectedAtMs(settings: AppSettings): number | null {
  const backends = settings.remoteBackends ?? [];
  const active =
    backends.find((entry) => entry.id === settings.activeRemoteBackendId) ?? backends[0];
  return typeof active?.lastConnectedAtMs === "number" ? active.lastConnectedAtMs : null;
}

function isRemoteServerConfigured(settings: AppSettings, options: { isWebRuntime: boolean }): boolean {
  const host = settings.remoteBackendHost.trim();
  if (!host) {
    return false;
  }
  if (options.isWebRuntime) {
    return hasSavedBrowserRemoteSettings();
  }
  return (
    Boolean(settings.remoteBackendToken?.trim()) ||
    host !== DEFAULT_REMOTE_TCP_HOST ||
    activeRemoteLastConnectedAtMs(settings) !== null
  );
}

function defaultMobileSetupMessage(): string {
  return "Enter your remote server endpoint and optional token, then save to continue.";
}

function validateRemoteEndpoint(
  value: string,
  provider: AppSettings["remoteBackendProvider"],
): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return provider === "http" ? "Remote endpoint is required." : "Remote host is required.";
  }
  if (provider === "http") {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return null;
      }
    } catch {
      return "Use a full URL starting with http:// or https://.";
    }
    return "Use a full URL starting with http:// or https://.";
  }
  const match = trimmed.match(/^([^:\s]+|\[[^\]]+\]):([0-9]{1,5})$/);
  if (!match) {
    return "Use host:port (for example `server.example.com:4732`).";
  }
  const port = Number(match[2]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return "Port must be between 1 and 65535.";
  }
  return null;
}

function normalizeRemoteEndpoint(
  value: string,
  provider: AppSettings["remoteBackendProvider"],
) {
  const trimmed = value.trim();
  return provider === "http" ? trimmed.replace(/\/+$/, "") : trimmed;
}

function markActiveRemoteBackendConnected(settings: AppSettings, connectedAtMs: number): AppSettings {
  const existingBackends: AppSettings["remoteBackends"] =
    settings.remoteBackends.length > 0
      ? [...settings.remoteBackends]
      : [
          {
            id: settings.activeRemoteBackendId ?? "remote-default",
            name: "Primary remote",
            provider: settings.remoteBackendProvider,
            host: settings.remoteBackendHost,
            token: settings.remoteBackendToken,
            lastConnectedAtMs: null,
          },
        ];
  const activeIndexById =
    settings.activeRemoteBackendId == null
      ? -1
      : existingBackends.findIndex((entry) => entry.id === settings.activeRemoteBackendId);
  const activeIndex = activeIndexById >= 0 ? activeIndexById : 0;
  const active = existingBackends[activeIndex];
  existingBackends[activeIndex] = {
    ...active,
    provider: settings.remoteBackendProvider,
    host: settings.remoteBackendHost,
    token: settings.remoteBackendToken,
    lastConnectedAtMs: connectedAtMs,
  };
  return {
    ...settings,
    remoteBackends: existingBackends,
    activeRemoteBackendId: existingBackends[activeIndex]?.id ?? settings.activeRemoteBackendId,
  };
}

export function useMobileServerSetup({
  appSettings,
  appSettingsLoading,
  queueSaveSettings,
  refreshWorkspaces,
}: UseMobileServerSetupParams): UseMobileServerSetupResult {
  const isMobileRuntime = useMemo(() => isMobilePlatform(), []);
  const isWebRuntime = useMemo(() => !isTauri(), []);
  const requiresRemoteSetup = isMobileRuntime || isWebRuntime;

  const [remoteHostDraft, setRemoteHostDraft] = useState(appSettings.remoteBackendHost);
  const [remoteTokenDraft, setRemoteTokenDraft] = useState(appSettings.remoteBackendToken ?? "");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [mobileServerReady, setMobileServerReady] = useState(!requiresRemoteSetup);
  const [setupWizardDismissed, setSetupWizardDismissed] = useState(false);
  const [runtimeSetupRequiredReason, setRuntimeSetupRequiredReason] = useState<string | null>(null);

  useEffect(() => {
    if (!requiresRemoteSetup) {
      return;
    }
    setRemoteHostDraft(appSettings.remoteBackendHost);
    setRemoteTokenDraft(appSettings.remoteBackendToken ?? "");
  }, [
    appSettings.remoteBackendHost,
    appSettings.remoteBackendToken,
    requiresRemoteSetup,
  ]);

  const runConnectivityCheck = useCallback(async () => {
    if (!requiresRemoteSetup) {
      return true;
    }
    try {
      await listWorkspaces();
      try {
        await refreshWorkspaces();
      } catch {
        // Keep connectivity success if the follow-up refresh races.
      }
      setMobileServerReady(true);
      setStatusError(false);
      setStatusMessage(null);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reach remote backend.";
      setMobileServerReady(false);
      setStatusError(true);
      setStatusMessage(message);
      return false;
    }
  }, [refreshWorkspaces, requiresRemoteSetup]);

  const onConnectTest = useCallback(() => {
    void (async () => {
      if (!requiresRemoteSetup || busy) {
        return;
      }

      const nextHost = remoteHostDraft.trim();
      const nextToken = remoteTokenDraft.trim() ? remoteTokenDraft.trim() : null;

      const hostError = validateRemoteEndpoint(nextHost, appSettings.remoteBackendProvider);
      if (hostError) {
        setMobileServerReady(false);
        setStatusError(true);
        setStatusMessage(hostError);
        return;
      }

      setBusy(true);
      setSetupWizardDismissed(false);
      setRuntimeSetupRequiredReason(null);
      setStatusError(false);
      setStatusMessage(null);
      try {
        const normalizedHost = normalizeRemoteEndpoint(
          nextHost,
          appSettings.remoteBackendProvider,
        );
        setRemoteHostDraft(normalizedHost);
        const saved = await queueSaveSettings({
          ...appSettings,
          backendMode: "remote",
          remoteBackendProvider: appSettings.remoteBackendProvider,
          remoteBackendHost: normalizedHost,
          remoteBackendToken: nextToken,
        });
        setMobileServerReady(true);
        setStatusError(false);
        setStatusMessage(null);
        await queueSaveSettings(markActiveRemoteBackendConnected(saved, Date.now()));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save remote backend settings.";
        setMobileServerReady(false);
        setStatusError(true);
        setStatusMessage(message);
      } finally {
        setBusy(false);
      }
    })();
  }, [
    appSettings,
    busy,
    requiresRemoteSetup,
    queueSaveSettings,
    remoteHostDraft,
    remoteTokenDraft,
  ]);

  useEffect(() => {
    if (!requiresRemoteSetup || appSettingsLoading || busy) {
      return;
    }
    if (!isRemoteServerConfigured(appSettings, { isWebRuntime })) {
      setMobileServerReady(false);
      setChecking(false);
      setRuntimeSetupRequiredReason(null);
      setStatusError(true);
      setStatusMessage(defaultMobileSetupMessage());
      return;
    }

    if (runtimeSetupRequiredReason) {
      setMobileServerReady(false);
      setChecking(false);
      setStatusError(true);
      setStatusMessage(runtimeSetupRequiredReason);
      return;
    }

    if (setupWizardDismissed) {
      setSetupWizardDismissed(false);
    }
    setStatusError(false);
    setStatusMessage(null);
    setMobileServerReady(true);
    setChecking(false);
  }, [
    appSettings,
    appSettingsLoading,
    busy,
    isWebRuntime,
    requiresRemoteSetup,
    runtimeSetupRequiredReason,
    setupWizardDismissed,
  ]);

  const notifyRemoteSetupRequired = useCallback(
    (message?: string | null) => {
      if (!requiresRemoteSetup) {
        return;
      }
      setMobileServerReady(false);
      setSetupWizardDismissed(false);
      setChecking(false);
      setRuntimeSetupRequiredReason(message || defaultMobileSetupMessage());
      setStatusError(true);
      setStatusMessage(message || defaultMobileSetupMessage());
    },
    [requiresRemoteSetup],
  );

  const handleMobileConnectSuccess = useCallback(async () => {
    if (!requiresRemoteSetup) {
      return;
    }
    setStatusError(false);
    setStatusMessage(null);
    setMobileServerReady(true);
    setSetupWizardDismissed(false);
    setRuntimeSetupRequiredReason(null);
    try {
      await runConnectivityCheck();
    } catch {
      // Keep successful save outcome even if the refresh races.
    }
  }, [requiresRemoteSetup, runConnectivityCheck]);

  return {
    isMobileRuntime,
    requiresRemoteSetup,
    showMobileSetupWizard:
      requiresRemoteSetup && !appSettingsLoading && !mobileServerReady && !setupWizardDismissed,
    mobileSetupWizardProps: {
      remoteHostDraft,
      remoteTokenDraft,
      busy,
      checking,
      statusMessage,
      statusError,
      onClose: () => {
        if (!mobileServerReady) {
          return;
        }
        setSetupWizardDismissed(true);
      },
      onRemoteHostChange: setRemoteHostDraft,
      onRemoteTokenChange: setRemoteTokenDraft,
      onConnectTest,
      submitLabel: "Save and continue",
    },
    handleMobileConnectSuccess,
    notifyRemoteSetupRequired,
  };
}
