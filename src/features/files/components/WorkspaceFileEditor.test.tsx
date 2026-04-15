/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceFileEditor } from "./WorkspaceFileEditor";
import { readWorkspaceFile, writeWorkspaceFile } from "@/services/tauri";

vi.mock("@/services/tauri", () => ({
  readWorkspaceFile: vi.fn(),
  writeWorkspaceFile: vi.fn(),
}));

const editorStateCreate = vi.hoisted(() => vi.fn(({ doc, extensions }) => ({ doc, extensions })));
type MockEditorUpdate = {
  docChanged: boolean;
  state: { doc: { toString: () => string } };
};

type MockEditorUpdateListener = (update: MockEditorUpdate) => void;

const editorUpdateListeners = vi.hoisted(() => [] as MockEditorUpdateListener[]);
const mockEditorView = vi.hoisted(() => {
  return class MockEditorView {
    static theme: (value: unknown) => unknown = vi.fn((value: unknown) => value);
    static updateListener: {
      of: (listener: MockEditorUpdateListener) => MockEditorUpdateListener;
    } = {
      of: vi.fn((listener: MockEditorUpdateListener) => {
        editorUpdateListeners.push(listener);
        return listener;
      }),
    };

    state: { doc: { toString: () => string } };
    parent: HTMLElement;

    constructor({ state, parent }: { state: { doc: string }; parent: HTMLElement }) {
      this.parent = parent;
      this.state = {
        doc: {
          toString: () => state.doc,
        },
      };
      parent.setAttribute("data-codemirror-mounted", "true");
    }

    dispatch({ changes }: { changes: { insert: string } }) {
      this.state = {
        doc: {
          toString: () => changes.insert,
        },
      };
    }

    setState(state: { doc: string }) {
      this.state = {
        doc: {
          toString: () => state.doc,
        },
      };
    }

    destroy() {
      this.parent.removeAttribute("data-codemirror-mounted");
    }
  };
});

vi.mock("@codemirror/state", () => ({
  EditorState: {
    create: editorStateCreate,
  },
}));

vi.mock("@codemirror/view", () => ({
  EditorView: mockEditorView,
  keymap: {
    of: vi.fn((value) => value),
  },
  lineNumbers: vi.fn(() => "lineNumbers"),
}));

vi.mock("@codemirror/commands", () => ({
  defaultKeymap: [],
  history: vi.fn(() => "history"),
  historyKeymap: [],
  indentWithTab: { key: "Tab" },
}));

vi.mock("@codemirror/language", () => ({
  syntaxHighlighting: vi.fn(() => "syntaxHighlighting"),
  defaultHighlightStyle: {},
}));

vi.mock("@codemirror/lang-javascript", () => ({
  javascript: vi.fn(() => "javascript"),
}));

vi.mock("@codemirror/lang-rust", () => ({
  rust: vi.fn(() => "rust"),
}));

vi.mock("@codemirror/lang-json", () => ({
  json: vi.fn(() => "json"),
}));

vi.mock("@codemirror/lang-markdown", () => ({
  markdown: vi.fn(() => "markdown"),
}));

vi.mock("@codemirror/lang-css", () => ({
  css: vi.fn(() => "css"),
}));

vi.mock("@codemirror/lang-html", () => ({
  html: vi.fn(() => "html"),
}));

vi.mock("@codemirror/lang-yaml", () => ({
  yaml: vi.fn(() => "yaml"),
}));

