State Summary (from `changelog_v10.md`):
- 已完成前端自定义模型补全：`customModelIds` 持久化、Settings 中的 fallback 维护 UI、模型列表“服务端优先 / config 次之 / 自定义最后”的统一合并逻辑已落地并补齐测试。
- `.worktrees/` 已加入 `.gitignore`，仓库支持本地 worktree 开发而不污染版本控制。

# Changelog v11

---
### [2026-03-19 17:52] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/changelog_v11.md`, `/.dev_logs/manifest.md`
- **Change**: 因 `changelog_v10.md` 已超过 100 行，创建新分片 `changelog_v11.md` 并将 manifest 的 Active Changelog / Current Task 切换到“打包 APP 后 Git tab repository ownership 报错修复”。
- **Why**: 按仓库日志分片规则控制开发记忆规模，并让后续 Agent 读取到当前真实焦点。
- **Goal**: 为本次 Git ownership/safe.directory 修复提供独立、可追踪的开发记录。
---
### [2026-03-19 17:52] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/shared/git_runtime.rs`, `src-tauri/src/lib.rs`, `src-tauri/src/bin/codex_monitor_daemon.rs`, `src-tauri/src/shared/mod.rs`
- **Change**: 新增共享 `git_runtime` 模块：在 app data dir 生成 APP 自管 `.gitconfig` / XDG Git config，写入 `safe.directory = *`；通过 `OnceLock` 初始化 libgit2 全局搜索路径，并在桌面 APP 与 daemon 启动早期接入初始化。
- **Why**: 打包后 APP/daemon 运行用户与仓库 owner 不一致时，libgit2 会在 `Repository::open(...)` 直接因 ownership 安全检查失败；必须在任何 Git 访问前统一注入可控的 trust runtime。
- **Goal**: 让打包后的桌面端在不污染用户系统级 Git 配置的前提下，能够读取共享/跨用户 owner 的仓库。
---
### [2026-03-19 17:52] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/shared/git_core.rs`, `src-tauri/src/shared/git_ui_core/commands.rs`, `src-tauri/src/shared/git_ui_core/diff.rs`, `src-tauri/src/shared/git_ui_core/log.rs`, `src-tauri/src/shared/git_ui_core/github.rs`, `src-tauri/src/shared/workspaces_core/git_orchestration.rs`
- **Change**: Git CLI 与 GitHub CLI 执行链路统一注入 `GIT_CONFIG_GLOBAL` / `PATH`；Git 页的 libgit2 打开仓库链路统一改为 `open_repository(...)`，并把 ownership 类错误提升为可识别的运行时错误消息。
- **Why**: 仅修 libgit2 会导致 Git tab 能打开但 `stage/commit/pull/push/gh` 仍可能继续失败；必须让读写两条链路都共享同一份 app-managed Git trust 配置。
- **Goal**: 一次性覆盖 Git 页加载、Git 操作、worktree apply、GitHub 面板等 ownership 相关失败路径。
---
### [2026-03-19 17:52] | Agent: Codex (GPT-5)
- **File**: `src/features/git/utils/repoErrors.ts`, `src/features/git/components/GitDiffPanel.tsx`, `src/features/git/components/GitDiffPanel.utils.ts`
- **Change**: 前端新增 ownership/safe.directory 错误识别与文案格式化；Git sidebar 在显示后端报错时将 ownership 原始错误替换为可理解的中文说明，保留“不是 Git 仓库 / git root 不存在”的既有分支逻辑不变。
- **Why**: 原始 `Owner (-36)` / `safe.directory` 文案是 libgit2 内部错误，对用户没有可操作性；需要把它收敛成明确的“APP 运行用户与仓库 owner 不一致”提示。
- **Goal**: 让 Git tab 在 ownership 场景下给出稳定、可理解的错误反馈，而不是裸透传底层异常。
---
### [2026-03-19 17:52] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/shared/git_runtime.rs`, `src/features/git/utils/repoErrors.test.ts`, `src/features/git/components/GitDiffPanel.test.tsx`
- **Change**: 新增回归测试：Rust 侧覆盖 app-managed Git config 写入、命令环境注入、ownership 错误格式化；前端覆盖 ownership 错误识别与 Git 面板友好文案渲染。
- **Why**: 该问题跨越 libgit2、子进程环境注入和前端错误展示，必须通过自动化测试锁定关键契约，避免未来改动后再次退化到 `Owner (-36)` 裸错。
- **Goal**: 为 Git ownership 修复建立可回归的自动化保护网。
---
### [2026-03-19 17:56] | Agent: Codex (GPT-5)
- **File**: `package.json`, `src-tauri/Cargo.toml`（验证）
- **Change**: 运行验证：`npm run test -- src/features/git/utils/repoErrors.test.ts src/features/git/components/GitDiffPanel.test.tsx` 通过；`cargo test --manifest-path src-tauri/Cargo.toml git_runtime -- --nocapture` 通过；`npm run typecheck` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过（存在既有 warning，无新增 error）。
- **Why**: 按仓库验证矩阵为本次跨前后端修复提供 fresh verification evidence，避免仅凭代码改动声明完成。
- **Goal**: 证明本次 Git ownership 修复在类型、前端测试、Rust 单测与编译层面均未引入回归。
