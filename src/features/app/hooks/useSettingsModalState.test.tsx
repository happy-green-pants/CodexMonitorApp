// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSettingsModalState } from "./useSettingsModalState";

describe("useSettingsModalState", () => {
  it("opens settings directly to the server section", () => {
    const { result } = renderHook(() => useSettingsModalState());

    act(() => {
      result.current.openSettings("server");
    });

    expect(result.current.settingsOpen).toBe(true);
    expect(result.current.settingsSection).toBe("server");
  });
});
