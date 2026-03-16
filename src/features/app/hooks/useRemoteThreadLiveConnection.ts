import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { subscribeAppServerEvents } from "@services/events";
import { threadLiveSubscribe, threadLiveUnsubscribe } from "@services/tauri";
import { pushErrorToast } from "@services/toasts";
import {
  getAppServerParams,
  getAppServerRawMethod,
} from "@utils/appServerEvents";
import type { WorkspaceInfo } from "@/types";

export type RemoteThreadConnectionState = "live" | "polling" | "disconnected";

const SELF_DETACH_IGNORE_WINDOW_MS = 10_000;
const LIVE_STALL_TIMEOUT_MS = 15_000;
const LIVE_STALL_COOLDOWN_MS = 30_000;
const LIVE_STALL_REFRESH_COOLDOWN_MS = 12_000;
const EVENT_STREAM_TOAST_COOLDOWN_MS = 30_000;

type ReconnectOptions = {
  runResume?: boolean;
  reason?: "thread-switch" | "focus" | "detached-recovery" | "connected-recovery";
};

type UseRemoteThreadLiveConnectionOptions = {
  backendMode: string;
  activeWorkspace: WorkspaceInfo | null;
  activeThreadId: string | null;
  activeThreadHasLocalSnapshot?: boolean;
  activeThreadIsProcessing?: boolean;
  refreshThread: (workspaceId: string, threadId: string) => Promise<unknown> | unknown;
  reconnectWorkspace?: (workspace: WorkspaceInfo) => Promise<unknown> | unknown;
};

function keyForThread(workspaceId: string, threadId: string) {
  return `${workspaceId}:${threadId}`;
}

function splitKey(key: string): { workspaceId: string; threadId: string } | null {
  const separator = key.indexOf(":");
  if (separator <= 0 || separator >= key.length - 1) {
    return null;
  }
  return {
    workspaceId: key.slice(0, separator),
    threadId: key.slice(separator + 1),
  };
}

function isThreadActivityMethod(method: string) {
  return (
    method.startsWith("item/") ||
    method.startsWith("turn/") ||
    method === "error" ||
    method === "thread/tokenUsage/updated"
  );
}

function extractThreadId(method: string, params: Record<string, unknown>): string | null {
  if (method === "turn/started" || method === "turn/completed" || method === "error") {
    const turn = (params.turn as Record<string, unknown> | undefined) ?? {};
    const fromTurn = String(turn.threadId ?? turn.thread_id ?? "").trim();
    if (fromTurn) {
      return fromTurn;
    }
  }
  const direct = String(params.threadId ?? params.thread_id ?? "").trim();
  return direct.length > 0 ? direct : null;
}

function isDocumentVisible() {
  return typeof document === "undefined" ? true : document.visibilityState === "visible";
}

function isWindowFocused() {
  if (typeof document === "undefined" || typeof document.hasFocus !== "function") {
    return true;
  }
  return document.hasFocus();
}

