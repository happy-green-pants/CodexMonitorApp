import type { ModelOption } from "../../../types";

export const CONFIG_MODEL_DESCRIPTION = "Configured in CODEX_HOME/config.toml";
export const CUSTOM_MODEL_DESCRIPTION = "Custom model";

const DEFAULT_CUSTOM_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const;

export function normalizeEffortValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const normalizeModelKey = (value: string): string => value.trim().toLowerCase();

export function normalizeCustomModelIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    const key = normalizeModelKey(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function hasModelIdOrSlug(models: ModelOption[], idOrModel: string): boolean {
  const key = normalizeModelKey(idOrModel);
  return models.some(
    (model) =>
      normalizeModelKey(model.id) === key || normalizeModelKey(model.model) === key,
  );
}

export function createConfigModelOption(modelId: string): ModelOption {
  return {
    id: modelId,
    model: modelId,
    displayName: `${modelId} (config)`,
    description: CONFIG_MODEL_DESCRIPTION,
    supportedReasoningEfforts: [],
    defaultReasoningEffort: null,
    isDefault: false,
  };
}

export function createCustomFallbackModelOption(modelId: string): ModelOption {
  return {
    id: modelId,
    model: modelId,
    displayName: modelId,
    description: CUSTOM_MODEL_DESCRIPTION,
    supportedReasoningEfforts: DEFAULT_CUSTOM_REASONING_EFFORTS.map((reasoningEffort) => ({
      reasoningEffort,
      description: "",
    })),
    defaultReasoningEffort: "medium",
    isDefault: false,
  };
}

export function mergeModelOptionsWithFallbacks({
  modelsFromServer,
  configModel,
  customModelIds,
}: {
  modelsFromServer: ModelOption[];
  configModel: string | null;
  customModelIds?: string[];
}): ModelOption[] {
  const merged = [...modelsFromServer];

  if (configModel && !hasModelIdOrSlug(merged, configModel)) {
    merged.unshift(createConfigModelOption(configModel));
  }

  for (const customModelId of normalizeCustomModelIds(customModelIds ?? [])) {
    if (hasModelIdOrSlug(merged, customModelId)) {
      continue;
    }
    merged.push(createCustomFallbackModelOption(customModelId));
  }

  return merged;
}

function extractModelItems(response: unknown): unknown[] {
  if (!response || typeof response !== "object") {
    return [];
  }

  const record = response as Record<string, unknown>;
  const result =
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>)
      : null;

  const resultData = result?.data;
  if (Array.isArray(resultData)) {
    return resultData;
  }

  const topLevelData = record.data;
  if (Array.isArray(topLevelData)) {
    return topLevelData;
  }

  return [];
}

function parseReasoningEfforts(item: Record<string, unknown>): ModelOption["supportedReasoningEfforts"] {
  const camel = item.supportedReasoningEfforts;
  if (Array.isArray(camel)) {
    return camel
      .map((effort) => {
        if (!effort || typeof effort !== "object") {
          return null;
        }
        const entry = effort as Record<string, unknown>;
        return {
          reasoningEffort: String(entry.reasoningEffort ?? entry.reasoning_effort ?? ""),
          description: String(entry.description ?? ""),
        };
      })
      .filter((effort): effort is { reasoningEffort: string; description: string } =>
        effort !== null,
      );
  }

  const snake = item.supported_reasoning_efforts;
  if (Array.isArray(snake)) {
    return snake
      .map((effort) => {
        if (!effort || typeof effort !== "object") {
          return null;
        }
        const entry = effort as Record<string, unknown>;
        return {
          reasoningEffort: String(entry.reasoningEffort ?? entry.reasoning_effort ?? ""),
          description: String(entry.description ?? ""),
        };
      })
      .filter((effort): effort is { reasoningEffort: string; description: string } =>
        effort !== null,
      );
  }

  return [];
}

export function parseModelListResponse(response: unknown): ModelOption[] {
  const items = extractModelItems(response);

  return items
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }
      const record = item as Record<string, unknown>;
      const modelSlug = String(record.model ?? record.id ?? "");
      const rawDisplayName = String(record.displayName || record.display_name || "");
      const displayName = rawDisplayName.trim().length > 0 ? rawDisplayName : modelSlug;
      return {
        id: String(record.id ?? record.model ?? ""),
        model: modelSlug,
        displayName,
        description: String(record.description ?? ""),
        supportedReasoningEfforts: parseReasoningEfforts(record),
        defaultReasoningEffort: normalizeEffortValue(
          record.defaultReasoningEffort ?? record.default_reasoning_effort,
        ),
        isDefault: Boolean(record.isDefault ?? record.is_default ?? false),
      } satisfies ModelOption;
    })
    .filter((model): model is ModelOption => model !== null);
}
