/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readWorkspaceFile } from "../../../services/tauri";
import { FileTreePanel } from "./FileTreePanel";

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: `virtual-row-${index}`,
        start: index * 28,
      })),
    getTotalSize: () => count * 28,
    measureElement: vi.fn(),
  }),
}));

const menuNew = vi.hoisted(() =>
  vi.fn(async ({ items }) => ({ popup: vi.fn(), items })),
);
const menuItemNew = vi.hoisted(() => vi.fn(async (options) => options));
const convertFileSrc = vi.hoisted(() => vi.fn((path: string) => `tauri://${path}`));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc,
}));

vi.mock("@tauri-apps/api/menu", () => ({
  Menu: { new: menuNew },
  MenuItem: { new: menuItemNew },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ scaleFactor: () => 1 }),
}));

vi.mock("@tauri-apps/api/dpi", () => ({
  LogicalPosition: class LogicalPosition {
    x: number;
    y: number;
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  },
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  revealItemInDir: vi.fn(),
}));

vi.mock("../../../services/tauri", () => ({
  readWorkspaceFile: vi.fn(),
}));

vi.mock("../../app/components/OpenAppMenu", () => ({
  OpenAppMenu: () => <div data-testid="open-app-menu" />,
}));

const baseProps = {
  workspaceId: "ws-1",
  workspacePath: "/workspace",
  files: ["src/example.ts"],
  modifiedFiles: [],
  isLoading: false,
  filePanelMode: "files" as const,
  onFilePanelModeChange: vi.fn(),
  canInsertText: false,
  openTargets: [],
  openAppIconById: {},
  selectedOpenAppId: "",
  onSelectOpenAppId: vi.fn(),
  onOpenFile: vi.fn(),
};

function mockNarrowMatchMedia() {
  const original = window.matchMedia;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("max-width: 720px"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  return () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: original,
    });
  };
}

describe("FileTreePanel", () => {
  let restoreMatchMedia: (() => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    restoreMatchMedia = mockNarrowMatchMedia();
  });

  afterEach(() => {
    restoreMatchMedia?.();
    restoreMatchMedia = null;
    cleanup();
  });

  it("uses a constrained preview with backdrop on narrow screens", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "alpha\nbeta",
      truncated: false,
      revision: "sha256:preview",
    });

    render(
      <FileTreePanel
        {...baseProps}
        onOpenFile={undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "example.ts" }));

    await waitFor(() => {
      expect(readWorkspaceFile).toHaveBeenCalledWith("ws-1", "src/example.ts");
    });

    const backdrop = document.querySelector(".file-preview-overlay");
    const popover = document.querySelector(".file-preview-popover--constrained");

    expect(backdrop).toBeTruthy();
    expect(popover).toBeTruthy();

    if (!backdrop) {
      throw new Error("Expected file preview backdrop");
    }

    fireEvent.click(backdrop);

    await waitFor(() => {
      expect(document.querySelector(".file-preview-popover")).toBeNull();
    });
  });

  it("reuses the constrained shell for image previews on narrow screens", async () => {
    render(
      <FileTreePanel
        {...baseProps}
        files={["assets/photo.png"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "photo.png" }));

    await waitFor(() => {
      expect(document.querySelector(".file-preview-popover--constrained")).toBeTruthy();
    });

    expect(document.querySelector(".file-preview-overlay")).toBeTruthy();
    expect(readWorkspaceFile).not.toHaveBeenCalled();
    expect(convertFileSrc).toHaveBeenCalledWith("/workspace/assets/photo.png");
    expect(screen.getByRole("img", { name: "assets/photo.png" })).toBeTruthy();
  });

  it("opens text files in the editor surface when an editor handler is provided", async () => {
    render(<FileTreePanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "example.ts" }));

    expect(baseProps.onOpenFile).toHaveBeenCalledWith("src/example.ts");
    expect(readWorkspaceFile).not.toHaveBeenCalled();
    expect(document.querySelector(".file-preview-popover")).toBeNull();
  });
});
