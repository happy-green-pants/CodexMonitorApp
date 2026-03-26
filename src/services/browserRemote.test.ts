import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/types";
import {
  browserRemoteInvoke,
  isInvalidBrowserRemoteResponseError,
  isRemoteSetupRequiredError,
  loadBrowserRemoteSettings,
  saveBrowserRemoteSettings,
} from "./browserRemote";

function mockLocation(origin: string) {
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: {
      origin,
    },
  });
}

describe("browserRemote", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    mockLocation("https://monitor.example.com");
  });

  it("falls back to an http remote profile on the current origin", () => {
    expect(loadBrowserRemoteSettings()).toMatchObject({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://monitor.example.com",
      activeRemoteBackendId: "remote-default",
    });
  });

  it("persists browser remote settings to local storage", () => {
    const settings = {
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
      remoteBackendToken: "token-1",
      remoteBackends: [
        {
          id: "remote-default",
          name: "Primary remote",
          provider: "http",
          host: "https://codex.example.com",
          token: "token-1",
          lastConnectedAtMs: null,
        },
      ],
      activeRemoteBackendId: "remote-default",
    } satisfies Partial<AppSettings>;

    saveBrowserRemoteSettings(settings);

    expect(loadBrowserRemoteSettings()).toMatchObject(settings);
  });

  it("dispatches http rpc with bearer auth and returns the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 7,
        result: {
          value: 42,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    saveBrowserRemoteSettings({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com/base/",
      remoteBackendToken: "token-1",
    });

    await expect(browserRemoteInvoke("daemon_info", { ping: true })).resolves.toEqual({
      value: 42,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://codex.example.com/base/rpc",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("surfaces rpc errors from the browser backend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          message: "unauthorized",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    saveBrowserRemoteSettings({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
      remoteBackendToken: "bad-token",
    });

    const error = await browserRemoteInvoke("daemon_info").catch((value) => value);

    expect(isRemoteSetupRequiredError(error)).toBe(true);
    expect((error as Error).message).toContain("token is missing or invalid");
  });

  it("marks html responses as invalid rpc endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: {
        get: (name: string) => (name.toLowerCase() === "content-type" ? "text/html" : null),
      },
      text: async () => "<!doctype html><html><body>Not Found</body></html>",
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    saveBrowserRemoteSettings({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://monitor.example.com",
      remoteBackendToken: "token-1",
    });

    const error = await browserRemoteInvoke("list_workspaces").catch((value) => value);

    expect(error).toBeInstanceOf(Error);
    expect(isInvalidBrowserRemoteResponseError(error)).toBe(true);
    expect(isRemoteSetupRequiredError(error)).toBe(true);
    expect((error as Error).message).toContain("not a CodexMonitor RPC endpoint");
  });

  it("treats unauthorized responses as remote setup errors and short-circuits repeats", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        error: {
          message: "unauthorized",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    saveBrowserRemoteSettings({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
      remoteBackendToken: null,
    });

    const firstError = await browserRemoteInvoke("list_workspaces").catch((value) => value);
    const secondError = await browserRemoteInvoke("list_workspaces").catch((value) => value);

    expect(isRemoteSetupRequiredError(firstError)).toBe(true);
    expect((firstError as Error).message).toContain("token is missing or invalid");
    expect(secondError).toBe(firstError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("short-circuits repeated network failures for the same remote configuration", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    saveBrowserRemoteSettings({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
      remoteBackendToken: "token-1",
    });

    const firstError = await browserRemoteInvoke("list_workspaces").catch((value) => value);
    const secondError = await browserRemoteInvoke("list_workspaces").catch((value) => value);

    expect(firstError).toBeInstanceOf(Error);
    expect((firstError as Error).message).toContain("Remote server is unreachable");
    expect(secondError).toBe(firstError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("times out stalled remote requests", async () => {
    const fetchMock = vi.fn((_input: string, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        if (!signal) {
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            reject(
              signal.reason instanceof Error
                ? signal.reason
                : new Error("Remote request timed out."),
            );
          },
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    saveBrowserRemoteSettings({
      backendMode: "remote",
      remoteBackendProvider: "http",
      remoteBackendHost: "https://codex.example.com",
      remoteBackendToken: "token-1",
    });

    const error = await browserRemoteInvoke("list_workspaces", {}, undefined, {
      timeoutMs: 10,
    }).catch((value) => value);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("timed out");
  });
});
