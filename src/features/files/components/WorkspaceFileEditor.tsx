import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import Save from "lucide-react/dist/esm/icons/save";
import AlertTriangle from "lucide-react/dist/esm/icons/triangle-alert";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { yaml } from "@codemirror/lang-yaml";
import { readWorkspaceFile, writeWorkspaceFile } from "@/services/tauri";

type WorkspaceFileEditorProps = {
  workspaceId: string;
  workspaceName: string;
  path: string;
  onSaved?: () => void;
};

type LanguageExtension =
  | ReturnType<typeof javascript>
  | ReturnType<typeof rust>
  | ReturnType<typeof json>
  | ReturnType<typeof markdown>
  | ReturnType<typeof css>
  | ReturnType<typeof html>
  | ReturnType<typeof yaml>;

type FileLoadState =
  | { status: "idle" | "loading"; message?: string | null }
  | { status: "ready"; truncated: boolean; revision: string; originalContent: string }
  | { status: "error"; message: string };

type FileLanguageResolver = () => {
  name: string;
  extension: LanguageExtension | null;
};

function resolveLanguage(path: string): ReturnType<FileLanguageResolver> {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "mjs":
    case "cjs":
      return { name: "JavaScript", extension: javascript({ jsx: ext.includes("x"), typescript: ext.startsWith("t") }) };
    case "rs":
      return { name: "Rust", extension: rust() };
    case "json":
      return { name: "JSON", extension: json() };
    case "md":
      return { name: "Markdown", extension: markdown() };
    case "css":
    case "scss":
    case "sass":
      return { name: "CSS", extension: css() };
    case "html":
      return { name: "HTML", extension: html() };
    case "yaml":
    case "yml":
      return { name: "YAML", extension: yaml() };
    default:
      return { name: "Plain text", extension: null };
  }
}

function buildEditorState({
  doc,
  onSave,
  onChange,
  path,
}: {
  doc: string;
  onSave: () => void;
  onChange: (value: string) => void;
  path: string;
}) {
  const language = resolveLanguage(path);
  const extensions = [
    lineNumbers(),
    history(),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      indentWithTab,
      {
        key: "Mod-s",
        run: () => {
          onSave();
          return true;
        },
      },
    ]),
    EditorView.theme({
      // Keep long lines contained inside the editor scroller instead of letting
      // CodeMirror content width participate in outer layout sizing.
      "&": {
        height: "100%",
        width: "100%",
        maxWidth: "100%",
        minWidth: "0",
        fontSize: "var(--code-font-size, 13px)",
        backgroundColor: "transparent",
        color: "var(--text-strong)",
      },
      ".cm-scroller": {
        fontFamily: "var(--code-font-family, monospace)",
        lineHeight: "1.6",
        overflowX: "auto",
        overflowY: "auto",
        scrollbarGutter: "stable",
        minWidth: "0",
      },
      ".cm-content": {
        padding: "18px 0 20px",
        minWidth: "100%",
        width: "max-content",
      },
      ".cm-gutters": {
        background: "transparent",
        borderRight: "1px solid var(--border-subtle)",
        color: "var(--text-muted)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "color-mix(in srgb, var(--surface-active) 58%, transparent)",
      },
      ".cm-activeLine": {
        backgroundColor: "color-mix(in srgb, var(--surface-active) 58%, transparent)",
      },
      ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
        backgroundColor: "color-mix(in srgb, var(--accent-primary) 26%, transparent)",
      },
      "&.cm-focused": {
        outline: "none",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "var(--accent-primary)",
      },
      ".cm-panels": {
        backgroundColor: "transparent",
      },
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    }),
  ];

  if (language.extension) {
    extensions.push(language.extension);
  }

  return EditorState.create({
    doc,
    extensions,
  });
}

