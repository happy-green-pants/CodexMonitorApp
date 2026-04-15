import { FileTreePanel } from "../../../files/components/FileTreePanel";
import { WorkspaceFileEditor } from "../../../files/components/WorkspaceFileEditor";
import { GitDiffPanel } from "../../../git/components/GitDiffPanel";
import { GitDiffViewer } from "../../../git/components/GitDiffViewer";
import { PromptPanel } from "../../../prompts/components/PromptPanel";
import type {
  LayoutGitSurface,
  LayoutNodesResult,
} from "./types";

export type GitLayoutNodesOptions = LayoutGitSurface;

type GitLayoutNodes = Pick<LayoutNodesResult, "gitDiffPanelNode" | "centerDetailNode">;

function resolveGitDiffStyle({
  isPhone,
  splitChatDiffView,
  centerMode,
  userPreference,
}: {
  isPhone: boolean;
  splitChatDiffView: boolean;
  centerMode: GitLayoutNodesOptions["diffViewProps"]["centerMode"];
  userPreference: GitLayoutNodesOptions["diffViewProps"]["gitDiffViewStyle"];
}): GitLayoutNodesOptions["diffViewProps"]["gitDiffViewStyle"] {
  const shouldForceSingleColumn =
    isPhone || (splitChatDiffView && centerMode === "chat");
  return shouldForceSingleColumn ? "unified" : userPreference;
}

export function buildGitNodes(options: GitLayoutNodesOptions): GitLayoutNodes {
  const sidebarSelectedDiffPath =
    options.diffViewProps.centerMode === "diff"
      ? options.gitDiffViewerProps.selectedPath
      : null;

  let gitDiffPanelNode;
  if (options.filePanelMode === "files" && options.fileTreeProps) {
    gitDiffPanelNode = <FileTreePanel {...options.fileTreeProps} />;
  } else if (options.filePanelMode === "prompts") {
    gitDiffPanelNode = <PromptPanel {...options.promptPanelProps} />;
  } else {
    gitDiffPanelNode = (
      <GitDiffPanel
        {...options.gitDiffPanelProps}
        selectedPath={sidebarSelectedDiffPath}
      />
    );
  }

  const centerDetailNode = (
    options.diffViewProps.centerMode === "file" && options.workspaceFileEditorProps ? (
      <WorkspaceFileEditor {...options.workspaceFileEditorProps} />
    ) : (
      <GitDiffViewer
        {...options.gitDiffViewerProps}
        diffStyle={resolveGitDiffStyle({
          isPhone: options.diffViewProps.isPhone,
          splitChatDiffView: options.diffViewProps.splitChatDiffView,
          centerMode: options.diffViewProps.centerMode,
          userPreference: options.diffViewProps.gitDiffViewStyle,
        })}
      />
    )
  );

  return {
    gitDiffPanelNode,
    centerDetailNode,
  };
}