describe("WorkspaceFileEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorUpdateListeners.length = 0;
  });

  afterEach(() => {
    cleanup();
  });

  it("loads a workspace file into the center editor", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const answer = 42;\n",
      truncated: false,
      revision: "sha256:one",
    });

    render(
      <WorkspaceFileEditor
        workspaceId="ws-1"
        workspaceName="CodexMonitor"
        path="src/example.ts"
      />,
    );

    await waitFor(() => {
      expect(readWorkspaceFile).toHaveBeenCalledWith("ws-1", "src/example.ts");
    });

    expect(screen.getByText("编辑文件")).toBeTruthy();
    expect(screen.getByText("src/example.ts")).toBeTruthy();
    await waitFor(() => {
      expect(document.querySelector("[data-codemirror-mounted='true']")).toBeTruthy();
    });
  });

  it("saves the current draft with the expected revision", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const answer = 42;\n",
      truncated: false,
      revision: "sha256:one",
    });
    vi.mocked(writeWorkspaceFile).mockResolvedValue({
      revision: "sha256:two",
    });

    render(
      <WorkspaceFileEditor
        workspaceId="ws-1"
        workspaceName="CodexMonitor"
        path="src/example.ts"
      />,
    );

    await waitFor(() => {
      expect(readWorkspaceFile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(editorUpdateListeners.length).toBeGreaterThan(0);
    });

    const latestListener = editorUpdateListeners[editorUpdateListeners.length - 1];
    if (!latestListener) {
      throw new Error("Expected a CodeMirror update listener");
    }

    await act(async () => {
      latestListener({
        docChanged: true,
        state: {
          doc: {
            toString: () => "const answer = 43;\n",
          },
        },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(writeWorkspaceFile).toHaveBeenCalledWith(
        "ws-1",
        "src/example.ts",
        "const answer = 43;\n",
        "sha256:one",
      );
    });
  });

  it("shows revision conflict errors returned by the backend", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "console.log('one')\n",
      truncated: false,
      revision: "sha256:base",
    });
    vi.mocked(writeWorkspaceFile).mockRejectedValue(new Error("Workspace file revision conflict"));

    render(
      <WorkspaceFileEditor
        workspaceId="ws-1"
        workspaceName="CodexMonitor"
        path="src/example.ts"
      />,
    );

    await waitFor(() => {
      expect(readWorkspaceFile).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(editorUpdateListeners.length).toBeGreaterThan(0);
    });

    const latestListener = editorUpdateListeners[editorUpdateListeners.length - 1];
    if (!latestListener) {
      throw new Error("Expected a CodeMirror update listener");
    }

    await act(async () => {
      latestListener({
        docChanged: true,
        state: {
          doc: {
            toString: () => "console.log('two')\n",
          },
        },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(screen.getByText("Workspace file revision conflict")).toBeTruthy();
    });
  });

  it("keeps the editor width bounded and scrolls long lines inside CodeMirror", async () => {
    vi.mocked(readWorkspaceFile).mockResolvedValue({
      content: "const answer = 'this is a very long line that should stay inside the editor viewport';\n",
      truncated: false,
      revision: "sha256:layout",
    });

    render(
      <WorkspaceFileEditor
        workspaceId="ws-1"
        workspaceName="CodexMonitor"
        path="src/example.ts"
      />,
    );

    await waitFor(() => {
      expect(readWorkspaceFile).toHaveBeenCalled();
    });

    const latestEditorStateCall =
      editorStateCreate.mock.calls[editorStateCreate.mock.calls.length - 1];
    const editorStateArgs = latestEditorStateCall?.[0];
    const extensions = editorStateArgs?.extensions as Array<Record<string, unknown>> | undefined;
    const themeExtension = extensions?.find(
      (extension) =>
        typeof extension === "object" &&
        extension !== null &&
        "&" in extension &&
        ".cm-scroller" in extension,
    ) as Record<string, Record<string, string>> | undefined;

    expect(themeExtension).toBeTruthy();
    expect(themeExtension?.["&"]).toMatchObject({
      width: "100%",
      maxWidth: "100%",
      minWidth: "0",
    });
    expect(themeExtension?.[".cm-scroller"]).toMatchObject({
      overflowX: "auto",
      overflowY: "auto",
      scrollbarGutter: "stable",
      minWidth: "0",
    });
    expect(themeExtension?.[".cm-content"]).toMatchObject({
      minWidth: "100%",
      width: "max-content",
    });
  });
});
