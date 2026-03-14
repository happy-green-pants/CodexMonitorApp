import type { AppSettings, RemoteBackendTarget } from "@/types";

const BROWSER_REMOTE_SETTINGS_STORAGE_KEY = "codex-monitor.browser-remote-settings.v1";
const DEFAULT_REMOTE_ID = "remote-default";
const DEFAULT_REMOTE_NAME = "Primary remote";
const DEFAULT_BROWSER_REMOTE_ORIGIN = "http://127.0.0.1:4733";
const INVALID_BROWSER_REMOTE_RESPONSE_CODE = "REMOTE_INVALID_RESPONSE";
const REMOTE_AUTH_REQUIRED_CODE = "REMOTE_AUTH_REQUIRED";
const REMOTE_UNREACHABLE_BLOCK_MS = 5_000;

let nextRpcRequestId = 1;
let blockedBrowserRemoteSignature: string | null = null;
let blockedBrowserRemoteError: (Error & { code?: string }) | null = null;
let blockedBrowserRemoteExpiresAtMs: number | null = null;

type BrowserStoredSettings = Pick<
  AppSettings,
  | "backendMode"
  | "remoteBackendProvider"
  | "remoteBackendHost"
  | "remoteBackendToken"
  | "remoteBackends"
  | "activeRemoteBackendId"
>;

function createBrowserRemoteError(message: string, code?: string) {
  const error = new Error(message) as Error & { code?: string };
  if (code) {
    error.code = code;
  }
  return error;
}

function browserRemoteSignature(settings: BrowserStoredSettings) {
  return JSON.stringify({
    provider: settings.remoteBackendProvider,
    host: settings.remoteBackendHost,
    token: settings.remoteBackendToken,
  });
}

function isUnauthorizedRemoteResponse(
  response: Response,
  payload: { error?: { message?: string } },
) {
  const message = payload.error?.message?.toLowerCase() ?? "";
  return (
    response.status === 401 ||
    response.status === 403 ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("token")
  );
}

function blockBrowserRemoteRequests(
  settings: BrowserStoredSettings,
  error: Error & { code?: string },
  expiresAtMs: number | null = null,
) {
  blockedBrowserRemoteSignature = browserRemoteSignature(settings);
  blockedBrowserRemoteError = error;
  blockedBrowserRemoteExpiresAtMs = expiresAtMs;
}

function clearBlockedBrowserRemoteRequests() {
  blockedBrowserRemoteSignature = null;
  blockedBrowserRemoteError = null;
  blockedBrowserRemoteExpiresAtMs = null;
}

function looksLikeHtmlResponse(body: string) {
  const trimmed = body.trim().toLowerCase();
  return (
    trimmed.startsWith("<!doctype html") ||
    trimmed.startsWith("<html") ||
    trimmed.includes("<head") ||
    trimmed.includes("<body")
  );
}

async function buildInvalidBrowserRemoteResponseError(response: Response) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const body = await response.text().catch(() => "");
  const htmlLike = contentType.includes("text/html") || looksLikeHtmlResponse(body);
  const message = htmlLike
    ? "Configured remote server is not a CodexMonitor RPC endpoint. Open Settings → Server and update the remote URL."
    : "Remote server returned an invalid response.";
  return createBrowserRemoteError(message, INVALID_BROWSER_REMOTE_RESPONSE_CODE);
}

function currentBrowserOrigin() {
  if (typeof location !== "undefined" && /^https?:/i.test(location.origin)) {
    return location.origin;
  }
  return DEFAULT_BROWSER_REMOTE_ORIGIN;
}

function normalizeHttpOrigin(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return currentBrowserOrigin();
  }
  return trimmed.replace(/\/+$/, "");
}

function buildDefaultRemoteTarget(origin = currentBrowserOrigin()): RemoteBackendTarget {
  return {
    id: DEFAULT_REMOTE_ID,
    name: DEFAULT_REMOTE_NAME,
    provider: "http",
    host: normalizeHttpOrigin(origin),
    token: null,
    lastConnectedAtMs: null,
  };
}

