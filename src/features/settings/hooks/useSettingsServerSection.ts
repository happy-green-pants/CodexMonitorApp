import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type {
  AppSettings,
  TailscaleDaemonCommandPreview,
  TailscaleStatus,
  TcpDaemonStatus,
} from "@/types";
import {
  listWorkspaces,
  tailscaleDaemonCommandPreview as fetchTailscaleDaemonCommandPreview,
  tailscaleDaemonStart,
  tailscaleDaemonStatus,
  tailscaleDaemonStop,
  tailscaleStatus as fetchTailscaleStatus,
} from "@services/tauri";
import { isMobilePlatform } from "@utils/platformPaths";
import {
  buildNextRemoteName,
  buildSettingsFromRemoteBackends as buildSettingsFromRemoteBackendsSnapshot,
  createRemoteBackendId,
  getActiveRemoteBackend,
  getConfiguredRemoteBackends,
  normalizeRemoteEndpoint,
  normalizeRemoteProvider,
  validateRemoteHost,
  type RemoteBackendTarget,
} from "@/features/settings/utils/remoteBackends";

type UseSettingsServerSectionArgs = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  onMobileConnectSuccess?: () => Promise<void> | void;
};

export type AddRemoteBackendDraft = {
  name: string;
  provider: AppSettings["remoteBackendProvider"];
  host: string;
  token: string;
};

export type SettingsServerSectionProps = {
  appSettings: AppSettings;
  onUpdateAppSettings: (next: AppSettings) => Promise<void>;
  isMobilePlatform: boolean;
  supportsDesktopControls: boolean;
  mobileConnectBusy: boolean;
  mobileConnectStatusText: string | null;
  mobileConnectStatusError: boolean;
  remoteBackends: AppSettings["remoteBackends"];
  activeRemoteBackendId: string | null;
  remoteStatusText: string | null;
  remoteStatusError: boolean;
  remoteNameError: string | null;
  remoteHostError: string | null;
  remoteNameDraft: string;
  remoteProviderDraft: AppSettings["remoteBackendProvider"];
  remoteHostDraft: string;
  remoteTokenDraft: string;
  nextRemoteNameSuggestion: string;
  tailscaleStatus: TailscaleStatus | null;
  tailscaleStatusBusy: boolean;
  tailscaleStatusError: string | null;
  tailscaleCommandPreview: TailscaleDaemonCommandPreview | null;
  tailscaleCommandBusy: boolean;
  tailscaleCommandError: string | null;
  tcpDaemonStatus: TcpDaemonStatus | null;
  tcpDaemonBusyAction: "start" | "stop" | "status" | null;
  onSetRemoteNameDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteProviderDraft: (
    value: AppSettings["remoteBackendProvider"],
  ) => Promise<void>;
  onSetRemoteHostDraft: Dispatch<SetStateAction<string>>;
  onSetRemoteTokenDraft: Dispatch<SetStateAction<string>>;
  onCommitRemoteName: () => Promise<void>;
  onCommitRemoteHost: () => Promise<void>;
  onCommitRemoteToken: () => Promise<void>;
  onSelectRemoteBackend: (id: string) => Promise<void>;
  onAddRemoteBackend: (draft: AddRemoteBackendDraft) => Promise<void>;
  onMoveRemoteBackend: (id: string, direction: "up" | "down") => Promise<void>;
  onDeleteRemoteBackend: (id: string) => Promise<void>;
  onRefreshTailscaleStatus: () => void;
  onRefreshTailscaleCommandPreview: () => void;
  onUseSuggestedTailscaleHost: () => Promise<void>;
  onTcpDaemonStart: () => Promise<void>;
  onTcpDaemonStop: () => Promise<void>;
  onTcpDaemonStatus: () => Promise<void>;
  onMobileConnectTest: () => void;
};

const formatErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return fallback;
};

