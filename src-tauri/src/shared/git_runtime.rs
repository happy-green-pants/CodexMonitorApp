use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use git2::{ConfigLevel, Repository};
use tokio::process::Command as TokioCommand;

use crate::codex::home::resolve_home_dir;
use crate::utils::git_env_path;

pub(crate) const GIT_CONFIG_GLOBAL_ENV: &str = "GIT_CONFIG_GLOBAL";
const XDG_CONFIG_HOME_ENV: &str = "XDG_CONFIG_HOME";
const GIT_RUNTIME_DIRNAME: &str = "git-runtime";
const GIT_GLOBAL_CONFIG_NAME: &str = ".gitconfig";
const GIT_XDG_CONFIG_RELATIVE: &str = ".config/git/config";
const APP_MANAGED_SAFE_DIRECTORY_CONFIG: &str = "[safe]\n\tdirectory = *\n";

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
    let global_config = build_app_managed_git_config(&system_git_global_include_paths());
    write_file_if_changed(&global_config_path, &global_config)?;

    let xdg_config_path = root_dir.join(GIT_XDG_CONFIG_RELATIVE);
    let xdg_parent = xdg_config_path
        .parent()
        .ok_or_else(|| "Failed to resolve app-managed XDG Git config directory.".to_string())?;
    fs::create_dir_all(xdg_parent)
        .map_err(|error| format!("Failed to create app-managed XDG Git config dir: {error}"))?;
    let xdg_config = build_app_managed_git_config(&[]);
    write_file_if_changed(&xdg_config_path, &xdg_config)?;

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

fn build_app_managed_git_config(include_paths: &[PathBuf]) -> String {
    let mut content = String::new();
    for path in include_paths {
        content.push_str("[include]\n\tpath = ");
        content.push_str(&git_config_path_value(path));
        content.push('\n');
    }
    content.push_str(APP_MANAGED_SAFE_DIRECTORY_CONFIG);
    content
}

fn git_config_path_value(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn system_git_global_config_path() -> Option<PathBuf> {
    resolve_home_dir().map(|home| home.join(GIT_GLOBAL_CONFIG_NAME))
}

fn system_git_xdg_config_path() -> Option<PathBuf> {
    if let Ok(value) = env::var("XDG_CONFIG_HOME") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Some(PathBuf::from(trimmed).join("git").join("config"));
        }
    }
    resolve_home_dir().map(|home| home.join(GIT_XDG_CONFIG_RELATIVE))
}

fn system_git_global_include_paths() -> Vec<PathBuf> {
    let mut paths = system_git_xdg_include_paths();
    if let Some(path) = system_git_global_config_path().filter(|path| path.exists()) {
        if !paths.contains(&path) {
            paths.push(path);
        }
    }
    paths
}

fn system_git_xdg_include_paths() -> Vec<PathBuf> {
    system_git_xdg_config_path()
        .filter(|path| path.exists())
        .into_iter()
        .collect()
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
    if let Some(path) = current_git_xdg_config_home() {
        command.env(XDG_CONFIG_HOME_ENV, path);
    }
}

pub(crate) fn configure_std_git_command(command: &mut std::process::Command) {
    command.env("PATH", git_env_path());
    if let Some(path) = current_git_config_global_path() {
        command.env(GIT_CONFIG_GLOBAL_ENV, path);
    }
    if let Some(path) = current_git_xdg_config_home() {
        command.env(XDG_CONFIG_HOME_ENV, path);
    }
}

