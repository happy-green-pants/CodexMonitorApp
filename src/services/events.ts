import { isTauri } from "@tauri-apps/api/core";
import type { PluginListener } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  onAction as onNotificationAction,
  type Options as NotificationOptions,
} from "@tauri-apps/plugin-notification";
import {
  getBrowserRemoteWebSocketUrl,
  loadBrowserRemoteSettings,
} from "./browserRemote";
import type {
  AppServerEvent,
  DictationEvent,
  DictationModelStatus,
  TrayOpenThreadPayload,
} from "../types";

export type Unsubscribe = () => void;

export type TerminalOutputEvent = {
  workspaceId: string;
  terminalId: string;
  data: string;
};

export type TerminalExitEvent = {
  workspaceId: string;
  terminalId: string;
};

type SubscriptionOptions = {
  onError?: (error: unknown) => void;
};

type Listener<T> = (payload: T) => void;

const BROWSER_REMOTE_EVENT_NAMES = new Set([
  "app-server-event",
  "terminal-output",
  "terminal-exit",
]);
const BROWSER_WS_AUTH_REQUEST_ID = 1;

type BrowserEventEnvelope<T> = {
  id?: number;
  method?: string;
  params?: T;
  result?: unknown;
  error?: { message?: string };
};

async function readBrowserEventText(value: unknown): Promise<string | null> {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new TextDecoder().decode(value);
  }
  // Some WebViews deliver text frames as Blob.
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    try {
      if (typeof value.text === "function") {
        return await value.text();
      }
      return new TextDecoder().decode(await value.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
}

async function parseBrowserEventEnvelope<T>(
  value: unknown,
): Promise<BrowserEventEnvelope<T> | null> {
  const text = await readBrowserEventText(value);
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as BrowserEventEnvelope<T>;
  } catch {
    return null;
  }
}

function createBrowserEventSubscription<T>(
  eventName: string,
  onEvent: Listener<T>,
  options?: SubscriptionOptions,
): Promise<Unsubscribe> {
  if (!BROWSER_REMOTE_EVENT_NAMES.has(eventName)) {
    return Promise.resolve(() => {});
  }
  if (typeof WebSocket === "undefined") {
    return Promise.reject(new Error("WebSocket is unavailable in this browser runtime."));
  }

  const settings = loadBrowserRemoteSettings();
  if (settings.backendMode !== "remote" || settings.remoteBackendProvider !== "http") {
    return Promise.reject(
      new Error("Browser events require the remote HTTP provider to be configured."),
    );
  }

  return new Promise<Unsubscribe>((resolve) => {
    let closedByClient = false;
    let socket: WebSocket | null = null;
    let authenticated = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let shouldReconnect = true;

    // Keep a stable reference for the lifetime of this subscription.
    const onError: ((error: unknown) => void) | undefined = options?.onError;

    const cleanup = () => {
      closedByClient = true;
      shouldReconnect = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      try {
        socket?.close();
      } catch {
        // Ignore duplicate close attempts during teardown.
      }
    };

    const scheduleReconnect = () => {
      if (!shouldReconnect || closedByClient) {
        return;
      }
      if (reconnectTimer) {
        return;
      }
      // Exponential backoff with a cap; keep it tight so the UI can recover quickly.
      const baseMs = 250;
      const maxMs = 10_000;
      const exponent = Math.min(5, Math.max(0, attempt));
      const delay = Math.min(maxMs, baseMs * 2 ** exponent);
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (!shouldReconnect || closedByClient) {
        return;
      }
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      // Re-read settings so server/token updates take effect without a full reload.
      const latestSettings = loadBrowserRemoteSettings();
      const token = latestSettings.remoteBackendToken?.trim() || null;
      const url = getBrowserRemoteWebSocketUrl(latestSettings);

      attempt += 1;
      socket = new WebSocket(url);
      authenticated = token == null;

      socket.onopen = () => {
        attempt = 0;
        if (!token) {
          return;
        }
        socket?.send(
          JSON.stringify({
            id: BROWSER_WS_AUTH_REQUEST_ID,
            method: "auth",
            params: { token },
          }),
        );
      };

      socket.onmessage = (event) => {
        void (async () => {
          const payload = await parseBrowserEventEnvelope<T>(event.data);
          if (!payload) {
            return;
          }

          if (!authenticated) {
            if (payload.error) {
              onError?.(
                new Error(payload.error.message || "Failed to authenticate remote event stream."),
              );
              try {
                socket?.close();
              } catch {
                // Ignore.
              }
              scheduleReconnect();
              return;
            }
            if (payload.id === BROWSER_WS_AUTH_REQUEST_ID && payload.result !== undefined) {
              authenticated = true;
              return;
            }
          }

          if (payload.method === eventName) {
            onEvent(payload.params as T);
          }
        })();
      };

      socket.onerror = () => {
        if (closedByClient) {
          return;
        }
        onError?.(new Error("Unable to connect to the remote event stream."));
        scheduleReconnect();
      };

      socket.onclose = () => {
        if (closedByClient) {
          return;
        }
        onError?.(
          new Error(
            authenticated
              ? "Remote event stream disconnected."
              : "Remote event stream closed before authentication completed.",
          ),
        );
        scheduleReconnect();
      };
    };

    // Deliver the cleanup handle immediately so callers can always unsubscribe.
    resolve(cleanup);
    connect();
  });
}

