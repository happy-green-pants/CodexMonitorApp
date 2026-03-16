// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { resolveAndroidAgentNotificationOverrides } from "./useUpdaterController";

const isTauriMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
}));

const globalScope = globalThis as typeof globalThis & { navigator?: Navigator };

function withNavigatorValues(
  values: Partial<Pick<Navigator, "platform" | "userAgent" | "maxTouchPoints">>,
  run: () => void,
) {
  const hadNavigator = typeof globalScope.navigator !== "undefined";
  if (!hadNavigator) {
    Object.defineProperty(globalScope, "navigator", {
      configurable: true,
      writable: true,
      value: {},
    });
  }

  const activeNavigator = globalScope.navigator as Navigator;
  const originalPlatform = Object.getOwnPropertyDescriptor(activeNavigator, "platform");
  const originalUserAgent = Object.getOwnPropertyDescriptor(activeNavigator, "userAgent");
  const originalMaxTouchPoints = Object.getOwnPropertyDescriptor(
    activeNavigator,
    "maxTouchPoints",
  );

  Object.defineProperty(activeNavigator, "platform", {
    configurable: true,
    value: values.platform ?? activeNavigator.platform ?? "",
  });
  Object.defineProperty(activeNavigator, "userAgent", {
    configurable: true,
    value: values.userAgent ?? activeNavigator.userAgent ?? "",
  });
  Object.defineProperty(activeNavigator, "maxTouchPoints", {
    configurable: true,
    value: values.maxTouchPoints ?? activeNavigator.maxTouchPoints ?? 0,
  });

  try {
    run();
  } finally {
    if (originalPlatform) {
      Object.defineProperty(activeNavigator, "platform", originalPlatform);
    } else {
      delete (activeNavigator as { platform?: string }).platform;
    }
    if (originalUserAgent) {
      Object.defineProperty(activeNavigator, "userAgent", originalUserAgent);
    } else {
      delete (activeNavigator as { userAgent?: string }).userAgent;
    }
    if (originalMaxTouchPoints) {
      Object.defineProperty(activeNavigator, "maxTouchPoints", originalMaxTouchPoints);
    } else {
      delete (activeNavigator as { maxTouchPoints?: number }).maxTouchPoints;
    }
    if (!hadNavigator) {
      Reflect.deleteProperty(globalScope, "navigator");
    }
  }
}

describe("resolveAndroidAgentNotificationOverrides", () => {
  it("enables notify-on-every-reply policy on Android Tauri mobile", () => {
    isTauriMock.mockReturnValue(true);

    withNavigatorValues(
      {
        platform: "Linux armv8l",
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      },
      () => {
        expect(resolveAndroidAgentNotificationOverrides()).toEqual({
          minDurationMs: 0,
          forceMuteSubagentNotifications: true,
        });
      },
    );
  });

  it("does not enable overrides when not running under Tauri", () => {
    isTauriMock.mockReturnValue(false);

    withNavigatorValues(
      {
        platform: "Linux armv8l",
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
      },
      () => {
        expect(resolveAndroidAgentNotificationOverrides()).toBeNull();
      },
    );
  });

  it("does not enable overrides on desktop platforms", () => {
    isTauriMock.mockReturnValue(true);

    withNavigatorValues(
      {
        platform: "MacIntel",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_0) AppleWebKit/537.36",
      },
      () => {
        expect(resolveAndroidAgentNotificationOverrides()).toBeNull();
      },
    );
  });
});