function normalizeStoredSettings(
  input: Partial<BrowserStoredSettings> | null | undefined,
): BrowserStoredSettings {
  const defaultRemote = buildDefaultRemoteTarget();
  const provider: BrowserStoredSettings["remoteBackendProvider"] =
    input?.remoteBackendProvider === "tcp" ? "tcp" : "http";
  const host =
    provider === "http"
      ? normalizeHttpOrigin(input?.remoteBackendHost)
      : input?.remoteBackendHost?.trim() || "127.0.0.1:4732";
  const token = input?.remoteBackendToken?.trim() ? input.remoteBackendToken.trim() : null;
  const remoteBackends: AppSettings["remoteBackends"] =
    input?.remoteBackends && input.remoteBackends.length > 0
      ? input.remoteBackends.map((entry, index) => ({
          id: entry.id?.trim() || `${DEFAULT_REMOTE_ID}-${index + 1}`,
          name: entry.name?.trim() || `Remote ${index + 1}`,
          provider: entry.provider === "tcp" ? "tcp" : "http",
          host:
            entry.provider === "tcp"
              ? entry.host?.trim() || "127.0.0.1:4732"
              : normalizeHttpOrigin(entry.host),
          token: entry.token?.trim() ? entry.token.trim() : null,
          lastConnectedAtMs:
            typeof entry.lastConnectedAtMs === "number" ? entry.lastConnectedAtMs : null,
        }))
      : [
          {
            ...defaultRemote,
            provider,
            host,
            token,
          },
        ];
  const activeRemoteIndex = Math.max(
    0,
    remoteBackends.findIndex((entry) => entry.id === input?.activeRemoteBackendId),
  );
  const syncedActive = {
    ...remoteBackends[activeRemoteIndex],
    provider,
    host,
    token,
  };
  remoteBackends[activeRemoteIndex] = syncedActive;
  return {
    backendMode: "remote",
    remoteBackendProvider: syncedActive.provider,
    remoteBackendHost: syncedActive.host,
    remoteBackendToken: syncedActive.token,
    remoteBackends,
    activeRemoteBackendId: syncedActive.id,
  };
}

export function loadBrowserRemoteSettings(): BrowserStoredSettings {
  if (typeof localStorage === "undefined") {
    return normalizeStoredSettings(null);
  }
  const raw = localStorage.getItem(BROWSER_REMOTE_SETTINGS_STORAGE_KEY);
  if (!raw) {
    return normalizeStoredSettings(null);
  }
  try {
    return normalizeStoredSettings(JSON.parse(raw) as Partial<BrowserStoredSettings>);
  } catch {
    return normalizeStoredSettings(null);
  }
}

export function hasSavedBrowserRemoteSettings() {
  if (typeof localStorage === "undefined") {
    return false;
  }
  return localStorage.getItem(BROWSER_REMOTE_SETTINGS_STORAGE_KEY) !== null;
}

export function saveBrowserRemoteSettings(
  patch: Partial<BrowserStoredSettings>,
): BrowserStoredSettings {
  const next = normalizeStoredSettings({
    ...loadBrowserRemoteSettings(),
    ...patch,
  });
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(BROWSER_REMOTE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  }
  clearBlockedBrowserRemoteRequests();
  return next;
}

export function isRemoteServerConfiguredForBrowser(
  settings?: Partial<BrowserStoredSettings> | null,
) {
  const resolved = normalizeStoredSettings(settings ?? loadBrowserRemoteSettings());
  return (
    resolved.backendMode === "remote" &&
    resolved.remoteBackendProvider === "http" &&
    Boolean(resolved.remoteBackendHost.trim())
  );
}

export function isInvalidBrowserRemoteResponseError(error: unknown) {
  return (
    error instanceof Error &&
    (error as Error & { code?: string }).code === INVALID_BROWSER_REMOTE_RESPONSE_CODE
  );
}

