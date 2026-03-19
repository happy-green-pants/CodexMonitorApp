use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use git2::{ConfigLevel, Repository};
use tokio::process::Command as TokioCommand;

use crate::utils::git_env_path;

pub(crate) const GIT_CONFIG_GLOBAL_ENV: &str = "GIT_CONFIG_GLOBAL";
const GIT_RUNTIME_DIRNAME: &str = "git-runtime";
const GIT_GLOBAL_CONFIG_NAME: &str = ".gitconfig";
const GIT_XDG_CONFIG_RELATIVE: &str = ".config/git/config";
const APP_MANAGED_GIT_CONFIG: &str = "[safe]\n\tdirectory = *\n";

static GIT_RUNTIME_INIT: OnceLock<Result<GitRuntimeContext, String>> = OnceLock::new();

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct GitRuntimeContext {
    pub(crate) root_dir: PathBuf,
    pub(crate) global_config_path: PathBuf,
    pub(crate) xdg_config_path: PathBuf,
}

pub(crate) fn initialize_app_git_runtime(
    data_dir: &Path,
) -> Result<&'static GitRuntimeContext, String> {
    let data_dir = data_dir.to_path_buf();
    let result = GIT_RUNTIME_INIT.get_or_init(|| initialize_app_git_runtime_inner(&data_dir));
    result.as_ref().map_err(Clone::clone)
}

fn initialize_app_git_runtime_inner(data_dir: &Path) -> Result<GitRuntimeContext, String> {
    let context = ensure_app_managed_git_config(data_dir)?;
    env::set_var(GIT_CONFIG_GLOBAL_ENV, &context.global_config_path);

    // SAFETY: this mutates libgit2 global search paths and must happen before repository access.
    unsafe {
        git2::opts::set_search_path(ConfigLevel::Global, git_search_path(&context.root_dir))
            .map_err(|error| {
                format!("Failed to configure libgit2 global config search path: {error}")
            })?;
        git2::opts::set_search_path(
            ConfigLevel::XDG,
            git_search_path(&xdg_root_dir(&context.root_dir)),
        )
        .map_err(|error| format!("Failed to configure libgit2 XDG config search path: {error}"))?;
    }

    Ok(context)
}

pub(crate) fn ensure_app_managed_git_config(data_dir: &Path) -> Result<GitRuntimeContext, String> {
    let root_dir = app_managed_git_runtime_dir(data_dir);
    fs::create_dir_all(&root_dir)
        .map_err(|error| format!("Failed to create app-managed Git runtime dir: {error}"))?;

    let global_config_path = root_dir.join(GIT_GLOBAL_CONFIG_NAME);
    write_file_if_changed(&global_config_path, APP_MANAGED_GIT_CONFIG)?;

    let xdg_config_path = root_dir.join(GIT_XDG_CONFIG_RELATIVE);
    let xdg_parent = xdg_config_path
        .parent()
        .ok_or_else(|| "Failed to resolve app-managed XDG Git config directory.".to_string())?;
    fs::create_dir_all(xdg_parent)
        .map_err(|error| format!("Failed to create app-managed XDG Git config dir: {error}"))?;
    write_file_if_changed(&xdg_config_path, APP_MANAGED_GIT_CONFIG)?;

    Ok(GitRuntimeContext {
        root_dir,
        global_config_path,
        xdg_config_path,
    })
}

fn write_file_if_changed(path: &Path, content: &str) -> Result<(), String> {
    if let Ok(existing) = fs::read_to_string(path) {
        if existing == content {
            return Ok(());
        }
    }

    fs::write(path, content).map_err(|error| {
        format!(
            "Failed to write app-managed Git config at {}: {error}",
            path.display()
        )
    })
}

pub(crate) fn app_managed_git_runtime_dir(data_dir: &Path) -> PathBuf {
    data_dir.join(GIT_RUNTIME_DIRNAME)
}

fn xdg_root_dir(root_dir: &Path) -> PathBuf {
    root_dir.join(".config")
}

fn git_search_path(path: &Path) -> String {
    format!("{}{}$PATH", path.to_string_lossy(), git_path_list_separator())
}

fn git_path_list_separator() -> char {
    if cfg!(windows) {
        ';'
    } else {
        ':'
    }
}

