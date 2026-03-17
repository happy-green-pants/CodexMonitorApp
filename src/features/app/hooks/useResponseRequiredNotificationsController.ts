import type {
  ApprovalRequest,
  DebugEntry,
  NotificationIntensity,
  RequestUserInputRequest,
} from "../../../types";
import { useWindowFocusState } from "../../layout/hooks/useWindowFocusState";
import { useAgentResponseRequiredNotifications } from "../../notifications/hooks/useAgentResponseRequiredNotifications";

type Params = {
  systemNotificationsEnabled: boolean;
  subagentSystemNotificationsEnabled: boolean;
  notificationIntensity: NotificationIntensity;
  activeWorkspaceId: string | null;
  activeThreadId: string | null;
  isChatVisible: boolean;
  isSubagentThread?: (workspaceId: string, threadId: string) => boolean;
  approvals: ApprovalRequest[];
  userInputRequests: RequestUserInputRequest[];
  getWorkspaceName?: (workspaceId: string) => string | undefined;
  onDebug?: (entry: DebugEntry) => void;
};

export function useResponseRequiredNotificationsController({
  systemNotificationsEnabled,
  subagentSystemNotificationsEnabled,
  notificationIntensity,
  activeWorkspaceId,
  activeThreadId,
  isChatVisible,
  isSubagentThread,
  approvals,
  userInputRequests,
  getWorkspaceName,
  onDebug,
}: Params) {
  const isWindowFocused = useWindowFocusState();

  useAgentResponseRequiredNotifications({
    enabled: systemNotificationsEnabled,
    subagentNotificationsEnabled: subagentSystemNotificationsEnabled,
    isSubagentThread,
    isWindowFocused,
    notificationIntensity,
    activeWorkspaceId,
    activeThreadId,
    isChatVisible,
    approvals,
    userInputRequests,
    getWorkspaceName,
    onDebug,
  });
}