export function isRemoteSetupRequiredError(error: unknown) {
  return (
    error instanceof Error &&
    [INVALID_BROWSER_REMOTE_RESPONSE_CODE, REMOTE_AUTH_REQUIRED_CODE].includes(
      (error as Error & { code?: string }).code ?? "",
    )
  );
}

export function shouldUseBrowserRemoteTransport(settings?: Partial<BrowserStoredSettings> | null) {
  const resolved = normalizeStoredSettings(settings ?? loadBrowserRemoteSettings());
  return resolved.backendMode === "remote" && resolved.remoteBackendProvider === "http";
}

export function getBrowserRemoteRpcUrl(settings?: Partial<BrowserStoredSettings> | null) {
  const resolved = normalizeStoredSettings(settings ?? loadBrowserRemoteSettings());
  return `${normalizeHttpOrigin(resolved.remoteBackendHost)}/rpc`;
}

export function getBrowserRemoteWebSocketUrl(settings?: Partial<BrowserStoredSettings> | null) {
  const resolved = normalizeStoredSettings(settings ?? loadBrowserRemoteSettings());
  const origin = normalizeHttpOrigin(resolved.remoteBackendHost);
  const wsOrigin = origin.startsWith("https://")
    ? `wss://${origin.slice("https://".length)}`
    : origin.startsWith("http://")
      ? `ws://${origin.slice("http://".length)}`
      : origin;
  return `${wsOrigin}/rpc/ws`;
}

export async function browserRemoteInvoke<T>(
  method: string,
  params: Record<string, unknown> = {},
  settings?: Partial<BrowserStoredSettings> | null,
): Promise<T> {
  const resolved = normalizeStoredSettings(settings ?? loadBrowserRemoteSettings());
  const currentSignature = browserRemoteSignature(resolved);
  if (
    blockedBrowserRemoteSignature === currentSignature &&
    blockedBrowserRemoteExpiresAtMs !== null &&
    Date.now() >= blockedBrowserRemoteExpiresAtMs
  ) {
    clearBlockedBrowserRemoteRequests();
  }
  if (
    blockedBrowserRemoteSignature === currentSignature &&
    blockedBrowserRemoteError
  ) {
    throw blockedBrowserRemoteError;
  }
  let response: Response;
  try {
    response = await fetch(getBrowserRemoteRpcUrl(resolved), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(resolved.remoteBackendToken
          ? { Authorization: `Bearer ${resolved.remoteBackendToken}` }
          : {}),
      },
      body: JSON.stringify({
        id: nextRpcRequestId++,
        method,
        params,
      }),
    });
  } catch (error) {
    const remoteError = new Error(
      "Remote server is unreachable. Check Settings → Server and ensure the remote backend is running.",
    );
    blockBrowserRemoteRequests(
      resolved,
      remoteError,
      Date.now() + REMOTE_UNREACHABLE_BLOCK_MS,
    );
    throw remoteError;
  }

  let payload: { result?: T; error?: { message?: string } } = {};
  try {
    payload = (await response.json()) as { result?: T; error?: { message?: string } };
  } catch (error) {
    const remoteError = await buildInvalidBrowserRemoteResponseError(response);
    blockBrowserRemoteRequests(resolved, remoteError);
    throw remoteError;
  }

  if (!response.ok || payload.error) {
    if (isUnauthorizedRemoteResponse(response, payload)) {
      const remoteError = createBrowserRemoteError(
        "Remote backend token is missing or invalid. Open Settings → Server and update the token.",
        REMOTE_AUTH_REQUIRED_CODE,
      );
      blockBrowserRemoteRequests(resolved, remoteError);
      throw remoteError;
    }
    throw new Error(payload.error?.message || `Remote request failed with ${response.status}`);
  }
  clearBlockedBrowserRemoteRequests();
  return payload.result as T;
}