pub(crate) fn current_git_config_global_path() -> Option<PathBuf> {
    env::var_os(GIT_CONFIG_GLOBAL_ENV)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

pub(crate) fn configure_tokio_git_command(command: &mut TokioCommand) {
    command.env("PATH", git_env_path());
    if let Some(path) = current_git_config_global_path() {
        command.env(GIT_CONFIG_GLOBAL_ENV, path);
    }
}

pub(crate) fn configure_std_git_command(command: &mut std::process::Command) {
    command.env("PATH", git_env_path());
    if let Some(path) = current_git_config_global_path() {
        command.env(GIT_CONFIG_GLOBAL_ENV, path);
    }
}

pub(crate) fn open_repository(repo_root: &Path) -> Result<Repository, String> {
    Repository::open(repo_root).map_err(|error| format_git_access_error(&error))
}

pub(crate) fn format_git_access_error(error: &git2::Error) -> String {
    let detail = error.to_string();
    if is_git_ownership_error_message(&detail) {
        return format!(
            "Git access blocked by repository ownership rules. CodexMonitor could not trust this repository yet. Original error: {detail}"
        );
    }
    detail
}

pub(crate) fn is_git_ownership_error_message(message: &str) -> bool {
    let normalized = message.to_lowercase();
    normalized.contains("not owned by current user")
        || normalized.contains("dubious ownership")
        || normalized.contains("safe.directory")
        || normalized.contains("owner (-36)")
        || normalized.contains("code=owner")
}

#[cfg(test)]
mod tests {
    use super::{
        configure_std_git_command, ensure_app_managed_git_config, format_git_access_error,
        is_git_ownership_error_message, GIT_CONFIG_GLOBAL_ENV,
    };
    use std::path::PathBuf;
    use std::process::Command;

    struct EnvGuard {
        key: &'static str,
        previous: Option<std::ffi::OsString>,
    }

    impl EnvGuard {
        fn set(key: &'static str, value: &PathBuf) -> Self {
            let previous = std::env::var_os(key);
            std::env::set_var(key, value);
            Self { key, previous }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            if let Some(value) = self.previous.take() {
                std::env::set_var(self.key, value);
            } else {
                std::env::remove_var(self.key);
            }
        }
    }

    #[test]
    fn ensure_app_managed_git_config_writes_safe_directory_to_both_locations() {
        let data_dir = std::env::temp_dir()
            .join(format!("codex-monitor-git-runtime-{}", uuid::Uuid::new_v4()));

        let context = ensure_app_managed_git_config(&data_dir).expect("write git runtime config");

        let global =
            std::fs::read_to_string(&context.global_config_path).expect("read global config");
        let xdg = std::fs::read_to_string(&context.xdg_config_path).expect("read xdg config");

        assert!(global.contains("directory = *"));
        assert!(xdg.contains("directory = *"));
    }

    #[test]
    fn configure_std_git_command_injects_app_managed_global_config() {
        let config_path = std::env::temp_dir().join(format!(
            "codex-monitor-git-config-{}.gitconfig",
            uuid::Uuid::new_v4()
        ));
        let _guard = EnvGuard::set(GIT_CONFIG_GLOBAL_ENV, &config_path);

        let mut command = Command::new("git");
        configure_std_git_command(&mut command);

        let envs = command
            .get_envs()
            .filter_map(|(key, value)| value.map(|value| (key.to_owned(), value.to_owned())))
            .collect::<Vec<_>>();

        assert!(
            envs.iter().any(|(key, value)| {
                key == GIT_CONFIG_GLOBAL_ENV && value == &config_path.as_os_str()
            }),
            "expected GIT_CONFIG_GLOBAL to be injected"
        );
        assert!(
            envs.iter().any(|(key, _value)| key == "PATH"),
            "expected PATH to be injected"
        );
    }

    #[test]
    fn ownership_errors_are_promoted_to_a_clear_runtime_message() {
        let error = git2::Error::from_str(
            "repository path '/tmp/repo' is not owned by current user; class=Config (7); code=Owner (-36)",
        );

        let message = format_git_access_error(&error);

        assert!(message.contains("Git access blocked by repository ownership rules."));
        assert!(message.contains("Owner (-36)"));
        assert!(is_git_ownership_error_message(&message));
    }
}
