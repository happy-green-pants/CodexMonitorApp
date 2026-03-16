// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceInfo } from "@/types";
import { WorkspaceHome } from "./WorkspaceHome";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  convertFileSrc: vi.fn(() => {
    throw new Error("convertFileSrc should not be called in web runtime");
  }),
}));

describe("WorkspaceHome", () => {
  it("does not call convertFileSrc when running outside Tauri", () => {
    const workspace: WorkspaceInfo = {
      id: "ws-1",
      name: "Project",
      path: "/tmp/project",
      connected: true,
      kind: "main",
      settings: { sidebarCollapsed: false },
    };

    expect(() => {
      render(
        <WorkspaceHome
          workspace={workspace}
          showGitInitBanner={false}
          initGitRepoLoading={false}
          onInitGitRepo={() => {}}
          runs={[]}
          recentThreadInstances={[]}
          recentThreadsUpdatedAt={null}
          prompt=""
          onPromptChange={() => {}}
          onStartRun={async () => false}
          runMode="local"
          onRunModeChange={() => {}}
          models={[]}
          selectedModelId={null}
          onSelectModel={() => {}}
          modelSelections={{}}
          onToggleModel={() => {}}
          onModelCountChange={() => {}}
          collaborationModes={[]}
          selectedCollaborationModeId={null}
          onSelectCollaborationMode={() => {}}
          reasoningOptions={[]}
          selectedEffort={null}
          onSelectEffort={() => {}}
          reasoningSupported={false}
          accessMode="current"
          onSelectAccessMode={() => {}}
          error={null}
          isSubmitting={false}
          activeWorkspaceId={workspace.id}
          activeThreadId={null}
          threadStatusById={{}}
          onSelectInstance={() => {}}
          skills={[]}
          appsEnabled={false}
          apps={[]}
          prompts={[]}
          files={[]}
          dictationEnabled={false}
          dictationState="idle"
          dictationLevel={0}
          onToggleDictation={() => {}}
          onCancelDictation={() => {}}
          onOpenDictationSettings={() => {}}
          dictationError={null}
          onDismissDictationError={() => {}}
          dictationHint={null}
          onDismissDictationHint={() => {}}
          dictationTranscript={null}
          onDictationTranscriptHandled={() => {}}
          onFileAutocompleteActiveChange={() => {}}
          agentMdContent=""
          agentMdExists={false}
          agentMdTruncated={false}
          agentMdLoading={false}
          agentMdSaving={false}
          agentMdError={null}
          agentMdDirty={false}
          onAgentMdChange={() => {}}
          onAgentMdRefresh={() => {}}
          onAgentMdSave={() => {}}
        />,
      );
    }).not.toThrow();
  });
});