export function WorkspaceFileEditor({
  workspaceId,
  workspaceName,
  path,
  onSaved,
}: WorkspaceFileEditorProps) {
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const latestSaveRef = useRef<() => void>(() => {});
  const [loadState, setLoadState] = useState<FileLoadState>({ status: "idle" });
  const [draftContent, setDraftContent] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const languageLabel = useMemo(() => resolveLanguage(path).name, [path]);
  const readyState = loadState.status === "ready" ? loadState : null;
  const isDirty = readyState ? draftContent !== readyState.originalContent : false;
  const isBusy = loadState.status === "loading" || isSaving;

  const replaceEditorDoc = (value: string) => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === value) {
      return;
    }
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
  };

  const loadFile = async (mode: "initial" | "reload") => {
    setSaveError(null);
    setSaveNotice(null);
    setLoadState({
      status: "loading",
      message: mode === "reload" ? "正在重新加载文件..." : "正在加载文件...",
    });
    try {
      const response = await readWorkspaceFile(workspaceId, path);
      setDraftContent(response.content);
      setLoadState({
        status: "ready",
        truncated: response.truncated,
        revision: response.revision,
        originalContent: response.content,
      });
      replaceEditorDoc(response.content);
    } catch (error) {
      setLoadState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleSave = async () => {
    if (!readyState || isSaving || !isDirty) {
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const response = await writeWorkspaceFile(
        workspaceId,
        path,
        draftContent,
        readyState.revision,
      );
      setLoadState({
        status: "ready",
        truncated: false,
        revision: response.revision,
        originalContent: draftContent,
      });
      setSaveNotice("已保存");
      onSaved?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  };

  latestSaveRef.current = handleSave;

  useEffect(() => {
    void loadFile("initial");
    // 路径变化时必须重载内容，并清空上一个文件的保存态。
  }, [workspaceId, path]);

  useLayoutEffect(() => {
    const root = editorRootRef.current;
    if (!root || editorViewRef.current) {
      return;
    }
    const view = new EditorView({
      state: buildEditorState({
        doc: draftContent,
        path,
        onChange: setDraftContent,
        onSave: () => latestSaveRef.current(),
      }),
      parent: root,
    });
    editorViewRef.current = view;
    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [readyState, draftContent, path]);

  useEffect(() => {
    const root = editorRootRef.current;
    const view = editorViewRef.current;
    if (!root || !view) {
      return;
    }
    const nextState = buildEditorState({
      doc: draftContent,
      path,
      onChange: setDraftContent,
      onSave: () => latestSaveRef.current(),
    });
    view.setState(nextState);
  }, [path]);

  useEffect(() => {
    replaceEditorDoc(draftContent);
  }, [draftContent]);

  const metaParts: string[] = [workspaceName, languageLabel];
  if (readyState?.truncated) {
    metaParts.push("只读截断预警");
  }
  if (isDirty) {
    metaParts.push("未保存");
  }

  let body: ReactNode;
  if (loadState.status === "error") {
    body = (
      <div className="workspace-file-editor-state">
        <div className="workspace-file-editor-state-icon">
          <AlertTriangle aria-hidden />
        </div>
        <div className="workspace-file-editor-state-title">文件加载失败</div>
        <div className="workspace-file-editor-state-copy">{loadState.message}</div>
        <button
          type="button"
          className="ghost"
          onClick={() => {
            void loadFile("reload");
          }}
        >
          重试
        </button>
      </div>
    );
  } else if (!readyState) {
    body = (
      <div className="workspace-file-editor-state">
        <div className="workspace-file-editor-state-title">
          {loadState.status === "loading" ? loadState.message ?? "正在加载文件..." : "准备打开文件..."}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="workspace-file-editor-body">
        <div className="workspace-file-editor-toolbar">
          <div className="workspace-file-editor-path">{path}</div>
          <div className="workspace-file-editor-status">
            {saveNotice ? <span className="workspace-file-editor-success">{saveNotice}</span> : null}
            {readyState.truncated ? (
              <span className="workspace-file-editor-warning">
                文件内容过大，当前内容可能为截断结果；已阻止保存覆盖。
              </span>
            ) : null}
          </div>
        </div>
        {saveError ? <div className="workspace-file-editor-error">{saveError}</div> : null}
        <div className="workspace-file-editor-canvas">
          <div
            ref={editorRootRef}
            className="workspace-file-editor-code"
          />
        </div>
      </div>
    );
  }

  return (
    <section className="workspace-file-editor" aria-label={`Workspace file editor ${path}`}>
      <header className="workspace-file-editor-header">
        <div>
          <div className="workspace-file-editor-title">编辑文件</div>
          <div className="workspace-file-editor-meta">{metaParts.join(" • ")}</div>
        </div>
        <div className="workspace-file-editor-actions">
          <button
            type="button"
            className="ghost workspace-file-editor-button"
            onClick={() => {
              void loadFile("reload");
            }}
            disabled={isBusy}
            title="重新加载文件"
          >
            <RefreshCw aria-hidden />
            <span>重载</span>
          </button>
          <button
            type="button"
            className="primary workspace-file-editor-button"
            onClick={() => {
              void handleSave();
            }}
            disabled={!readyState || !isDirty || isBusy || readyState.truncated}
            title="保存文件"
          >
            <Save aria-hidden />
            <span>{isSaving ? "保存中..." : "保存"}</span>
          </button>
        </div>
      </header>
      {body}
    </section>
  );
}