function createEventHub<T>(eventName: string) {
  const listeners = new Set<Listener<T>>();
  const errorListeners = new Set<(error: unknown) => void>();
  let unlisten: Unsubscribe | null = null;
  let listenPromise: Promise<Unsubscribe> | null = null;

  const notifyError = (error: unknown) => {
    for (const handler of errorListeners) {
      try {
        handler(error);
      } catch (listenerError) {
        console.error(`[events] ${eventName} error listener failed`, listenerError);
      }
    }
  };

  const start = () => {
    if (unlisten || listenPromise) {
      return;
    }
    listenPromise = isTauri()
      ? listen<T>(eventName, (event) => {
          for (const listener of listeners) {
            try {
              listener(event.payload);
            } catch (error) {
              console.error(`[events] ${eventName} listener failed`, error);
            }
          }
        })
      : createBrowserEventSubscription<T>(
          eventName,
          (payload) => {
            for (const listener of listeners) {
              try {
                listener(payload);
              } catch (error) {
                console.error(`[events] ${eventName} listener failed`, error);
              }
            }
          },
          {
            onError: (error) => {
              notifyError(error);
            },
          },
        );
    listenPromise
      .then((handler) => {
        listenPromise = null;
        if (listeners.size === 0) {
          handler();
          return;
        }
        unlisten = handler;
      })
      .catch((error) => {
        listenPromise = null;
        notifyError(error);
      });
  };

  const stop = () => {
    if (unlisten) {
      try {
        unlisten();
      } catch {
        // Ignore double-unlisten when tearing down.
      }
      unlisten = null;
    }
  };

  const subscribe = (
    onEvent: Listener<T>,
    options?: SubscriptionOptions,
  ): Unsubscribe => {
    listeners.add(onEvent);
    if (options?.onError) {
      errorListeners.add(options.onError);
    }
    start();
    return () => {
      listeners.delete(onEvent);
      if (options?.onError) {
        errorListeners.delete(options.onError);
      }
      if (listeners.size === 0) {
        stop();
      }
    };
  };

  return { subscribe };
}

const appServerHub = createEventHub<AppServerEvent>("app-server-event");
const dictationDownloadHub = createEventHub<DictationModelStatus>("dictation-download");
const dictationEventHub = createEventHub<DictationEvent>("dictation-event");
const terminalOutputHub = createEventHub<TerminalOutputEvent>("terminal-output");
const terminalExitHub = createEventHub<TerminalExitEvent>("terminal-exit");
const updaterCheckHub = createEventHub<void>("updater-check");
const trayOpenThreadHub = createEventHub<TrayOpenThreadPayload>("tray-open-thread");
const menuNewAgentHub = createEventHub<void>("menu-new-agent");
const menuNewWorktreeAgentHub = createEventHub<void>("menu-new-worktree-agent");
const menuNewCloneAgentHub = createEventHub<void>("menu-new-clone-agent");
const menuAddWorkspaceHub = createEventHub<void>("menu-add-workspace");
const menuAddWorkspaceFromUrlHub = createEventHub<void>("menu-add-workspace-from-url");
const menuOpenSettingsHub = createEventHub<void>("menu-open-settings");
const menuToggleProjectsSidebarHub = createEventHub<void>("menu-toggle-projects-sidebar");
const menuToggleGitSidebarHub = createEventHub<void>("menu-toggle-git-sidebar");
const menuToggleDebugPanelHub = createEventHub<void>("menu-toggle-debug-panel");
const menuToggleTerminalHub = createEventHub<void>("menu-toggle-terminal");
const menuNextAgentHub = createEventHub<void>("menu-next-agent");
const menuPrevAgentHub = createEventHub<void>("menu-prev-agent");
const menuNextWorkspaceHub = createEventHub<void>("menu-next-workspace");
const menuPrevWorkspaceHub = createEventHub<void>("menu-prev-workspace");
const menuCycleModelHub = createEventHub<void>("menu-composer-cycle-model");
const menuCycleAccessHub = createEventHub<void>("menu-composer-cycle-access");
const menuCycleReasoningHub = createEventHub<void>("menu-composer-cycle-reasoning");
const menuCycleCollaborationHub = createEventHub<void>("menu-composer-cycle-collaboration");
const menuComposerCycleModelHub = createEventHub<void>("menu-composer-cycle-model");
const menuComposerCycleAccessHub = createEventHub<void>("menu-composer-cycle-access");
const menuComposerCycleReasoningHub = createEventHub<void>("menu-composer-cycle-reasoning");
const menuComposerCycleCollaborationHub = createEventHub<void>(
  "menu-composer-cycle-collaboration",
);