export const useSettingsServerSection = ({
  appSettings,
  onUpdateAppSettings,
  onMobileConnectSuccess,
}: UseSettingsServerSectionArgs): SettingsServerSectionProps => {
  const initialActiveRemoteBackend = getActiveRemoteBackend(appSettings);
  const [remoteNameDraft, setRemoteNameDraft] = useState(initialActiveRemoteBackend.name);
  const [remoteProviderDraft, setRemoteProviderDraft] = useState<
    AppSettings["remoteBackendProvider"]
  >(normalizeRemoteProvider(initialActiveRemoteBackend.provider));
  const [remoteHostDraft, setRemoteHostDraft] = useState(initialActiveRemoteBackend.host);
  const [remoteTokenDraft, setRemoteTokenDraft] = useState(initialActiveRemoteBackend.token ?? "");
  const [remoteStatusText, setRemoteStatusText] = useState<string | null>(null);
  const [remoteStatusError, setRemoteStatusError] = useState(false);
  const [remoteNameError, setRemoteNameError] = useState<string | null>(null);
  const [remoteHostError, setRemoteHostError] = useState<string | null>(null);
  const [tailscaleStatus, setTailscaleStatus] = useState<TailscaleStatus | null>(null);
  const [tailscaleStatusBusy, setTailscaleStatusBusy] = useState(false);
  const [tailscaleStatusError, setTailscaleStatusError] = useState<string | null>(null);
  const [tailscaleCommandPreview, setTailscaleCommandPreview] =
    useState<TailscaleDaemonCommandPreview | null>(null);
  const [tailscaleCommandBusy, setTailscaleCommandBusy] = useState(false);
  const [tailscaleCommandError, setTailscaleCommandError] = useState<string | null>(null);
  const [tcpDaemonStatus, setTcpDaemonStatus] = useState<TcpDaemonStatus | null>(null);
  const [tcpDaemonBusyAction, setTcpDaemonBusyAction] = useState<
    "start" | "stop" | "status" | null
  >(null);
  const [mobileConnectBusy, setMobileConnectBusy] = useState(false);
  const [mobileConnectStatusText, setMobileConnectStatusText] = useState<string | null>(null);
  const [mobileConnectStatusError, setMobileConnectStatusError] = useState(false);
  const mobilePlatform = useMemo(() => isMobilePlatform(), []);
  const supportsDesktopControls = useMemo(() => isTauri() && !mobilePlatform, [mobilePlatform]);

  const latestSettingsRef = useRef(appSettings);
  const activeRemoteBackend = useMemo(() => getActiveRemoteBackend(appSettings), [appSettings]);

  const setRemoteStatus = useCallback((message: string | null, isError = false) => {
    setRemoteStatusText(message);
    setRemoteStatusError(isError);
  }, []);

  useEffect(() => {
    latestSettingsRef.current = appSettings;
  }, [appSettings]);

  useEffect(() => {
    setRemoteNameDraft(activeRemoteBackend.name);
    setRemoteProviderDraft(normalizeRemoteProvider(activeRemoteBackend.provider));
    setRemoteHostDraft(
      normalizeRemoteEndpoint(
        activeRemoteBackend.host,
        normalizeRemoteProvider(activeRemoteBackend.provider),
      ),
    );
    setRemoteTokenDraft(activeRemoteBackend.token ?? "");
    setRemoteNameError(null);
    setRemoteHostError(null);
  }, [activeRemoteBackend]);

  const buildSettingsFromRemoteBackends = useCallback(
    (
      latestSettings: AppSettings,
      remoteBackends: RemoteBackendTarget[],
      preferredActiveId?: string | null,
    ): AppSettings => {
      return buildSettingsFromRemoteBackendsSnapshot(latestSettings, remoteBackends, {
        preferredActiveId,
        forceRemoteMode: !supportsDesktopControls,
      });
    },
    [supportsDesktopControls],
  );

  const persistRemoteBackends = useCallback(
    async (remoteBackends: RemoteBackendTarget[], preferredActiveId?: string | null) => {
      const latestSettings = latestSettingsRef.current;
      const nextSettings = buildSettingsFromRemoteBackends(
        latestSettings,
        remoteBackends,
        preferredActiveId,
      );
      const unchanged =
        nextSettings.remoteBackendHost === latestSettings.remoteBackendHost &&
        nextSettings.remoteBackendToken === latestSettings.remoteBackendToken &&
        nextSettings.backendMode === latestSettings.backendMode &&
        nextSettings.remoteBackendProvider === latestSettings.remoteBackendProvider &&
        nextSettings.activeRemoteBackendId === latestSettings.activeRemoteBackendId &&
        JSON.stringify(nextSettings.remoteBackends) === JSON.stringify(latestSettings.remoteBackends);
      if (unchanged) {
        return;
      }
      await onUpdateAppSettings(nextSettings);
      latestSettingsRef.current = nextSettings;
    },
    [buildSettingsFromRemoteBackends, onUpdateAppSettings],
  );

  const updateActiveRemoteBackend = useCallback(
    async (patch: Partial<RemoteBackendTarget>) => {
      const latestSettings = latestSettingsRef.current;
      const active = getActiveRemoteBackend(latestSettings);
      const nextBackends = [...getConfiguredRemoteBackends(latestSettings)];
      const activeIndex = nextBackends.findIndex((entry) => entry.id === active.id);
      const safeIndex = activeIndex >= 0 ? activeIndex : 0;
      nextBackends[safeIndex] = {
        ...nextBackends[safeIndex],
        ...patch,
      };
      await persistRemoteBackends(nextBackends, nextBackends[safeIndex].id);
    },
    [persistRemoteBackends],
  );

  const applyRemoteHost = async (
    rawValue: string,
    provider: AppSettings["remoteBackendProvider"],
  ) => {
    const nextHost = rawValue.trim();
    const validationError = validateRemoteHost(nextHost, provider);
    if (validationError) {
      setRemoteHostError(validationError);
      setRemoteStatus(validationError, true);
      return false;
    }
    const normalizedHost = normalizeRemoteEndpoint(nextHost, provider);
    setRemoteHostError(null);
    setRemoteHostDraft(normalizedHost);
    await updateActiveRemoteBackend({ provider, host: normalizedHost });
    setRemoteStatus(provider === "http" ? "Remote endpoint saved." : "Remote host saved.");
    return true;
  };

  const handleCommitRemoteName = async () => {
    const latestSettings = latestSettingsRef.current;
    const active = getActiveRemoteBackend(latestSettings);
    const nextName = remoteNameDraft.trim();
    if (!nextName) {
      const message = "Name is required.";
      setRemoteNameError(message);
      setRemoteStatus(message, true);
      return;
    }
    const duplicate = getConfiguredRemoteBackends(latestSettings).some(
      (entry) => entry.id !== active.id && entry.name.trim().toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      const message = `A remote named "${nextName}" already exists.`;
      setRemoteNameError(message);
      setRemoteStatus(message, true);
      return;
    }
    setRemoteNameError(null);
    setRemoteNameDraft(nextName);
    await updateActiveRemoteBackend({ name: nextName });
    setRemoteStatus(`Saved remote name "${nextName}".`);
  };

  const handleCommitRemoteHost = async () => {
    await applyRemoteHost(remoteHostDraft, remoteProviderDraft);
  };

  const handleSetRemoteProviderDraft = async (
    value: AppSettings["remoteBackendProvider"],
  ) => {
    const provider = normalizeRemoteProvider(value);
    const normalizedHost = normalizeRemoteEndpoint(remoteHostDraft, provider);
    setRemoteProviderDraft(provider);
    setRemoteHostDraft(normalizedHost);
    setRemoteHostError(null);
    setRemoteStatus(null);
    await updateActiveRemoteBackend({ provider, host: normalizedHost });
    setRemoteStatus(`Remote provider switched to ${provider.toUpperCase()}.`);
  };

  const handleCommitRemoteToken = async () => {
    const nextToken = remoteTokenDraft.trim() ? remoteTokenDraft.trim() : null;
    setRemoteTokenDraft(nextToken ?? "");
    await updateActiveRemoteBackend({ token: nextToken });
    setRemoteStatus("Remote token saved.");
  };

  const handleSelectRemoteBackend = async (id: string) => {
    const latestSettings = latestSettingsRef.current;
    const candidates = getConfiguredRemoteBackends(latestSettings);
    const selected = candidates.find((entry) => entry.id === id);
    if (!selected) {
      return;
    }
    await persistRemoteBackends(candidates, id);
    setRemoteStatus(`Active remote set to "${selected.name}".`);
  };

  const handleAddRemoteBackend = async (draft: AddRemoteBackendDraft) => {
    const latestSettings = latestSettingsRef.current;
    const existingBackends = getConfiguredRemoteBackends(latestSettings);
    const nextName = draft.name.trim();
    if (!nextName) {
      const message = "Name is required.";
      setRemoteStatus(message, true);
      throw new Error(message);
    }
    const duplicate = existingBackends.some(
      (entry) => entry.name.trim().toLowerCase() === nextName.toLowerCase(),
    );
    if (duplicate) {
      const message = `A remote named "${nextName}" already exists.`;
      setRemoteStatus(message, true);
      throw new Error(message);
    }
    const provider = normalizeRemoteProvider(draft.provider);
    const nextHost = draft.host.trim();
    const hostError = validateRemoteHost(nextHost, provider);
    if (hostError) {
      setRemoteStatus(hostError, true);
      throw new Error(hostError);
    }
    const nextToken = draft.token.trim() ? draft.token.trim() : null;
    if (!nextToken) {
      const message = "Remote backend token is required.";
      setRemoteStatus(message, true);
      throw new Error(message);
    }

    const nextId = createRemoteBackendId();
    const nextRemote: RemoteBackendTarget = {
      id: nextId,
      name: nextName,
      provider,
      host: normalizeRemoteEndpoint(nextHost, provider),
      token: nextToken,
      lastConnectedAtMs: null,
    };

    const previousSettings = latestSettings;
    const candidateBackends = [...existingBackends, nextRemote];
    const candidateSettings = buildSettingsFromRemoteBackends(
      previousSettings,
      candidateBackends,
      nextId,
    );

    let candidatePersisted = false;
    try {
      await onUpdateAppSettings(candidateSettings);
      latestSettingsRef.current = candidateSettings;
      candidatePersisted = true;

      const workspaces = await listWorkspaces();
      const workspaceCount = workspaces.length;
      const workspaceWord = workspaceCount === 1 ? "workspace" : "workspaces";
      const connectedBackends = candidateBackends.map((entry) =>
        entry.id === nextId ? { ...entry, lastConnectedAtMs: Date.now() } : entry,
      );
      const connectedSettings = buildSettingsFromRemoteBackends(
        candidateSettings,
        connectedBackends,
        nextId,
      );
      await onUpdateAppSettings(connectedSettings);
      latestSettingsRef.current = connectedSettings;
      setRemoteStatus(
        `Added "${nextName}" and connected. ${workspaceCount} ${workspaceWord} reachable on the remote backend.`,
      );
      await onMobileConnectSuccess?.();
    } catch (error) {
      if (candidatePersisted) {
        try {
          await onUpdateAppSettings(previousSettings);
          latestSettingsRef.current = previousSettings;
        } catch {
          // Keep the original connection error surfaced below.
        }
      }
      const message = formatErrorMessage(error, "Unable to connect to the new remote backend.");
      setRemoteStatus(message, true);
      throw new Error(message);
    }
  };

  const handleSetRemoteNameDraft: Dispatch<SetStateAction<string>> = (value) => {
    setRemoteNameError(null);
    setRemoteStatus(null);
    setRemoteNameDraft((previous) => (typeof value === "function" ? value(previous) : value));
  };

  const handleSetRemoteHostDraft: Dispatch<SetStateAction<string>> = (value) => {
    setRemoteHostError(null);
    setRemoteStatus(null);
    setRemoteHostDraft((previous) => (typeof value === "function" ? value(previous) : value));
  };

  const handleMoveRemoteBackend = async (id: string, direction: "up" | "down") => {
    const latestSettings = latestSettingsRef.current;
    const nextBackends = [...getConfiguredRemoteBackends(latestSettings)];
    const index = nextBackends.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nextBackends.length) {
      return;
    }
    const entry = nextBackends[index];
    nextBackends[index] = nextBackends[targetIndex];
    nextBackends[targetIndex] = entry;
    await persistRemoteBackends(nextBackends);
    setRemoteStatus(`Moved "${entry.name}" ${direction}.`);
  };

  const handleDeleteRemoteBackend = async (id: string) => {
    const latestSettings = latestSettingsRef.current;
    const existingBackends = getConfiguredRemoteBackends(latestSettings);
    if (existingBackends.length <= 1) {
      setRemoteStatus("You need at least one remote.", true);
      return;
    }
    const index = existingBackends.findIndex((entry) => entry.id === id);
    if (index < 0) {
      return;
    }
    const removed = existingBackends[index];
    const remaining = existingBackends.filter((entry) => entry.id !== id);
    const nextActiveId =
      latestSettings.activeRemoteBackendId === id
        ? remaining[Math.min(index, remaining.length - 1)]?.id ?? remaining[0]?.id ?? null
        : latestSettings.activeRemoteBackendId;
    await persistRemoteBackends(remaining, nextActiveId);
    setRemoteStatus(`Deleted "${removed.name}".`);
  };

  const handleMobileConnectTest = () => {
    void (async () => {
      const nextToken = remoteTokenDraft.trim() ? remoteTokenDraft.trim() : null;
      setRemoteTokenDraft(nextToken ?? "");

      if (!nextToken) {
        setMobileConnectStatusError(true);
        setMobileConnectStatusText("Remote backend token is required.");
        return;
      }

      const hostError = validateRemoteHost(remoteHostDraft, remoteProviderDraft);
      if (hostError) {
        setRemoteHostError(hostError);
        setMobileConnectStatusError(true);
        setMobileConnectStatusText(hostError);
        return;
      }

      setMobileConnectBusy(true);
      setMobileConnectStatusText(null);
      setMobileConnectStatusError(false);
      try {
        const nextHost = normalizeRemoteEndpoint(remoteHostDraft, remoteProviderDraft);
        setRemoteHostDraft(nextHost);
        await updateActiveRemoteBackend({
          provider: remoteProviderDraft,
          host: nextHost,
          token: nextToken,
        });

        const workspaces = await listWorkspaces();
        const workspaceCount = workspaces.length;
        const workspaceWord = workspaceCount === 1 ? "workspace" : "workspaces";
        try {
          await updateActiveRemoteBackend({ lastConnectedAtMs: Date.now() });
        } catch {
          // Keep successful connectivity outcome even if timestamp persistence fails.
        }
        setMobileConnectStatusText(
          `Connected. ${workspaceCount} ${workspaceWord} reachable on the remote backend.`,
        );
        await onMobileConnectSuccess?.();
      } catch (error) {
        setMobileConnectStatusError(true);
        setMobileConnectStatusText(
          error instanceof Error ? error.message : "Unable to connect to remote backend.",
        );
      } finally {
        setMobileConnectBusy(false);
      }
    })();
  };

  useEffect(() => {
    if (!mobilePlatform) {
      return;
    }
    setMobileConnectStatusText(null);
    setMobileConnectStatusError(false);
  }, [mobilePlatform, remoteHostDraft, remoteTokenDraft]);

  const handleRefreshTailscaleStatus = useCallback(() => {
    void (async () => {
      setTailscaleStatusBusy(true);
      setTailscaleStatusError(null);
      try {
        const status = await fetchTailscaleStatus();
        setTailscaleStatus(status);
      } catch (error) {
        setTailscaleStatusError(
          formatErrorMessage(error, "Unable to load Tailscale status."),
        );
      } finally {
        setTailscaleStatusBusy(false);
      }
    })();
  }, []);

  const handleRefreshTailscaleCommandPreview = useCallback(() => {
    void (async () => {
      setTailscaleCommandBusy(true);
      setTailscaleCommandError(null);
      try {
        const preview = await fetchTailscaleDaemonCommandPreview();
        setTailscaleCommandPreview(preview);
      } catch (error) {
        setTailscaleCommandError(
          formatErrorMessage(error, "Unable to build Tailscale daemon command."),
        );
      } finally {
        setTailscaleCommandBusy(false);
      }
    })();
  }, []);

  const handleUseSuggestedTailscaleHost = async () => {
    const suggestedHost = tailscaleStatus?.suggestedRemoteHost ?? null;
    if (!suggestedHost) {
      return;
    }
    setRemoteProviderDraft("tcp");
    await applyRemoteHost(suggestedHost, "tcp");
  };

  const runTcpDaemonAction = useCallback(
    async (
      action: "start" | "stop" | "status",
      run: () => Promise<TcpDaemonStatus>,
    ) => {
      setTcpDaemonBusyAction(action);
      try {
        const status = await run();
        setTcpDaemonStatus(status);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Unable to update mobile access daemon status.";
        setTcpDaemonStatus((prev) => ({
          state: "error",
          pid: null,
          startedAtMs: null,
          lastError: errorMessage,
          listenAddr: prev?.listenAddr ?? null,
        }));
      } finally {
        setTcpDaemonBusyAction(null);
      }
    },
    [],
  );

  const handleTcpDaemonStart = useCallback(async () => {
    await runTcpDaemonAction("start", tailscaleDaemonStart);
  }, [runTcpDaemonAction]);

  const handleTcpDaemonStop = useCallback(async () => {
    await runTcpDaemonAction("stop", tailscaleDaemonStop);
  }, [runTcpDaemonAction]);

  const handleTcpDaemonStatus = useCallback(async () => {
    await runTcpDaemonAction("status", tailscaleDaemonStatus);
  }, [runTcpDaemonAction]);

  useEffect(() => {
    if (!supportsDesktopControls) {
      return;
    }
    handleRefreshTailscaleCommandPreview();
    void handleTcpDaemonStatus();
    if (tailscaleStatus === null && !tailscaleStatusBusy && !tailscaleStatusError) {
      handleRefreshTailscaleStatus();
    }
  }, [
    appSettings.remoteBackendToken,
    handleRefreshTailscaleCommandPreview,
    handleRefreshTailscaleStatus,
    handleTcpDaemonStatus,
    supportsDesktopControls,
    tailscaleStatus,
    tailscaleStatusBusy,
    tailscaleStatusError,
  ]);

  return {
    appSettings,
    onUpdateAppSettings,
    supportsDesktopControls,
    remoteBackends: getConfiguredRemoteBackends(appSettings),
    activeRemoteBackendId:
      appSettings.activeRemoteBackendId ?? getConfiguredRemoteBackends(appSettings)[0]?.id ?? null,
    remoteStatusText,
    remoteStatusError,
    remoteNameError,
    remoteHostError,
    remoteNameDraft,
    remoteProviderDraft,
    remoteHostDraft,
    remoteTokenDraft,
    nextRemoteNameSuggestion: buildNextRemoteName(getConfiguredRemoteBackends(appSettings)),
    tailscaleStatus,
    tailscaleStatusBusy,
    tailscaleStatusError,
    tailscaleCommandPreview,
    tailscaleCommandBusy,
    tailscaleCommandError,
    tcpDaemonStatus,
    tcpDaemonBusyAction,
    onSetRemoteNameDraft: handleSetRemoteNameDraft,
    onSetRemoteProviderDraft: handleSetRemoteProviderDraft,
    onSetRemoteHostDraft: handleSetRemoteHostDraft,
    onSetRemoteTokenDraft: setRemoteTokenDraft,
    onCommitRemoteName: handleCommitRemoteName,
    onCommitRemoteHost: handleCommitRemoteHost,
    onCommitRemoteToken: handleCommitRemoteToken,
    onSelectRemoteBackend: handleSelectRemoteBackend,
    onAddRemoteBackend: handleAddRemoteBackend,
    onMoveRemoteBackend: handleMoveRemoteBackend,
    onDeleteRemoteBackend: handleDeleteRemoteBackend,
    onRefreshTailscaleStatus: handleRefreshTailscaleStatus,
    onRefreshTailscaleCommandPreview: handleRefreshTailscaleCommandPreview,
    onUseSuggestedTailscaleHost: handleUseSuggestedTailscaleHost,
    onTcpDaemonStart: handleTcpDaemonStart,
    onTcpDaemonStop: handleTcpDaemonStop,
    onTcpDaemonStatus: handleTcpDaemonStatus,
    isMobilePlatform: mobilePlatform,
    mobileConnectBusy,
    mobileConnectStatusText,
    mobileConnectStatusError,
    onMobileConnectTest: handleMobileConnectTest,
  };
};
