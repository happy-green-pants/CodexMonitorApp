import { memo, useMemo } from "react";
import ChevronLeft from "lucide-react/dist/esm/icons/chevron-left";
import Folder from "lucide-react/dist/esm/icons/folder";
import HardDrive from "lucide-react/dist/esm/icons/hard-drive";
import { ModalShell } from "../../design-system/components/modal/ModalShell";
import type { DirectoryEntry } from "../../../types";

const DEFAULT_ROOT_PATH = "/";

type DirectoryBrowserPromptProps = {
  currentPath: string | null;
  entries: DirectoryEntry[];
  isLoading: boolean;
  error: string | null;
  onNavigate: (path: string | null) => void;
  onConfirm: (path: string) => void;
  onCancel: () => void;
};

export const DirectoryBrowserPrompt = memo(function DirectoryBrowserPrompt({
  currentPath,
  entries,
  isLoading,
  error,
  onNavigate,
  onConfirm,
  onCancel,
}: DirectoryBrowserPromptProps) {
  const resolvedPath = currentPath?.trim() || DEFAULT_ROOT_PATH;
  const isRoot = resolvedPath === DEFAULT_ROOT_PATH;
  const parentPath = useMemo(() => {
    if (isRoot) {
      return DEFAULT_ROOT_PATH;
    }
    const normalized = resolvedPath.replace(/\/+$/, "");
    const lastSlash = normalized.lastIndexOf("/");
    if (lastSlash <= 0) {
      return DEFAULT_ROOT_PATH;
    }
    return normalized.slice(0, lastSlash);
  }, [isRoot, resolvedPath]);

  return (
    <ModalShell
      ariaLabel="Browse remote directories"
      className="directory-browser-modal"
      cardClassName="directory-browser-modal-card"
      onBackdropClick={onCancel}
    >
      <div className="directory-browser-modal-content">
        <div className="ds-modal-title">Select workspace directory</div>
        <div className="ds-modal-subtitle">
          Browse directories on the connected server.
        </div>
        <div className="directory-browser-path-bar">
          <button
            type="button"
            className="ghost directory-browser-back"
            onClick={() => onNavigate(isRoot ? null : parentPath)}
            disabled={isRoot}
            title={isRoot ? "At root" : "Go up"}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="directory-browser-current-path" title={resolvedPath}>
            {resolvedPath}
          </div>
        </div>

        <div className="directory-browser-list-container">
          {isLoading ? (
            <div className="directory-browser-status">Loading directories…</div>
          ) : error ? (
            <div className="directory-browser-error-state">
              <div className="ds-modal-error">{error}</div>
              <button
                className="primary ds-modal-button"
                type="button"
                onClick={() => onNavigate(currentPath)}
              >
                Retry
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="directory-browser-empty">No subdirectories found.</div>
          ) : (
            <div className="directory-browser-list">
              {entries.map((entry) => (
                <div key={entry.path} className="directory-browser-item">
                  <button
                    type="button"
                    className="directory-browser-item-name"
                    onClick={() => onNavigate(entry.path)}
                    title={entry.path}
                  >
                    {entry.isDir ? (
                      <Folder size={16} aria-hidden />
                    ) : (
                      <HardDrive size={16} aria-hidden />
                    )}
                    <span>{entry.name}</span>
                  </button>
                  <button
                    type="button"
                    className="primary compact directory-browser-item-select"
                    onClick={() => onConfirm(entry.path)}
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ds-modal-actions">
          <button className="ghost ds-modal-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className="primary ds-modal-button"
            onClick={() => onConfirm(resolvedPath)}
            type="button"
          >
            Select current folder
          </button>
        </div>
      </div>
    </ModalShell>
  );
});
