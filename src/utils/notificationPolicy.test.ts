import { describe, expect, it } from "vitest";
import { shouldSendNotificationByIntensity } from "./notificationPolicy";

describe("shouldSendNotificationByIntensity", () => {
  const base = {
    enabled: true,
    isAppForeground: true,
    isChatVisible: true,
    activeWorkspaceId: "ws-a",
    activeThreadId: "t-a",
    eventWorkspaceId: "ws-a",
    eventThreadId: "t-a",
  } as const;

  it("always notifies when disabled=false is not set", () => {
    expect(
      shouldSendNotificationByIntensity({
        ...base,
        enabled: false,
        intensity: "high",
      }),
    ).toBe(false);
  });

  it("always notifies on high regardless of foreground/active", () => {
    expect(
      shouldSendNotificationByIntensity({
        ...base,
        intensity: "high",
        isAppForeground: true,
        isChatVisible: true,
      }),
    ).toBe(true);
    expect(
      shouldSendNotificationByIntensity({
        ...base,
        intensity: "high",
        isAppForeground: false,
        isChatVisible: false,
      }),
    ).toBe(true);
  });

  it("suppresses only the active visible chat on medium", () => {
    expect(
      shouldSendNotificationByIntensity({
        ...base,
        intensity: "medium",
        isAppForeground: true,
        isChatVisible: true,
      }),
    ).toBe(false);

    expect(
      shouldSendNotificationByIntensity({
        ...base,
        intensity: "medium",
        isAppForeground: true,
        isChatVisible: false,
      }),
    ).toBe(true);

    expect(
      shouldSendNotificationByIntensity({
        ...base,
        intensity: "medium",
        isAppForeground: false,
        isChatVisible: true,
      }),
    ).toBe(true);

    expect(
      shouldSendNotificationByIntensity({
        ...base,
        intensity: "medium",
        isAppForeground: true,
        isChatVisible: true,
        eventWorkspaceId: "ws-b",
        eventThreadId: "t-b",
      }),
    ).toBe(true);
  });

  it("notifies only in background on low", () => {
    expect(
      shouldSendNotificationByIntensity({
        ...base,
        intensity: "low",
        isAppForeground: true,
      }),
    ).toBe(false);
    expect(
      shouldSendNotificationByIntensity({
        ...base,
        intensity: "low",
        isAppForeground: false,
      }),
    ).toBe(true);
  });
});