export function subscribeAppServerEvents(
  onEvent: (event: AppServerEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return appServerHub.subscribe(onEvent, options);
}

export function subscribeDictationDownload(
  onEvent: (event: DictationModelStatus) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return dictationDownloadHub.subscribe(onEvent, options);
}

export function subscribeDictationEvents(
  onEvent: (event: DictationEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return dictationEventHub.subscribe(onEvent, options);
}

export function subscribeTerminalOutput(
  onEvent: (event: TerminalOutputEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return terminalOutputHub.subscribe(onEvent, options);
}

export function subscribeTerminalExit(
  onEvent: (event: TerminalExitEvent) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return terminalExitHub.subscribe(onEvent, options);
}

export function subscribeUpdaterCheck(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return updaterCheckHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeTrayOpenThread(
  onEvent: (payload: TrayOpenThreadPayload) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return trayOpenThreadHub.subscribe((payload) => {
    onEvent(payload);
  }, options);
}

export function subscribeSystemNotificationActions(
  onEvent: (payload: NotificationOptions) => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  if (!isTauri()) {
    return () => {};
  }

  let listener: PluginListener | null = null;
  let closed = false;
  const safeUnregister = (registered: PluginListener | null) => {
    if (!registered) {
      return;
    }
    try {
      const result = registered.unregister();
      if (result && typeof (result as Promise<void>).catch === "function") {
        void (result as Promise<void>).catch(() => {});
      }
    } catch {
      // Ignore cleanup errors during listener teardown.
    }
  };

  void onNotificationAction((payload) => {
    onEvent(payload);
  })
    .then((registered) => {
      if (closed) {
        safeUnregister(registered);
        return;
      }
      listener = registered;
    })
    .catch((error) => {
      options?.onError?.(error);
    });

  return () => {
    closed = true;
    safeUnregister(listener);
  };
}

export function subscribeMenuNewAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNewAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewWorktreeAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNewWorktreeAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNewCloneAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNewCloneAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuAddWorkspaceFromUrl(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuAddWorkspaceFromUrlHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuAddWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuAddWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuOpenSettings(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuOpenSettingsHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleProjectsSidebar(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleProjectsSidebarHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleGitSidebar(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleGitSidebarHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleDebugPanel(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleDebugPanelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuToggleTerminal(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuToggleTerminalHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNextAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNextAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuPrevAgent(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuPrevAgentHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuNextWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuNextWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuPrevWorkspace(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuPrevWorkspaceHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleModel(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuCycleModelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleAccessMode(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuCycleAccessHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleReasoning(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuCycleReasoningHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuCycleCollaborationMode(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuCycleCollaborationHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleModel(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuComposerCycleModelHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleAccess(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuComposerCycleAccessHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleReasoning(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuComposerCycleReasoningHub.subscribe(() => {
    onEvent();
  }, options);
}

export function subscribeMenuComposerCycleCollaboration(
  onEvent: () => void,
  options?: SubscriptionOptions,
): Unsubscribe {
  return menuComposerCycleCollaborationHub.subscribe(() => {
    onEvent();
  }, options);
}
