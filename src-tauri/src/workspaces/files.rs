use std::fs::File;
use std::io::Read;
use std::path::PathBuf;

use ignore::WalkBuilder;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::utils::normalize_git_path;

fn should_skip_dir(name: &str) -> bool {
    matches!(
        name,
        ".git" | "node_modules" | "dist" | "target" | "release-artifacts"
    )
}

fn should_force_include_hidden_path(path: &str) -> bool {
    path == ".env"
        || path.starts_with(".env.")
        || path.starts_with(".github/")
        || path.starts_with(".vscode/")
}

pub(crate) fn list_workspace_files_inner(root: &PathBuf, max_files: usize) -> Vec<String> {
    let mut results = Vec::new();
    let walker = WalkBuilder::new(root)
        // Allow hidden entries so we can selectively include common config files.
        .hidden(false)
        // Avoid crawling symlink targets.
        .follow_links(false)
        // Don't require git to be present to apply to apply git-related ignore rules.
        .require_git(false)
        .filter_entry(|entry| {
            if entry.depth() == 0 {
                return true;
            }
            if entry.file_type().is_some_and(|ft| ft.is_dir()) {
                let name = entry.file_name().to_string_lossy();
                return !should_skip_dir(&name);
            }
            true
        })
        .build();

    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if !entry.file_type().is_some_and(|ft| ft.is_file()) {
            continue;
        }
        if let Ok(rel_path) = entry.path().strip_prefix(root) {
            let normalized = normalize_git_path(&rel_path.to_string_lossy());
            let is_hidden_path = normalized
                .split('/')
                .any(|segment| segment.starts_with('.') && segment != "." && segment != "..");
            if !normalized.is_empty()
                && (!is_hidden_path || should_force_include_hidden_path(&normalized))
            {
                results.push(normalized);
            }
        }
        if results.len() >= max_files {
            break;
        }
    }

    results.sort();
    results
}

const MAX_WORKSPACE_FILE_BYTES: u64 = 400_000;

#[derive(Serialize, Deserialize, Clone)]
pub(crate) struct WorkspaceFileResponse {
    pub(crate) content: String,
    pub(crate) truncated: bool,
    pub(crate) revision: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub(crate) struct WorkspaceFileWriteResponse {
    pub(crate) revision: String,
}

fn file_revision(metadata: &std::fs::Metadata, content: &[u8]) -> String {
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|value| value.as_millis())
        .unwrap_or(0);
    let mut hasher = Sha256::new();
    hasher.update(metadata.len().to_string().as_bytes());
    hasher.update(b":");
    hasher.update(modified_ms.to_string().as_bytes());
    hasher.update(b":");
    hasher.update(content);
    format!("sha256:{:x}", hasher.finalize())
}

pub(crate) fn read_workspace_file_inner(
    root: &PathBuf,
    relative_path: &str,
) -> Result<WorkspaceFileResponse, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);
    let canonical_path = candidate
        .canonicalize()
        .map_err(|err| format!("Failed to open file: {err}"))?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("Invalid file path".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path)
        .map_err(|err| format!("Failed to read file metadata: {err}"))?;
    if !metadata.is_file() {
        return Err("Path is not a file".to_string());
    }

    let file = File::open(&canonical_path).map_err(|err| format!("Failed to open file: {err}"))?;
    let mut buffer = Vec::new();
    file.take(MAX_WORKSPACE_FILE_BYTES + 1)
        .read_to_end(&mut buffer)
        .map_err(|err| format!("Failed to read file: {err}"))?;

    let truncated = buffer.len() > MAX_WORKSPACE_FILE_BYTES as usize;
    if truncated {
        buffer.truncate(MAX_WORKSPACE_FILE_BYTES as usize);
    }

    let content = String::from_utf8(buffer).map_err(|_| "File is not valid UTF-8".to_string())?;
    let revision = file_revision(&metadata, content.as_bytes());
    Ok(WorkspaceFileResponse {
        content,
        truncated,
        revision,
    })
}

pub(crate) fn write_workspace_file_inner(
    root: &PathBuf,
    relative_path: &str,
    content: &str,
    expected_revision: Option<&str>,
) -> Result<WorkspaceFileWriteResponse, String> {
    let canonical_root = root
        .canonicalize()
        .map_err(|err| format!("Failed to resolve workspace root: {err}"))?;
    let candidate = canonical_root.join(relative_path);
    let parent = candidate
        .parent()
        .ok_or_else(|| "Invalid file path".to_string())?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|err| format!("Failed to resolve file parent: {err}"))?;
    if !canonical_parent.starts_with(&canonical_root) {
        return Err("Invalid file path".to_string());
    }

    if candidate.exists() {
        let current = read_workspace_file_inner(root, relative_path)?;
        if current.truncated {
            return Err("File is too large to edit safely".to_string());
        }
        if let Some(expected_revision) = expected_revision {
            if current.revision != expected_revision {
                return Err("Workspace file revision conflict".to_string());
            }
        }
    } else if expected_revision.is_some() {
        return Err("Workspace file revision conflict".to_string());
    }

    std::fs::write(&candidate, content).map_err(|err| format!("Failed to write file: {err}"))?;
    let updated = read_workspace_file_inner(root, relative_path)?;
    Ok(WorkspaceFileWriteResponse {
        revision: updated.revision,
    })
}
