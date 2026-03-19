// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "../../../types";
import { getConfigModel, getModelList } from "../../../services/tauri";
import { useModels } from "./useModels";

vi.mock("../../../services/tauri", () => ({
  getModelList: vi.fn(),
  getConfigModel: vi.fn(),
}));

const workspace: WorkspaceInfo = {
  id: "workspace-1",
  name: "CodexMonitor",
  path: "/tmp/codex",
  connected: true,
  settings: { sidebarCollapsed: false },
};

describe("useModels", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adds custom fallback models when model/list does not include them", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-1",
            model: "gpt-5.2",
            displayName: "GPT-5.2",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        customModelIds: ["gpt-5.4", "gpt-5.3-codex"],
      }),
    );

    await waitFor(() => expect(result.current.models.length).toBe(3));

    expect(result.current.models.map((model) => model.model)).toEqual([
      "gpt-5.2",
      "gpt-5.4",
      "gpt-5.3-codex",
    ]);
    expect(result.current.models[1]).toMatchObject({
      id: "gpt-5.4",
      model: "gpt-5.4",
      defaultReasoningEffort: "medium",
    });
    expect(
      result.current.models[1]?.supportedReasoningEfforts.map(
        (effort) => effort.reasoningEffort,
      ),
    ).toEqual(["low", "medium", "high", "xhigh"]);
  });

  it("updates merged models when custom fallback settings change", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-1",
            model: "gpt-5.2",
            displayName: "GPT-5.2",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce(null);

    const { result, rerender } = renderHook(
      ({ customModelIds }: { customModelIds: string[] }) =>
        useModels({
          activeWorkspace: workspace,
          customModelIds,
        }),
      {
        initialProps: {
          customModelIds: [] as string[],
        },
      },
    );

    await waitFor(() => {
      expect(result.current.models.map((model) => model.model)).toEqual(["gpt-5.2"]);
    });

    rerender({ customModelIds: ["gpt-5.4"] });

    await waitFor(() => {
      expect(result.current.models.map((model) => model.model)).toEqual([
        "gpt-5.2",
        "gpt-5.4",
      ]);
    });

    expect(getModelList).toHaveBeenCalledTimes(1);
    expect(getConfigModel).toHaveBeenCalledTimes(1);
  });

  it("deduplicates config and custom fallback models by slug", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("gpt-5.4");

    const { result } = renderHook(() =>
      useModels({
        activeWorkspace: workspace,
        customModelIds: ["gpt-5.4"],
      }),
    );

    await waitFor(() =>
      expect(result.current.models[0]?.displayName).toBe("gpt-5.4 (config)"),
    );

    expect(result.current.models[0]).toMatchObject({
      id: "gpt-5.4",
      model: "gpt-5.4",
      displayName: "gpt-5.4 (config)",
    });
  });

  it("adds the config model when it is missing from model/list", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-1",
            model: "gpt-5.1",
            displayName: "GPT-5.1",
            supportedReasoningEfforts: [],
            defaultReasoningEffort: null,
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("custom-model");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.models.length).toBeGreaterThan(0));

    expect(getConfigModel).toHaveBeenCalledWith("workspace-1");
    expect(result.current.models[0]).toMatchObject({
      id: "custom-model",
      model: "custom-model",
    });
    expect(result.current.selectedModel?.model).toBe("custom-model");
    expect(result.current.reasoningSupported).toBe(false);
  });

  it("prefers the provider entry when the config model matches by slug", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "provider-id",
            model: "custom-model",
            displayName: "Provider Custom",
            supportedReasoningEfforts: [
              { reasoningEffort: "medium", description: "Medium" },
              { reasoningEffort: "high", description: "High" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: false,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("custom-model");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.selectedModelId).toBe("provider-id"));

    expect(result.current.models).toHaveLength(1);
    expect(result.current.selectedModel?.id).toBe("provider-id");
    expect(result.current.reasoningSupported).toBe(true);
  });

  it("keeps the selected reasoning effort when switching models", async () => {
    vi.mocked(getModelList).mockResolvedValueOnce({
      result: {
        data: [
          {
            id: "remote-1",
            model: "gpt-5.1",
            displayName: "GPT-5.1",
            supportedReasoningEfforts: [
              { reasoningEffort: "low", description: "Low" },
              { reasoningEffort: "medium", description: "Medium" },
            ],
            defaultReasoningEffort: "medium",
            isDefault: true,
          },
        ],
      },
    });
    vi.mocked(getConfigModel).mockResolvedValueOnce("custom-model");

    const { result } = renderHook(() =>
      useModels({ activeWorkspace: workspace }),
    );

    await waitFor(() => expect(result.current.models.length).toBeGreaterThan(1));

    act(() => {
      result.current.setSelectedEffort("high");
      result.current.setSelectedModelId("custom-model");
    });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("custom-model");
      expect(result.current.selectedEffort).toBe("high");
    });
  });
});
