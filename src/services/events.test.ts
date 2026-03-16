import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTauri } from "@tauri-apps/api/core";
import type { Event, EventCallback, UnlistenFn } from "@tauri-apps/api/event";
import { listen } from "@tauri-apps/api/event";
import type { AppServerEvent } from "../types";
import {
  getBrowserRemoteWebSocketUrl,
  loadBrowserRemoteSettings,
} from "./browserRemote";
import {
  subscribeAppServerEvents,
  subscribeMenuCycleCollaborationMode,
  subscribeMenuCycleModel,
  subscribeMenuNewAgent,
  subscribeTerminalOutput,
} from "./events";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: vi.fn(() => true),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("./browserRemote", () => ({
  getBrowserRemoteWebSocketUrl: vi.fn(() => "wss://codex.example.com/rpc/ws"),
  loadBrowserRemoteSettings: vi.fn(() => ({
    backendMode: "remote",
    remoteBackendProvider: "http",
    remoteBackendHost: "https://codex.example.com",
    remoteBackendToken: "token-1",
    remoteBackends: [],
    activeRemoteBackendId: "remote-default",
  })),
}));

class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = 0;
  sent: string[] = [];
  onopen: ((event: { type: string }) => void) | null = null;
  onmessage: ((event: { data: any }) => void) | null = null;
  onerror: ((event: { type: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
  }

  emitOpen() {
    this.readyState = 1;
    this.onopen?.({ type: "open" });
  }

  emitMessage(data: unknown) {
    this.onmessage?.({
      data:
        typeof data === "string"
          ? data
          : typeof Blob !== "undefined" && data instanceof Blob
            ? data
            : JSON.stringify(data),
    });
  }

  emitError() {
    this.onerror?.({ type: "error" });
  }

  emitClose(code = 1000) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const originalWebSocket = globalThis.WebSocket;

describe("events subscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(getBrowserRemoteWebSocketUrl).mockReturnValue("wss://codex.example.com/rpc/ws");
    vi.mocked(loadBrowserRemoteSettings).mockReturnValue({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
      remoteBackendToken: "token-1",
      remoteBackends: [],
      activeRemoteBackendId: "remote-default",
    });
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("delivers payloads and unsubscribes on cleanup", async () => {
    let listener: EventCallback<AppServerEvent> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<AppServerEvent>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    const payload: AppServerEvent = {
      workspace_id: "ws-1",
      message: { method: "ping" },
    };

    const event: Event<AppServerEvent> = {
      event: "app-server-event",
      id: 1,
      payload,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledWith(payload);

    cleanup();
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("cleans up listeners that resolve after unsubscribe", async () => {
    let resolveListener: (handler: UnlistenFn) => void = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation(
      () =>
        new Promise<UnlistenFn>((resolve) => {
          resolveListener = resolve;
        }),
    );

    const cleanup = subscribeMenuNewAgent(() => {});
    cleanup();

    resolveListener(unlisten);
    await Promise.resolve();
    expect(unlisten).toHaveBeenCalledTimes(1);
  });

  it("delivers menu events to subscribers", async () => {
    let listener: EventCallback<void> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<void>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeMenuCycleModel(onEvent);

    const event: Event<void> = {
      event: "menu-composer-cycle-model",
      id: 1,
      payload: undefined,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("delivers collaboration cycle menu events to subscribers", async () => {
    let listener: EventCallback<void> = () => {};
    const unlisten = vi.fn();

    vi.mocked(listen).mockImplementation((_event, handler) => {
      listener = handler as EventCallback<void>;
      return Promise.resolve(unlisten);
    });

    const onEvent = vi.fn();
    const cleanup = subscribeMenuCycleCollaborationMode(onEvent);

    const event: Event<void> = {
      event: "menu-composer-cycle-collaboration",
      id: 1,
      payload: undefined,
    };
    listener(event);
    expect(onEvent).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("reports listen errors through options", async () => {
    const error = new Error("nope");
    vi.mocked(listen).mockRejectedValueOnce(error);

    const onError = vi.fn();
    const cleanup = subscribeTerminalOutput(() => {}, { onError });

    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(error);

    cleanup();
  });

  it("uses the browser websocket bridge outside Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    const socket = MockWebSocket.instances[0];

    expect(socket).toBeTruthy();
    expect(socket?.url).toBe("wss://codex.example.com/rpc/ws");

    socket.emitOpen();
    expect(socket.sent).toEqual([
      JSON.stringify({
        id: 1,
        method: "auth",
        params: { token: "token-1" },
      }),
    ]);

    socket.emitMessage({ id: 1, result: { ok: true } });
    await Promise.resolve();
    await Promise.resolve();

    const payload: AppServerEvent = {
      workspace_id: "ws-browser",
      message: { method: "thread.updated" },
    };
    socket.emitMessage({
      method: "app-server-event",
      params: payload,
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(onEvent).toHaveBeenCalledWith(payload);

    cleanup();
    await Promise.resolve();
    expect(socket.readyState).toBe(3);
  });

  it("parses Blob websocket message payloads outside Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const onEvent = vi.fn();
    const cleanup = subscribeAppServerEvents(onEvent);
    const socket = MockWebSocket.instances[0];

    expect(socket).toBeTruthy();
    socket.emitOpen();
    socket.emitMessage({ id: 1, result: { ok: true } });
    await Promise.resolve();
    await Promise.resolve();

    const payload: AppServerEvent = {
      workspace_id: "ws-blob",
      message: { method: "thread.updated" },
    };
    const blob = new Blob([
      JSON.stringify({
        method: "app-server-event",
        params: payload,
      }),
    ]);
    socket.emitMessage(blob);
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await Promise.resolve();

    expect(onEvent).toHaveBeenCalledWith(payload);
    cleanup();
  });

  it("reconnects the browser websocket stream after close once established", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    vi.mocked(isTauri).mockReturnValue(false);

    const onError = vi.fn();
    const cleanup = subscribeTerminalOutput(() => {}, { onError });
    const first = MockWebSocket.instances[0];

    expect(first).toBeTruthy();
    first.emitOpen();
    first.emitMessage({ id: 1, result: { ok: true } });
    await Promise.resolve();
    await Promise.resolve();

    first.emitClose(1006);
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(250);
    const second = MockWebSocket.instances[1];
    expect(second).toBeTruthy();

    second.emitOpen();
    expect(second.sent).toEqual([
      JSON.stringify({
        id: 1,
        method: "auth",
        params: { token: "token-1" },
      }),
    ]);

    cleanup();
    vi.useRealTimers();
  });

  it("reports websocket bootstrap errors outside Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(false);

    const onError = vi.fn();
    const cleanup = subscribeTerminalOutput(() => {}, { onError });
    const socket = MockWebSocket.instances[0];

    socket.emitError();
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).toHaveBeenCalled();
    cleanup();
  });
});

afterAll(() => {
  globalThis.WebSocket = originalWebSocket;
});
