import type { AppSettings } from "@/types";
import { DEFAULT_REMOTE_HOST } from "@settings/components/settingsViewConstants";

const DEFAULT_REMOTE_HTTP_ENDPOINT = "https://codex.example.com";
const DEFAULT_REMOTE_BACKEND_NAME = "Primary remote";

export type RemoteBackendTarget = AppSettings["remoteBackends"][number];

export const createRemoteBackendId = () =>
  `remote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const normalizeRemoteProvider = (
  provider: AppSettings["remoteBackendProvider"] | null | undefined,
): AppSettings["remoteBackendProvider"] => (provider === "http" ? "http" : "tcp");

export const normalizeRemoteEndpoint = (
  value: string | null | undefined,
  provider: AppSettings["remoteBackendProvider"],
) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return provider === "http" ? DEFAULT_REMOTE_HTTP_ENDPOINT : DEFAULT_REMOTE_HOST;
  }
  if (provider === "http") {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return trimmed.replace(/\/+$/, "");
      }
    } catch {
      return DEFAULT_REMOTE_HTTP_ENDPOINT;
    }
    return DEFAULT_REMOTE_HTTP_ENDPOINT;
  }
  return /^([^:\s]+|\[[^\]]+\]):([0-9]{1,5})$/.test(trimmed)
    ? trimmed
    : DEFAULT_REMOTE_HOST;
};

export const validateRemoteHost = (
  value: string,
  provider: AppSettings["remoteBackendProvider"],
): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return provider === "http" ? "Endpoint URL is required." : "Host is required.";
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
};

export const buildFallbackRemoteBackend = (settings: AppSettings): RemoteBackendTarget => ({
  id: settings.activeRemoteBackendId ?? "remote-default",
  name: DEFAULT_REMOTE_BACKEND_NAME,
  provider: normalizeRemoteProvider(settings.remoteBackendProvider),
  host: normalizeRemoteEndpoint(
    settings.remoteBackendHost,
    normalizeRemoteProvider(settings.remoteBackendProvider),
  ),
  token: settings.remoteBackendToken,
  lastConnectedAtMs: null,
});

export const getConfiguredRemoteBackends = (settings: AppSettings): RemoteBackendTarget[] => {
  if (settings.remoteBackends.length > 0) {
    return settings.remoteBackends;
  }
  return [buildFallbackRemoteBackend(settings)];
};

export const getActiveRemoteBackend = (settings: AppSettings): RemoteBackendTarget => {
  const configured = getConfiguredRemoteBackends(settings);
  return configured.find((entry) => entry.id === settings.activeRemoteBackendId) ?? configured[0];
};

export const normalizeRemoteBackendEntry = (
  entry: RemoteBackendTarget,
  index: number,
): RemoteBackendTarget => {
  const provider = normalizeRemoteProvider(entry.provider);
  return {
    id: entry.id?.trim() || `remote-${index + 1}`,
    name: entry.name?.trim() || `Remote ${index + 1}`,
    provider,
    host: normalizeRemoteEndpoint(entry.host, provider),
    token: entry.token?.trim() ? entry.token.trim() : null,
    lastConnectedAtMs:
      typeof entry.lastConnectedAtMs === "number" && Number.isFinite(entry.lastConnectedAtMs)
        ? entry.lastConnectedAtMs
        : null,
  };
};

export const buildNextRemoteName = (remoteBackends: RemoteBackendTarget[]) => {
  const normalized = new Set(remoteBackends.map((entry) => entry.name.trim().toLowerCase()));
  let index = remoteBackends.length + 1;
  let candidate = `Remote ${index}`;
  while (normalized.has(candidate.toLowerCase())) {
    index += 1;
    candidate = `Remote ${index}`;
  }
  return candidate;
};

// Keep the single-active remote model consistent by always mirroring the active entry
// back into the legacy top-level remote fields that the rest of the app still reads.
export const buildSettingsFromRemoteBackends = (
  latestSettings: AppSettings,
  remoteBackends: RemoteBackendTarget[],
  options?: {
    preferredActiveId?: string | null;
    forceRemoteMode?: boolean;
  },
): AppSettings => {
  const normalizedBackends = remoteBackends.length
    ? remoteBackends.map(normalizeRemoteBackendEntry)
    : [normalizeRemoteBackendEntry(buildFallbackRemoteBackend(latestSettings), 0)];
  const active =
    normalizedBackends.find((entry) => entry.id === options?.preferredActiveId) ??
    normalizedBackends.find((entry) => entry.id === latestSettings.activeRemoteBackendId) ??
    normalizedBackends[0];
  return {
    ...latestSettings,
    remoteBackends: normalizedBackends,
    activeRemoteBackendId: active.id,
    remoteBackendProvider: active.provider,
    remoteBackendHost: active.host,
    remoteBackendToken: active.token,
    ...(options?.forceRemoteMode
      ? {
          backendMode: "remote",
        }
      : {}),
  };
};
