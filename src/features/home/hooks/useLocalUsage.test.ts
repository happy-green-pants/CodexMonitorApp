// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalUsageSnapshot } from "@/types";
import { localUsageSnapshot } from "@/services/tauri";
import { useLocalUsage } from "./useLocalUsage";

vi.mock("@/services/tauri", () => ({
  localUsageSnapshot: vi.fn(),
}));

describe("useLocalUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(localUsageSnapshot).mockResolvedValue({
      updatedAt: 0,
      days: [],
      topModels: [],
      totals: {
        last7DaysTokens: 0,
        last30DaysTokens: 0,
        averageDailyTokens: 0,
        cacheHitRatePercent: 0,
        peakDay: null,
        peakDayTokens: 0,
      },
    } satisfies LocalUsageSnapshot);
  });

  it("does not refetch immediately on rerender when options identity changes", async () => {
    const onRemoteSetupRequired = vi.fn();
    const { rerender } = renderHook(
      ({ enabled, workspacePath }: { enabled: boolean; workspacePath: string | null }) =>
        useLocalUsage(enabled, workspacePath, {
          onRemoteSetupRequired,
        }),
      {
        initialProps: { enabled: true, workspacePath: "/tmp/codex" },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(localUsageSnapshot).toHaveBeenCalledTimes(1);

    rerender({ enabled: true, workspacePath: "/tmp/codex" });

    await act(async () => {
      await Promise.resolve();
    });

    expect(localUsageSnapshot).toHaveBeenCalledTimes(1);
  });
});
