import { DebugPanel } from "../../../debug/components/DebugPanel";
import { PlanPanel } from "../../../plan/components/PlanPanel";
import { TerminalDock } from "../../../terminal/components/TerminalDock";
import { TerminalPanel } from "../../../terminal/components/TerminalPanel";
import type {
  LayoutNodesResult,
  LayoutSecondarySurface,
} from "./types";

export type SecondaryLayoutNodesOptions = LayoutSecondarySurface;

type SecondaryLayoutNodes = Pick<
  LayoutNodesResult,
  | "planPanelNode"
  | "debugPanelNode"
  | "debugPanelFullNode"
  | "terminalDockNode"
  | "compactEmptyCodexNode"
  | "compactEmptyGitNode"
  | "compactGitBackNode"
>;

export function buildSecondaryNodes(options: SecondaryLayoutNodesOptions): SecondaryLayoutNodes {
  const planPanelNode = <PlanPanel {...options.planPanelProps} />;

  const terminalPanelNode = options.terminalState ? (
    <TerminalPanel
      containerRef={options.terminalState.containerRef}
      status={options.terminalState.status}
      message={options.terminalState.message}
    />
  ) : null;

  const terminalDockNode = (
    <TerminalDock
      {...options.terminalDockProps}
      terminalNode={terminalPanelNode}
    />
  );

  const debugPanelNode = <DebugPanel {...options.debugPanelProps} />;

  const debugPanelFullNode = (
    <DebugPanel
      {...options.debugPanelProps}
      isOpen
      variant="full"
    />
  );

  const compactEmptyCodexNode = (
    <div className="compact-empty">
      <h3>No workspace selected</h3>
      <p>Choose a project to start chatting.</p>
      <button className="ghost" onClick={options.compactNavProps.onGoProjects}>
        Go to Projects
      </button>
    </div>
  );

  const compactEmptyGitNode = (
    <div className="compact-empty">
      <h3>No workspace selected</h3>
      <p>Select a project to inspect diffs.</p>
      <button className="ghost" onClick={options.compactNavProps.onGoProjects}>
        Go to Projects
      </button>
    </div>
  );

  const compactGitDiffActive =
    options.compactNavProps.centerMode === "diff" &&
    Boolean(options.compactNavProps.selectedDiffPath);
  const compactWorkspaceFileActive =
    options.compactNavProps.centerMode === "file" &&
    Boolean(options.compactNavProps.activeWorkspaceFilePath);
  const compactGitBackNode = (
    <div className="compact-git-back">
      <button
        type="button"
        className={`compact-git-switch-button${
          compactGitDiffActive || compactWorkspaceFileActive ? "" : " active"
        }`}
        onClick={options.compactNavProps.onBackFromDiff}
      >
        Files
      </button>
      <button
        type="button"
        className={`compact-git-switch-button${compactWorkspaceFileActive ? " active" : ""}`}
        onClick={options.compactNavProps.onShowActiveFile}
        disabled={!options.compactNavProps.hasActiveWorkspaceFile}
      >
        Editor
      </button>
      <button
        type="button"
        className={`compact-git-switch-button${compactGitDiffActive ? " active" : ""}`}
        onClick={options.compactNavProps.onShowSelectedDiff}
        disabled={!options.compactNavProps.hasActiveGitDiffs}
      >
        Diff
      </button>
    </div>
  );

  return {
    planPanelNode,
    debugPanelNode,
    debugPanelFullNode,
    terminalDockNode,
    compactEmptyCodexNode,
    compactEmptyGitNode,
    compactGitBackNode,
  };
}
