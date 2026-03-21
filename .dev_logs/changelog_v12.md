State Summary (from `changelog_v11.md`):
- 已有共享 `git_runtime` 修复 Git ownership / `safe.directory` 问题，app 与 daemon 均在启动早期接入该运行时。
- Git CLI / `gh` / libgit2 访问已统一走受控 Git 运行时，避免打包后跨 owner 仓库在 Git 面板直接失败。
- 通知细分、通知跳转与模型默认记忆修复，以及 Git/Files 移动端预览浮层适配，均已在上一分片完成并验证。

---
### [2026-03-21 22:33] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/changelog_v12.md`, `/.dev_logs/manifest.md`, `src-tauri/src/shared/git_runtime.rs`
- **Change**: 因 `changelog_v11.md` 已接近 100 行上限，创建新分片 `changelog_v12.md`；将 manifest 当前任务切换为“远程 Git 继承系统全局身份修复”；重写 `git_runtime` 的 app-managed Git 配置生成逻辑：全局 `.gitconfig` 通过 `include.path` 继承系统 `~/.gitconfig` 与系统 XDG Git config，app-managed XDG config 仅保留 `safe.directory = *`，避免重复加载系统 XDG 配置；Git 子进程注入 `GIT_CONFIG_GLOBAL` 时同步设置 `XDG_CONFIG_HOME` 指向 app-managed `.config`。
- **Why**: 之前的 app-managed 全局配置只有 `safe.directory = *`，会在远程 daemon / APP 执行 `git commit` 等命令时屏蔽服务端系统用户原本的 `user.name` / `user.email`，导致移动端远程 Git 操作提示缺少身份信息。
- **Goal**: 在不回退既有 ownership/safe.directory 修复的前提下，让远程 Git 继续继承服务端已经配置好的全局用户名、邮箱和 XDG Git 配置。
---
### [2026-03-21 22:33] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/shared/git_runtime.rs`, `src-tauri/Cargo.toml`（验证）
- **Change**: 先补 Rust 回归测试并按 TDD 经历失败到通过：新增 app-managed 配置包含系统 Git config include、Git 子进程注入 `XDG_CONFIG_HOME`、在临时 repo 中仍可读取系统 `user.name` / `user.email` 的测试；随后运行 `cargo test --manifest-path src-tauri/Cargo.toml shared::git_runtime::tests:: -- --nocapture` 与 `cargo check --manifest-path src-tauri/Cargo.toml`，均通过（存在仓库既有 warning，无新增 error）。
- **Why**: 该问题属于 Git 配置解析顺序与运行时环境注入的组合回归，必须用自动化测试锁定“继承身份 + 保留 safe.directory”的契约，并提供 fresh verification evidence。
- **Goal**: 证明远程 Git 身份修复已在 Rust 单测和编译层面闭环，避免未来再次退化成“缺少 user.name / user.email”。
---
### [2026-03-21 23:06] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/shared/git_runtime.rs`
- **Change**: 根据代码审查再次收敛 Git runtime：去掉 app-managed XDG 对系统 XDG 配置的重复 include，只保留 app-managed global 对系统 XDG + `~/.gitconfig` 的一次性继承，并新增“global 同键优先于 XDG”“XDG 独有邮箱仍可读到”的回归测试。
- **Why**: 若系统 XDG 配置在 global include 与 app-managed XDG 中被重复加载，会改变 Git 原生优先级，让 `user.name`/`credential.helper` 等同键被 XDG 值错误覆盖。
- **Goal**: 既恢复远程 Git 身份继承，又严格保持服务端现有 Git 配置的原生优先级与行为。
