// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMainAppShellProps } from "./useMainAppShellProps";

describe("useMainAppShellProps", () => {
  it("renders the remote switcher node alongside the remote connection indicator", () => {
    const result = useMainAppShellProps({
      shell: {
        appClassName: "app",
        isResizing: false,
        appStyle: {},
        appRef: { current: null },
        sidebarToggleProps: {
          isCompact: false,
          sidebarCollapsed: false,
          rightPanelCollapsed: false,
          onCollapseSidebar: () => undefined,
          onExpandSidebar: () => undefined,
          onCollapseRightPanel: () => undefined,
          onExpandRightPanel: () => undefined,
        },
        shouldLoadGitHubPanelData: false,
        appModalsProps: {} as never,
        showMobileSetupWizard: false,
        mobileSetupWizardProps: {} as never,
      },
      gitHubPanelDataProps: {
        activeWorkspace: null,
        gitPanelMode: "diff",
        shouldLoadDiffs: false,
        diffSource: "local",
        selectedPullRequestNumber: null,
        onIssuesChange: () => undefined,
        onPullRequestsChange: () => undefined,
        onPullRequestDiffsChange: () => undefined,
        onPullRequestCommentsChange: () => undefined,
      },
      appLayout: {
        isPhone: false,
        isTablet: false,
        showHome: false,
        showGitDetail: false,
        activeTab: "codex",
        tabletTab: "codex",
        centerMode: "chat",
        preloadGitDiffs: false,
        splitChatDiffView: false,
        hasActivePlan: false,
        activeWorkspace: true,
        sidebarNode: null,
        messagesNode: null,
        composerNode: null,
        approvalToastsNode: null,
        updateToastNode: null,
        errorToastsNode: null,
        homeNode: null,
        mainHeaderNode: null,
        tabletNavNode: null,
        tabBarNode: null,
        gitDiffPanelNode: null,
        centerDetailNode: null,
        planPanelNode: null,
        debugPanelNode: null,
        debugPanelFullNode: null,
        terminalDockNode: null,
        compactEmptyCodexNode: null,
        compactEmptyGitNode: null,
        compactGitBackNode: null,
        onSidebarResizeStart: () => undefined,
        onChatDiffSplitPositionResizeStart: () => undefined,
        onRightPanelResizeStart: () => undefined,
        onPlanPanelResizeStart: () => undefined,
      },
      topbar: {
        isCompact: false,
        desktopTopbarLeftNode: null,
        hasActiveWorkspace: true,
        backendMode: "remote",
        remoteThreadConnectionState: "live",
        remoteSwitcherNode: <button type="button">Switch remote</button>,
      },
    });

    render(<>{result.appLayoutProps.topbarActionsNode}</>);

    expect(screen.getByRole("button", { name: "Switch remote" })).toBeTruthy();
    expect(screen.getByText("Live")).toBeTruthy();
  });
});
