import type {
  AppServerEvent,
  RequestUserInputOption,
  RequestUserInputQuestion,
  RequestUserInputRequest,
} from "../types";

export const SUPPORTED_APP_SERVER_METHODS = [
  "app/list/updated",
  "account/login/completed",
  "account/rateLimits/updated",
  "account/updated",
  "codex/backgroundThread",
  "codex/connected",
  "codex/event/skills_update_available",
  "error",
  "hook/completed",
  "hook/started",
  "item/agentMessage/delta",
  "item/commandExecution/outputDelta",
  "item/commandExecution/terminalInteraction",
  "item/completed",
  "item/fileChange/outputDelta",
  "item/plan/delta",
  "item/reasoning/summaryPartAdded",
  "item/reasoning/summaryTextDelta",
  "item/reasoning/textDelta",
  "item/started",
  "item/tool/requestUserInput",
  "serverRequest/resolved",
  "thread/archived",
  "thread/closed",
  "thread/name/updated",
  "thread/status/changed",
  "thread/started",
  "thread/tokenUsage/updated",
  "thread/unarchived",
  "turn/completed",
  "turn/diff/updated",
  "turn/plan/updated",
  "turn/started",
] as const;

export type SupportedAppServerMethod = (typeof SUPPORTED_APP_SERVER_METHODS)[number];

export const METHODS_HANDLED_OUTSIDE_USE_APP_SERVER_EVENTS = [
  "app/list/updated",
  "codex/event/skills_update_available",
] as const satisfies readonly SupportedAppServerMethod[];

const SUPPORTED_METHOD_SET = new Set<string>(SUPPORTED_APP_SERVER_METHODS);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim();
}

function normalizeRequestUserInputOptions(
  value: unknown,
): RequestUserInputOption[] | undefined {
  const optionsRaw = Array.isArray(value) ? value : [];
  const options = optionsRaw
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const label = asTrimmedString(record.label);
      const description = asTrimmedString(record.description);
      if (!label && !description) {
        return null;
      }
      return { label, description };
    })
    .filter((option): option is RequestUserInputOption => Boolean(option));
  return options.length ? options : undefined;
}

function normalizeRequestUserInputQuestions(value: unknown): RequestUserInputQuestion[] {
  const questionsRaw = Array.isArray(value) ? value : [];
  const questions: RequestUserInputQuestion[] = [];
  for (const entry of questionsRaw) {
    const question = asRecord(entry);
    if (!question) {
      continue;
    }
    const id = asTrimmedString(question.id);
    if (!id) {
      continue;
    }

    const normalizedQuestion: RequestUserInputQuestion = {
      id,
      header: String(question.header ?? ""),
      question: String(question.question ?? ""),
      options: normalizeRequestUserInputOptions(question.options),
    };

    // Preserve the optional wire shape instead of forcing false, so the
    // normalized payload still matches the frontend request contract.
    if (question.isOther !== undefined || question.is_other !== undefined) {
      normalizedQuestion.isOther = Boolean(question.isOther ?? question.is_other);
    }

    questions.push(normalizedQuestion);
  }
  return questions;
}

function getAppServerMessageObject(
  event: AppServerEvent,
): Record<string, unknown> | null {
  if (!event || typeof event !== "object") {
    return null;
  }
  const message = (event as { message?: unknown }).message;
  if (!message || typeof message !== "object" || Array.isArray(message)) {
    return null;
  }
  return message as Record<string, unknown>;
}

export function getAppServerRawMethod(event: AppServerEvent): string | null {
  const message = getAppServerMessageObject(event);
  if (!message) {
    return null;
  }
  const method = message.method;
  if (typeof method !== "string") {
    return null;
  }
  const trimmed = method.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isSupportedAppServerMethod(
  method: string,
): method is SupportedAppServerMethod {
  return SUPPORTED_METHOD_SET.has(method);
}

export function getAppServerParams(event: AppServerEvent): Record<string, unknown> {
  const message = getAppServerMessageObject(event);
  if (!message) {
    return {};
  }
  const params = message.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return {};
  }
  return params as Record<string, unknown>;
}

export function getAppServerRequestId(event: AppServerEvent): string | number | null {
  const message = getAppServerMessageObject(event);
  if (!message) {
    return null;
  }
  const requestId = message.id;
  if (typeof requestId === "number" || typeof requestId === "string") {
    return requestId;
  }
  return null;
}

export function normalizeRequestUserInputRequest(
  value: unknown,
): RequestUserInputRequest | null {
  const request = asRecord(value);
  if (!request) {
    return null;
  }
  const params = asRecord(request.params) ?? {};
  const rawRequestId = request.request_id ?? request.requestId;
  const requestId =
    typeof rawRequestId === "number" ? rawRequestId : asTrimmedString(rawRequestId);
  return {
    workspace_id: asTrimmedString(request.workspace_id ?? request.workspaceId),
    request_id: requestId,
    params: {
      thread_id: asTrimmedString(params.thread_id ?? params.threadId),
      turn_id: asTrimmedString(params.turn_id ?? params.turnId),
      item_id: asTrimmedString(params.item_id ?? params.itemId),
      questions: normalizeRequestUserInputQuestions(params.questions),
    },
  };
}

export function isApprovalRequestMethod(method: string): boolean {
  return method.endsWith("requestApproval");
}

export function isSkillsUpdateAvailableEvent(event: AppServerEvent): boolean {
  return getAppServerRawMethod(event) === "codex/event/skills_update_available";
}

export function isAppListUpdatedEvent(event: AppServerEvent): boolean {
  return getAppServerRawMethod(event) === "app/list/updated";
}