export function useRemoteThreadLiveConnection({
  backendMode,
  activeWorkspace,
  activeThreadId,
  activeThreadHasLocalSnapshot = true,
  activeThreadIsProcessing = false,
  refreshThread,
  reconnectWorkspace,
}: UseRemoteThreadLiveConnectionOptions) {
  const activeWorkspaceId = activeWorkspace?.id ?? null;
  const activeWorkspaceConnected = activeWorkspace?.connected ?? false;
  const [connectionState, setConnectionState] =
    useState<RemoteThreadConnectionState>(() => {
      if (backendMode !== "remote") {
        return activeWorkspace?.connected ? "live" : "disconnected";
      }
      if (!activeWorkspace?.connected) {
        return "disconnected";
      }
      return "polling";
    });

  const backendModeRef = useRef(backendMode);
  const activeWorkspaceRef = useRef(activeWorkspace);
  const activeThreadIdRef = useRef(activeThreadId);
  const activeThreadHasLocalSnapshotRef = useRef(activeThreadHasLocalSnapshot);
  const activeThreadIsProcessingRef = useRef(activeThreadIsProcessing);
  const refreshThreadRef = useRef(refreshThread);
  const reconnectWorkspaceRef = useRef(reconnectWorkspace);
  const connectionStateRef = useRef(connectionState);
  const activeSubscriptionKeyRef = useRef<string | null>(null);
  const desiredSubscriptionKeyRef = useRef<string | null>(null);
  const ignoreDetachedEventsUntilRef = useRef<Map<string, number>>(new Map());
  const inFlightReconnectRef = useRef<{
    key: string;
    sequence: number;
    promise: Promise<boolean>;
  } | null>(null);
  const reconnectSequenceRef = useRef(0);
  const lastRelevantEventAtMsRef = useRef<number>(Date.now());
  const lastLiveStallHandledAtMsRef = useRef<number>(0);
  const lastLiveStallRefreshAtMsRef = useRef<number>(0);
  const lastEventStreamToastAtMsRef = useRef<number>(0);

  useEffect(() => {
    backendModeRef.current = backendMode;
    activeWorkspaceRef.current = activeWorkspace;
    activeThreadIdRef.current = activeThreadId;
    activeThreadHasLocalSnapshotRef.current = activeThreadHasLocalSnapshot;
    activeThreadIsProcessingRef.current = activeThreadIsProcessing;
    refreshThreadRef.current = refreshThread;
    reconnectWorkspaceRef.current = reconnectWorkspace;
  }, [
    backendMode,
    activeWorkspace,
    activeThreadId,
    activeThreadHasLocalSnapshot,
    activeThreadIsProcessing,
    refreshThread,
    reconnectWorkspace,
  ]);

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  const setState = useCallback((next: RemoteThreadConnectionState) => {
    if (connectionStateRef.current === next) {
      return;
    }
    connectionStateRef.current = next;
    setConnectionState(next);
  }, []);

  const maybeToastEventStreamIssue = useCallback((title: string, message: string) => {
    const now = Date.now();
    if (now - lastEventStreamToastAtMsRef.current < EVENT_STREAM_TOAST_COOLDOWN_MS) {
      return;
    }
    lastEventStreamToastAtMsRef.current = now;
    pushErrorToast({
      title,
      message,
      durationMs: 6000,
    });
  }, []);

  const degradeToPollingBestEffort = useCallback(
    async (workspaceId: string, threadId: string, reason: "ws-error" | "stall") => {
      if (!workspaceId || !threadId) {
        return;
      }
      setState("polling");
      if (reason === "ws-error") {
        maybeToastEventStreamIssue(
          "实时事件流已断开",
          "已自动切换为轮询同步（Polling）。网络恢复后会自动重连。",
        );
      } else {
        maybeToastEventStreamIssue(
          "实时事件流无响应",
          "已自动切换为轮询同步（Polling）。",
        );
      }
      const now = Date.now();
      if (now - lastLiveStallRefreshAtMsRef.current < LIVE_STALL_REFRESH_COOLDOWN_MS) {
        return;
      }
      lastLiveStallRefreshAtMsRef.current = now;
      try {
        await Promise.resolve(refreshThreadRef.current(workspaceId, threadId));
      } catch {
        // Refresh failures are surfaced elsewhere; avoid toast spam here.
      }
    },
    [maybeToastEventStreamIssue, setState],
  );

  const unsubscribeByKey = useCallback(
    async (key: string) => {
      const parsed = splitKey(key);
      if (!parsed) {
        return;
      }
      await threadLiveUnsubscribe(parsed.workspaceId, parsed.threadId).catch(() => {
        // Ignore cleanup errors; foreground reattach handles recovery.
      });
    },
    [],
  );

  const reconcileDisconnectedState = useCallback(() => {
    const workspace = activeWorkspaceRef.current;
    if (backendModeRef.current !== "remote") {
      setState(workspace?.connected ? "live" : "disconnected");
      return;
    }
    if (!workspace?.connected) {
      setState("disconnected");
      return;
    }
    setState("polling");
  }, [setState]);

  const reconnectLive = useCallback(
    async (
      workspaceId: string,
      threadId: string,
      options?: ReconnectOptions,
    ): Promise<boolean> => {
      if (
        backendModeRef.current !== "remote" ||
        !workspaceId ||
        !threadId ||
        !activeWorkspaceRef.current
      ) {
        reconcileDisconnectedState();
        return false;
      }

      const targetKey = keyForThread(workspaceId, threadId);
      desiredSubscriptionKeyRef.current = targetKey;
      const inFlightReconnect = inFlightReconnectRef.current;
      if (inFlightReconnect?.key === targetKey) {
        if (inFlightReconnect.sequence === reconnectSequenceRef.current) {
          return inFlightReconnect.promise;
        }
        // A newer sequence (blur/focus/key change) has invalidated this attempt.
        inFlightReconnectRef.current = null;
      }

      const reconnectPromise = (async (): Promise<boolean> => {
        const sequence = reconnectSequenceRef.current + 1;
        reconnectSequenceRef.current = sequence;
        const workspaceAtStart = activeWorkspaceRef.current;
        const shouldResume = options?.runResume !== false;
        const shouldKeepLiveState = options?.reason === "thread-switch";
        if (!workspaceAtStart?.connected) {
          setState("disconnected");
        } else if (shouldResume || !shouldKeepLiveState) {
          setState("polling");
        } else {
          setState("live");
        }

        try {
          desiredSubscriptionKeyRef.current = targetKey;
          const workspaceEntry = activeWorkspaceRef.current;
          if (
            workspaceEntry &&
            !workspaceEntry.connected &&
            reconnectWorkspaceRef.current &&
            workspaceEntry.id === workspaceId
          ) {
            await Promise.resolve(reconnectWorkspaceRef.current(workspaceEntry));
          }
          if (sequence !== reconnectSequenceRef.current) {
            return false;
          }

          if (shouldResume) {
            await Promise.resolve(refreshThreadRef.current(workspaceId, threadId));
          }
          if (sequence !== reconnectSequenceRef.current) {
            return false;
          }

          if (activeSubscriptionKeyRef.current === targetKey) {
            ignoreDetachedEventsUntilRef.current.set(
              targetKey,
              Date.now() + SELF_DETACH_IGNORE_WINDOW_MS,
            );
            await threadLiveUnsubscribe(workspaceId, threadId).catch(() => {
              // Best-effort dedupe: ignore unsubscribe failures before reattach.
            });
            activeSubscriptionKeyRef.current = null;
          }
          await threadLiveSubscribe(workspaceId, threadId);
          if (sequence !== reconnectSequenceRef.current) {
            if (desiredSubscriptionKeyRef.current !== targetKey) {
              await threadLiveUnsubscribe(workspaceId, threadId).catch(() => {
                // Best-effort cleanup for stale reconnect attempts.
              });
            }
            return false;
          }

          activeSubscriptionKeyRef.current = targetKey;
          if (shouldResume || !shouldKeepLiveState) {
            setState("polling");
          } else {
            setState("live");
          }
          return true;
        } catch {
          if (sequence === reconnectSequenceRef.current) {
            reconcileDisconnectedState();
          }
          return false;
        }
      })();

      const reconnectSequence = reconnectSequenceRef.current;
      inFlightReconnectRef.current = {
        key: targetKey,
        sequence: reconnectSequence,
        promise: reconnectPromise,
      };
      reconnectPromise.finally(() => {
        if (inFlightReconnectRef.current?.promise === reconnectPromise) {
          inFlightReconnectRef.current = null;
        }
      });
      return reconnectPromise;
    },
    [reconcileDisconnectedState, setState],
  );

  useEffect(() => {
    const nextKey =
      backendMode === "remote" && activeWorkspaceId && activeThreadId
        ? keyForThread(activeWorkspaceId, activeThreadId)
        : null;
    desiredSubscriptionKeyRef.current = nextKey;
    lastRelevantEventAtMsRef.current = Date.now();
    const previousKey = activeSubscriptionKeyRef.current;

    if (previousKey && previousKey !== nextKey) {
      activeSubscriptionKeyRef.current = null;
      void unsubscribeByKey(previousKey);
    }

    if (!nextKey) {
      reconcileDisconnectedState();
      return;
    }
    if (!isDocumentVisible()) {
      reconcileDisconnectedState();
      return;
    }
    const parsed = splitKey(nextKey);
    if (!parsed) {
      reconcileDisconnectedState();
      return;
    }
    if (
      activeSubscriptionKeyRef.current === nextKey &&
      connectionStateRef.current !== "disconnected" &&
      activeWorkspaceConnected
    ) {
      return;
    }
    void reconnectLive(parsed.workspaceId, parsed.threadId, {
      runResume: !activeThreadHasLocalSnapshotRef.current,
      reason: "thread-switch",
    });
  }, [
    activeThreadId,
    activeWorkspaceConnected,
    activeWorkspaceId,
    backendMode,
    reconcileDisconnectedState,
    reconnectLive,
    unsubscribeByKey,
  ]);

  useEffect(() => {
    const unlisten = subscribeAppServerEvents(
      (event) => {
      const method = getAppServerRawMethod(event);
      if (!method) {
        return;
      }
      const params = getAppServerParams(event);
      const activeWorkspaceEntry = activeWorkspaceRef.current;
      const activeWorkspaceId = activeWorkspaceEntry?.id ?? null;
      const selectedThreadId = activeThreadIdRef.current;
      if (!activeWorkspaceId || !selectedThreadId) {
        return;
      }
      if (event.workspace_id !== activeWorkspaceId) {
        return;
      }

      if (method === "codex/connected" && isDocumentVisible()) {
        void reconnectLive(activeWorkspaceId, selectedThreadId, {
          runResume: false,
          reason: "connected-recovery",
        });
        return;
      }

      if (method === "thread/live_attached") {
        const threadId = extractThreadId(method, params);
        if (threadId === selectedThreadId) {
          lastRelevantEventAtMsRef.current = Date.now();
          activeSubscriptionKeyRef.current = keyForThread(activeWorkspaceId, threadId);
          setState(connectionStateRef.current === "polling" ? "polling" : "live");
        }
        return;
      }

      if (method === "thread/live_detached") {
        const threadId = extractThreadId(method, params);
        if (threadId === selectedThreadId) {
          const threadKey = keyForThread(activeWorkspaceId, threadId);
          const ignoreDetachedUntil =
            ignoreDetachedEventsUntilRef.current.get(threadKey) ?? 0;
          if (ignoreDetachedUntil > 0 && ignoreDetachedUntil >= Date.now()) {
            ignoreDetachedEventsUntilRef.current.delete(threadKey);
            return;
          }
          if (ignoreDetachedUntil > 0) {
            ignoreDetachedEventsUntilRef.current.delete(threadKey);
          }
          activeSubscriptionKeyRef.current = null;
          reconcileDisconnectedState();
          if (isDocumentVisible() && isWindowFocused()) {
            void reconnectLive(activeWorkspaceId, selectedThreadId, {
              runResume: true,
              reason: "detached-recovery",
            });
          }
        }
        return;
      }

      if (method === "thread/live_heartbeat") {
        const threadId = extractThreadId(method, params);
        if (threadId === selectedThreadId) {
          lastRelevantEventAtMsRef.current = Date.now();
          setState("live");
        }
        return;
      }

      if (!isThreadActivityMethod(method)) {
        return;
      }
      const threadId = extractThreadId(method, params);
      if (threadId !== selectedThreadId) {
        return;
      }
      lastRelevantEventAtMsRef.current = Date.now();
      setState("live");
      },
      {
        onError: (error) => {
          const workspaceId = activeWorkspaceRef.current?.id ?? null;
          const threadId = activeThreadIdRef.current;
          if (!workspaceId || !threadId) {
            return;
          }
          console.warn("[remote-live] app-server event stream error", error);
          void degradeToPollingBestEffort(workspaceId, threadId, "ws-error");
        },
      },
    );

    return () => {
      unlisten();
    };
  }, [degradeToPollingBestEffort, reconnectLive, reconcileDisconnectedState, setState]);

  useEffect(() => {
    if (backendMode !== "remote") {
      return;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    timer = setInterval(() => {
      const workspaceId = activeWorkspaceRef.current?.id ?? null;
      const threadId = activeThreadIdRef.current;
      if (!workspaceId || !threadId) {
        return;
      }
      if (!activeThreadIsProcessingRef.current) {
        return;
      }
      if (connectionStateRef.current !== "live") {
        return;
      }
      if (!isDocumentVisible()) {
        return;
      }

      const now = Date.now();
      const lastEventAt = lastRelevantEventAtMsRef.current;
      if (now - lastEventAt < LIVE_STALL_TIMEOUT_MS) {
        return;
      }
      if (now - lastLiveStallHandledAtMsRef.current < LIVE_STALL_COOLDOWN_MS) {
        return;
      }
      lastLiveStallHandledAtMsRef.current = now;
      void degradeToPollingBestEffort(workspaceId, threadId, "stall");
    }, 1000);

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [backendMode, degradeToPollingBestEffort]);

  useEffect(() => {
    let unlistenWindowFocus: (() => void) | null = null;
    let unlistenWindowBlur: (() => void) | null = null;
    let didCleanup = false;

    const reconnectActiveThread = () => {
      const workspaceId = activeWorkspaceRef.current?.id ?? null;
      const threadId = activeThreadIdRef.current;
      if (!workspaceId || !threadId) {
        return;
      }
      void reconnectLive(workspaceId, threadId, {
        runResume: true,
        reason: "focus",
      });
    };

    const handleFocus = () => {
      if (!isDocumentVisible()) {
        return;
      }
      reconnectActiveThread();
    };

    const handleBlur = () => {
      reconnectSequenceRef.current += 1;
      desiredSubscriptionKeyRef.current = null;
      const currentKey = activeSubscriptionKeyRef.current;
      if (!currentKey) {
        return;
      }
      activeSubscriptionKeyRef.current = null;
      void unsubscribeByKey(currentKey);
      reconcileDisconnectedState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reconnectActiveThread();
        return;
      }
      handleBlur();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    try {
      const windowHandle = getCurrentWindow();
      windowHandle
        .listen("tauri://focus", handleFocus)
        .then((unlisten) => {
          if (didCleanup) {
            unlisten();
            return;
          }
          unlistenWindowFocus = unlisten;
        })
        .catch(() => {
          // Ignore non-Tauri environments.
        });
      windowHandle
        .listen("tauri://blur", handleBlur)
        .then((unlisten) => {
          if (didCleanup) {
            unlisten();
            return;
          }
          unlistenWindowBlur = unlisten;
        })
        .catch(() => {
          // Ignore non-Tauri environments.
        });
    } catch {
      // Ignore non-Tauri environments.
    }

    return () => {
      didCleanup = true;
      if (unlistenWindowFocus) {
        unlistenWindowFocus();
      }
      if (unlistenWindowBlur) {
        unlistenWindowBlur();
      }
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      desiredSubscriptionKeyRef.current = null;
      ignoreDetachedEventsUntilRef.current.clear();
      const currentKey = activeSubscriptionKeyRef.current;
      if (currentKey) {
        activeSubscriptionKeyRef.current = null;
        void unsubscribeByKey(currentKey);
      }
    };
  }, [reconnectLive, reconcileDisconnectedState, unsubscribeByKey]);

  return {
    connectionState,
    reconnectLive,
  };
}
