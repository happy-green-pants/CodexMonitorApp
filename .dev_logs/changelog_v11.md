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
---
### [2026-03-19 18:56] | Agent: Codex (GPT-5)
- **File**: `src-tauri/target`, `android/.gradle`, `android/build`, `dist`
- **Change**: 清理本地编译缓存与构建产物：删除 Rust `target`、Android Gradle/build 缓存及前端 `dist`，将仓库占用从约 `9.3G` 降至约 `533M`。
- **Why**: 用户要求在继续实现前先释放存储空间；本次删除内容均为可再生成的构建缓存，不影响源码。
- **Goal**: 为后续测试与实现恢复可用磁盘空间，避免缓存挤占工作区容量。
---
### [2026-03-19 18:56] | Agent: Codex (GPT-5)
- **File**: `src/features/notifications/hooks/useAgentSystemNotifications.ts`, `src/features/notifications/hooks/useAgentSoundNotifications.ts`, `src/features/notifications/hooks/useAgentResponseRequiredNotifications.ts`, `src/features/app/hooks/useSystemNotificationThreadLinks.ts`, `src/services/events.ts`, `src/features/app/components/MainApp.tsx`, `src/features/app/orchestration/useThreadOrchestration.ts`
- **Change**: 开始落地通知细分与模型记忆修复：移除 `agentMessageCompleted` 的系统通知/成功音直发语义，仅保留消息预览缓存；为 approval 通知补齐 `threadId`/`turnId`；新增系统通知点击订阅与通知 metadata 跳转入口；Workspace Home 的模型/effort 选择改走统一持久化 handler；显式选择模型/effort 时始终更新全局 `lastComposer*` 设置。
- **Why**: 解决“小回复也通知”、点击通知无法稳定跳转会话，以及新建对话回退到旧模型默认值的问题。
- **Goal**: 让通知只在“需回应”或“回合结束/最终失败”触发，点击通知能打开对应会话，并让新对话继承最近一次显式模型选择。
---
### [2026-03-19 18:56] | Agent: Codex (GPT-5)
- **File**: `src/features/notifications/hooks/useAgentSystemNotifications.test.tsx`, `src/features/notifications/hooks/useAgentResponseRequiredNotifications.test.tsx`, `src/features/app/hooks/useSystemNotificationThreadLinks.test.tsx`, `src/features/app/orchestration/useThreadOrchestration.test.ts`, `src/services/events.test.ts`
- **Change**: 先补回归测试覆盖：小回复不应提前触发完成通知、approval 通知需携带线程 metadata、通知点击需按 metadata 跳转线程、显式模型/effort 选择需更新全局最近值、系统通知 action 订阅需向前端分发 payload。
- **Why**: 按 TDD 先用失败测试锁定新行为，避免实现时回归既有通知与模型选择逻辑。
- **Goal**: 为后续实现提供可执行的行为契约与回归保护。
---
### [2026-03-19 19:13] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `src/services/events.test.ts`, `src/features/models/hooks/useModels.test.tsx`
- **Change**: 将 manifest 当前任务切换为“通知细分、通知跳转与模型默认记忆修复”；修正系统通知 action 测试以匹配 Tauri `onAction` 实际返回的完整 `Options` payload；修正 `useModels` 测试等待条件，避免在 config model 尚未注入的异步中间态过早断言。
- **Why**: 当前开发焦点已从上一轮 Git ownership 修复切换；同时全量测试暴露出 2 个验证层问题，其中一个是本轮新增测试断言过严，另一个是既有测试对异步最终态等待不足。
- **Goal**: 让开发记忆与当前任务一致，并恢复前端测试基线，确保本轮通知与模型记忆改动能够通过完整回归验证。
---
### [2026-03-19 19:13] | Agent: Codex (GPT-5)
- **File**: `src/features/notifications/hooks/useAgentSystemNotifications.ts`, `src/features/notifications/hooks/useAgentSoundNotifications.ts`, `src/features/notifications/hooks/useAgentResponseRequiredNotifications.ts`, `src/features/app/hooks/useSystemNotificationThreadLinks.ts`, `src/services/events.ts`, `src/features/app/components/MainApp.tsx`, `src/features/app/orchestration/useThreadOrchestration.ts`
- **Change**: 完成通知行为收口与跳转接线：assistant 小回复不再直接触发系统通知/成功音，仅缓存最终预览文本并等待 `turn/completed` 或最终失败；approval 通知附带 `threadId` / `turnId` metadata；新增通知点击 action 订阅并解析 `payload.extra` / 顶层 payload 中的线程信息后跳转；显式切换模型或 reasoning effort 时始终更新全局 `lastComposer*` 设置，并让 Workspace Home 统一走持久化 handler。
- **Why**: 需要同时解决“AI 小回复也通知”“点击通知偶发不跳转”和“新建对话总回退到 `gpt-5.2-codex`”三个关联问题，且不能破坏现有 turn 完成与线程参数持久化链路。
- **Goal**: 将通知严格限制在“需回应 + 回合结束/最终失败”，保证通知点击能打开正确会话，并让新对话默认继承最近一次显式模型选择。
---
### [2026-03-19 19:13] | Agent: Codex (GPT-5)
- **File**: `src/features/notifications/hooks/useAgentSystemNotifications.test.tsx`, `src/features/notifications/hooks/useAgentResponseRequiredNotifications.test.tsx`, `src/features/app/hooks/useSystemNotificationThreadLinks.test.tsx`, `src/features/app/orchestration/useThreadOrchestration.test.ts`, `src/services/events.test.ts`, `src/features/models/hooks/useModels.test.tsx`
- **Change**: 运行验证并补齐通过证据：定向单测 `npm run test -- src/services/events.test.ts`、`npm run test -- src/features/models/hooks/useModels.test.tsx` 通过；`npm run typecheck` 通过；`npm run test` 全量通过（`142` files, `989` tests）。另记录全量测试中仍有既有 `act(...)` 与预期错误日志输出的 stderr 警告，但不影响退出码。
- **Why**: 需要用 fresh verification evidence 证明本轮通知/跳转/模型记忆修改没有引入回归，并明确区分“测试通过”与“测试 stderr 噪声”。
- **Goal**: 为最终交付提供完整、可复现的验证结论。
---
### [2026-03-19 20:37] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `src/features/files/components/FileTreePanel.tsx`, `src/features/files/components/FilePreviewPopover.tsx`, `src/styles/file-tree.css`
- **Change**: 将 manifest 当前任务切换为“Git/Files 文件预览移动端浮层适配”；为文件预览新增 `anchored` / `constrained` 双展示模式，窄屏通过 `matchMedia("(max-width: 720px)")` 切到受限浮层+遮罩，重算视口内宽高与位置，隐藏箭头并优化工具栏、图片区、代码区在小屏下的内部滚动与换行。
- **Why**: 原有预览固定按桌面锚点气泡渲染，`width: 640` 且无遮罩，小屏点击后会超出视口，造成内容看不全且关闭按钮/外部区域不可达。
- **Goal**: 让移动端文件预览始终完整落在视口内，可通过遮罩或关闭按钮退出，同时不破坏桌面端现有浏览工作流。
---
### [2026-03-19 20:37] | Agent: Codex (GPT-5)
- **File**: `src/features/files/components/FilePreviewPopover.test.tsx`, `src/features/files/components/FileTreePanel.test.tsx`
- **Change**: 先补失败测试再实现：新增 `FilePreviewPopover` 受限浮层遮罩测试；新增 `FileTreePanel` 窄屏文本/图片预览测试，覆盖受限浮层渲染、遮罩关闭、图片预览仍走同一小屏容器等回归场景。
- **Why**: 该问题直接影响移动端可用性，需要用测试锁定“可关闭 + 可浏览 + 图片文本一致”的交互契约，避免后续样式回退。
- **Goal**: 为移动端文件预览适配建立自动化保护网，并按 TDD 证明修复针对的正是本次窄屏问题。
