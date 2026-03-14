import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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

function parseBrowserEventEnvelope<T>(value: unknown): BrowserEventEnvelope<T> | null {
  const text =
    typeof value === "string"
      ? value
      : value instanceof ArrayBuffer
        ? new TextDecoder().decode(value)
        : null;
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

  return new Promise<Unsubscribe>((resolve, reject) => {
    const socket = new WebSocket(getBrowserRemoteWebSocketUrl(settings));
    const token = settings.remoteBackendToken?.trim() || null;
    let settled = false;
    let authenticated = token == null;
    let closedByClient = false;

    const cleanup = () => {
      closedByClient = true;
      try {
        socket.close();
      } catch {
        // Ignore duplicate close attempts during teardown.
      }
    };

    const rejectOrNotify = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
        return;
      }
      if (!closedByClient) {
        options?.onError?.(error);
      }
    };

    socket.onopen = () => {
      if (!token) {
        settled = true;
        resolve(cleanup);
        return;
      }

      socket.send(
        JSON.stringify({
          id: BROWSER_WS_AUTH_REQUEST_ID,
          method: "auth",
          params: { token },
        }),
      );
    };

    socket.onmessage = (event) => {
      const payload = parseBrowserEventEnvelope<T>(event.data);
      if (!payload) {
        return;
      }

      if (!authenticated) {
        if (payload.error) {
          rejectOrNotify(
            new Error(payload.error.message || "Failed to authenticate remote event stream."),
          );
          cleanup();
          return;
        }
        if (payload.id === BROWSER_WS_AUTH_REQUEST_ID && payload.result !== undefined) {
          authenticated = true;
          if (!settled) {
            settled = true;
            resolve(cleanup);
          }
          return;
        }
      }

      if (payload.method === eventName) {
        onEvent(payload.params as T);
      }
    };

    socket.onerror = () => {
      rejectOrNotify(new Error("Unable to connect to the remote event stream."));
    };

    socket.onclose = () => {
      if (closedByClient) {
        return;
      }
      rejectOrNotify(
        new Error(
          authenticated
            ? "Remote event stream disconnected."
            : "Remote event stream closed before authentication completed.",
        ),
      );
    };
  });
}

function createEventHub<T>(eventName: string) {
  const listeners = new Set<Listener<T>>();
  let unlisten: Unsubscribe | null = null;
  let listenPromise: Promise<Unsubscribe> | null = null;

  const start = (options?: SubscriptionOptions) => {
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
          options,
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
        options?.onError?.(error);
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
    start(options);
    return () => {
      listeners.delete(onEvent);
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