fn current_git_xdg_config_home() -> Option<PathBuf> {
    current_git_config_global_path()
        .and_then(|path| path.parent().map(xdg_root_dir))
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
        APP_MANAGED_SAFE_DIRECTORY_CONFIG,
        is_git_ownership_error_message, GIT_CONFIG_GLOBAL_ENV,
    };
    use crate::utils::resolve_git_binary;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::{Mutex, OnceLock};

    fn env_test_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn acquire_env_test_lock() -> std::sync::MutexGuard<'static, ()> {
        env_test_lock().lock().unwrap_or_else(|poison| poison.into_inner())
    }

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

        fn set_raw(key: &'static str, value: &str) -> Self {
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
        let _lock = acquire_env_test_lock();
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
    fn ensure_app_managed_git_config_includes_existing_system_git_configs() {
        let _lock = acquire_env_test_lock();
        let temp_dir = std::env::temp_dir()
            .join(format!("codex-monitor-git-runtime-include-{}", uuid::Uuid::new_v4()));
        let home_dir = temp_dir.join("home");
        let xdg_dir = temp_dir.join("xdg");
        fs::create_dir_all(home_dir.join(".config/git")).expect("create home git dir");
        fs::create_dir_all(xdg_dir.join("git")).expect("create xdg git dir");
        fs::write(home_dir.join(".gitconfig"), "[user]\n\tname = Included User\n")
            .expect("write home gitconfig");
        fs::write(xdg_dir.join("git/config"), "[user]\n\temail = included@example.com\n")
            .expect("write xdg gitconfig");

        let _home_guard = EnvGuard::set_raw("HOME", home_dir.to_string_lossy().as_ref());
        let _userprofile_guard =
            EnvGuard::set_raw("USERPROFILE", home_dir.to_string_lossy().as_ref());
        let _xdg_guard = EnvGuard::set_raw("XDG_CONFIG_HOME", xdg_dir.to_string_lossy().as_ref());

        let context = ensure_app_managed_git_config(&temp_dir).expect("write git runtime config");
        let global =
            std::fs::read_to_string(&context.global_config_path).expect("read global config");
        let xdg = std::fs::read_to_string(&context.xdg_config_path).expect("read xdg config");

        assert!(global.contains(&format!("path = {}/git/config", xdg_dir.to_string_lossy())));
        assert!(global.contains(&format!("path = {}/.gitconfig", home_dir.to_string_lossy())));
        assert_eq!(xdg, APP_MANAGED_SAFE_DIRECTORY_CONFIG);
    }

    #[test]
    fn configure_std_git_command_injects_app_managed_global_config() {
        let _lock = acquire_env_test_lock();
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
        let expected_xdg = config_path
            .parent()
            .expect("global config parent")
            .join(".config");
        assert!(
            envs.iter().any(|(key, value)| {
                key == "XDG_CONFIG_HOME" && value == &expected_xdg.as_os_str()
            }),
            "expected XDG_CONFIG_HOME to be injected"
        );
    }

    #[test]
    fn configure_std_git_command_keeps_user_identity_visible_when_runtime_global_exists() {
        let _lock = acquire_env_test_lock();
        let temp_dir =
            std::env::temp_dir().join(format!("codex-monitor-git-home-{}", uuid::Uuid::new_v4()));
        let home_dir = temp_dir.join("home");
        fs::create_dir_all(&home_dir).expect("create home dir");
        fs::write(
            home_dir.join(".gitconfig"),
            "[user]\n\tname = Remote User\n\temail = remote@example.com\n",
        )
        .expect("write home gitconfig");
        let xdg_dir = temp_dir.join("xdg");
        fs::create_dir_all(xdg_dir.join("git")).expect("create xdg dir");
        let _home_guard = EnvGuard::set_raw("HOME", home_dir.to_string_lossy().as_ref());
        let _userprofile_guard =
            EnvGuard::set_raw("USERPROFILE", home_dir.to_string_lossy().as_ref());
        let _xdg_guard = EnvGuard::set_raw("XDG_CONFIG_HOME", xdg_dir.to_string_lossy().as_ref());

        let context = ensure_app_managed_git_config(&temp_dir).expect("write managed gitconfig");
        let _guard = EnvGuard::set(GIT_CONFIG_GLOBAL_ENV, &context.global_config_path);

        let git_bin = resolve_git_binary().expect("resolve git");
        let repo_dir = temp_dir.join("repo");
        fs::create_dir_all(&repo_dir).expect("create repo dir");
        Command::new(&git_bin)
            .args(["init", "-q"])
            .current_dir(&repo_dir)
            .output()
            .expect("init repo");
        let mut command = Command::new(git_bin);
        command.args(["config", "--get", "user.name"]);
        command.current_dir(&repo_dir);
        command.env("HOME", &home_dir);
        command.env("USERPROFILE", &home_dir);
        configure_std_git_command(&mut command);

        let output = command.output().expect("run git config");
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        assert!(
            output.status.success(),
            "expected git config to succeed, stderr: {stderr}"
        );
        assert_eq!(stdout.trim(), "Remote User");
    }

    #[test]
    fn configure_std_git_command_keeps_xdg_identity_visible_when_runtime_global_exists() {
        let _lock = acquire_env_test_lock();
        let temp_dir =
            std::env::temp_dir().join(format!("codex-monitor-git-xdg-{}", uuid::Uuid::new_v4()));
        let home_dir = temp_dir.join("home");
        let xdg_dir = temp_dir.join("xdg");
        fs::create_dir_all(home_dir.join(".config/git")).expect("create home git dir");
        fs::create_dir_all(xdg_dir.join("git")).expect("create xdg dir");
        fs::write(home_dir.join(".gitconfig"), "[user]\n\tname = Remote User\n")
            .expect("write home gitconfig");
        fs::write(xdg_dir.join("git/config"), "[user]\n\temail = remote@example.com\n")
            .expect("write xdg gitconfig");
        let _home_guard = EnvGuard::set_raw("HOME", home_dir.to_string_lossy().as_ref());
        let _userprofile_guard =
            EnvGuard::set_raw("USERPROFILE", home_dir.to_string_lossy().as_ref());
        let _xdg_guard = EnvGuard::set_raw("XDG_CONFIG_HOME", xdg_dir.to_string_lossy().as_ref());

        let context = ensure_app_managed_git_config(&temp_dir).expect("write managed gitconfig");
        let _guard = EnvGuard::set(GIT_CONFIG_GLOBAL_ENV, &context.global_config_path);

        let git_bin = resolve_git_binary().expect("resolve git");
        let repo_dir = temp_dir.join("repo");
        fs::create_dir_all(&repo_dir).expect("create repo dir");
        Command::new(&git_bin)
            .args(["init", "-q"])
            .current_dir(&repo_dir)
            .output()
            .expect("init repo");
        let mut command = Command::new(git_bin);
        command.args(["config", "--get", "user.email"]);
        command.current_dir(&repo_dir);
        command.env("HOME", &home_dir);
        command.env("USERPROFILE", &home_dir);
        configure_std_git_command(&mut command);

        let output = command.output().expect("run git config");
        let stdout = String::from_utf8_lossy(&output.stdout);

        assert!(output.status.success(), "expected git config to succeed");
        assert_eq!(stdout.trim(), "remote@example.com");
    }

    #[test]
    fn configure_std_git_command_keeps_global_precedence_over_xdg_for_same_key() {
        let _lock = acquire_env_test_lock();
        let temp_dir = std::env::temp_dir().join(format!(
            "codex-monitor-git-precedence-{}",
            uuid::Uuid::new_v4()
        ));
        let home_dir = temp_dir.join("home");
        let xdg_dir = temp_dir.join("xdg");
        fs::create_dir_all(home_dir.join(".config/git")).expect("create home git dir");
        fs::create_dir_all(xdg_dir.join("git")).expect("create xdg dir");
        fs::write(home_dir.join(".gitconfig"), "[user]\n\tname = Home User\n")
            .expect("write home gitconfig");
        fs::write(xdg_dir.join("git/config"), "[user]\n\tname = Xdg User\n")
            .expect("write xdg gitconfig");
        let _home_guard = EnvGuard::set_raw("HOME", home_dir.to_string_lossy().as_ref());
        let _userprofile_guard =
            EnvGuard::set_raw("USERPROFILE", home_dir.to_string_lossy().as_ref());
        let _xdg_guard = EnvGuard::set_raw("XDG_CONFIG_HOME", xdg_dir.to_string_lossy().as_ref());

        let context = ensure_app_managed_git_config(&temp_dir).expect("write managed gitconfig");
        let _guard = EnvGuard::set(GIT_CONFIG_GLOBAL_ENV, &context.global_config_path);

        let git_bin = resolve_git_binary().expect("resolve git");
        let repo_dir = temp_dir.join("repo");
        fs::create_dir_all(&repo_dir).expect("create repo dir");
        Command::new(&git_bin)
            .args(["init", "-q"])
            .current_dir(&repo_dir)
            .output()
            .expect("init repo");
        let mut command = Command::new(git_bin);
        command.args(["config", "--get", "user.name"]);
        command.current_dir(&repo_dir);
        command.env("HOME", &home_dir);
        command.env("USERPROFILE", &home_dir);
        configure_std_git_command(&mut command);

        let output = command.output().expect("run git config");
        let stdout = String::from_utf8_lossy(&output.stdout);

        assert!(output.status.success(), "expected git config to succeed");
        assert_eq!(stdout.trim(), "Home User");
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
