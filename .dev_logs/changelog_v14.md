---
State Summary (from `changelog_v13.md`):
- 远程模式下的 pending server request 恢复链路、远程流静默降级与文档约束已稳定。
- 当前工作树保留 `AGENTS.md` 与 dev logs 的未提交项目约束更新，不应回退。
- Web 端当前已有 workspace 文件列表与只读预览能力，但尚无任意 workspace 文件写回和中心编辑区闭环。

# Changelog v14

---
### [2026-04-15 11:23] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v14.md`
- **Change**: 将活跃日志分片切换到 `changelog_v14.md`，并把当前任务更新为“Web 端远程 workspace 文件浏览与编辑”。
- **Why**: `changelog_v13.md` 已接近分片上限，且前序记录覆盖 Android 远程恢复、发版与文档约束等多个主题，继续追加会降低检索效率。
- **Goal**: 为 Web 端文件编辑能力的前后端实现、测试与验证提供独立、连续的开发记忆。
---
### [2026-04-15 11:23] | Agent: Codex (GPT-5)
- **File**: `/src/services/tauri.test.ts`, `/src/features/files/components/FileTreePanel.test.tsx`, `/src/features/app/hooks/useGitPanelController.test.tsx`, `/src-tauri/src/workspaces/tests.rs`
- **Change**: 按 TDD 先补充失败测试，锁定 `read_workspace_file` 返回 `revision`、新增 `write_workspace_file` IPC 契约、文件树点击文本文件进入中心编辑态，以及 Rust 侧 revision 冲突校验和隐藏配置文件可见性预期。
- **Why**: 本轮功能跨越前端状态、RPC 契约和 Rust 文件安全逻辑，必须先用红灯测试固定行为，避免边实现边改变需求边界。
- **Goal**: 为后续最小实现提供明确的行为锚点，保证“可编辑文本文件 + 显式保存 + 冲突阻止覆盖”的核心链路可验证。
---
### [2026-04-15 11:54] | Agent: Codex (GPT-5)
- **File**: `/src/services/tauri.ts`, `/src/features/files/components/FileTreePanel.tsx`, `/src/features/app/hooks/useGitPanelController.ts`, `/src-tauri/src/shared/workspace_rpc.rs`, `/src-tauri/src/shared/workspaces_core.rs`, `/src-tauri/src/shared/workspaces_core/io.rs`, `/src-tauri/src/workspaces/files.rs`, `/src-tauri/src/workspaces/commands.rs`, `/src-tauri/src/lib.rs`, `/src-tauri/src/remote_backend/mod.rs`, `/src-tauri/src/bin/codex_monitor_daemon.rs`, `/src-tauri/src/bin/codex_monitor_daemon/rpc/workspace.rs`
- **Change**: 已补前端 `writeWorkspaceFile()` IPC 封装、文件树文本文件点击优先走中心编辑打开分支，并在 Git 面板状态中加入 `file` 编辑态入口；Rust 侧新增 `WriteWorkspaceFileRequest`、workspace 文件 `revision`/写入响应、shared core 写文件入口，以及 app/daemon/RPC 的 `write_workspace_file` 命令打通；文件列表开始保留 `.env`、`.github`、`.vscode` 等常见隐藏配置，同时继续排除重目录。
- **Why**: 这是让 Web 端远程 workspace 文件编辑形成闭环的最小骨架，必须先建立安全的文本写回协议与前端打开入口，后续才能叠加中心编辑器 UI。
- **Goal**: 先让“读文件带 revision + 安全写文件 + 文件树可进入编辑态”的端到端主干在代码结构上存在，并为下一步中心编辑区接线铺路。
---
### [2026-04-15 12:32] | Agent: Codex (GPT-5)
- **File**: `/src/features/files/components/WorkspaceFileEditor.tsx`, `/src/features/files/components/WorkspaceFileEditor.test.tsx`, `/src/styles/workspace-file-editor.css`, `/src/App.tsx`, `/src/features/layout/hooks/layoutNodes/types.ts`, `/src/features/layout/hooks/layoutNodes/buildGitNodes.tsx`, `/src/features/layout/hooks/layoutNodes/buildSecondaryNodes.tsx`, `/src/features/layout/components/DesktopLayout.tsx`, `/src/features/layout/components/PhoneLayout.tsx`, `/src/features/layout/components/TabletLayout.tsx`, `/src/features/app/components/AppLayout.tsx`, `/src/features/app/components/MainApp.tsx`, `/src/features/app/hooks/useMainAppLayoutSurfaces.ts`, `/src/features/app/hooks/useMainAppGitState.ts`, `/src/features/app/orchestration/useLayoutOrchestration.ts`, `/src/features/app/hooks/useMainAppComposerWorkspaceState.ts`, `/src/features/app/hooks/useMainAppDisplayNodes.tsx`, `/src/features/app/components/MainHeaderActions.tsx`, `/src/features/app/hooks/useSyncSelectedDiffPath.ts`, `/src/features/workspaces/hooks/useWorkspaceSelection.ts`, `/package.json`, `/package-lock.json`
- **Change**: 新增中心区 `WorkspaceFileEditor` 组件并接入 `CodeMirror`，支持按路径加载文本文件、显示语言/dirty 状态、显式保存与 revision 冲突提示；把 layout nodes / Desktop / Tablet / Phone 的中心详情层从仅 diff 泛化到 `chat | diff | file`，让文件树可把文本文件打开到中心编辑区；同时补齐前端测试和样式，并安装 `@codemirror/*` 依赖。
- **Why**: 仅有文件写回协议和状态机不足以让 Web 端真正可编辑，必须把编辑器、布局切换和保存反馈接到统一的中心详情面板中，才能形成可操作的产品闭环。
- **Goal**: 让远程 HTTP 模式下的 Web 用户能够浏览 workspace 文件树、在中心区域打开单个文本文件、编辑并显式保存，且在发生并发修改时阻止覆盖。
---
### [2026-04-15 12:32] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/workspaces/files.rs`, `/src-tauri/src/shared/workspaces_core/connect.rs`, `/src-tauri/src/shared/workspaces_core/runtime_codex_args.rs`
- **Change**: 为 `WorkspaceFileWriteResponse` 增加 `Debug` 派生，并修复 `WorkspaceSession` 测试构造函数遗漏 `pending_server_requests` 字段的问题，使新增文件写回能力与现有后端测试辅助结构保持一致。
- **Why**: Rust 侧定向测试编译时暴露了共享 session 结构的字段漂移和 `expect_err` 对 `Debug` 的硬性要求，不修复会持续阻塞与 workspace 文件编辑相关的测试编译。
- **Goal**: 保证 workspace 文件 revision/写回能力在 Rust 侧至少能通过 `cargo check`，并降低后续补跑定向测试时的额外编译阻力。
---
### [2026-04-15 15:04] | Agent: Codex (GPT-5)
- **File**: `/src/features/files/components/WorkspaceFileEditor.tsx`, `/src/features/files/components/WorkspaceFileEditor.test.tsx`, `/src/styles/workspace-file-editor.css`, `/src/styles/compact-phone.css`, `/src/styles/compact-tablet.css`
- **Change**: 为中心文件编辑器补充宽度约束与内部滚动策略：外层容器、工具栏和移动端详情容器统一加上 `min-width: 0 / width: 100% / max-width: 100%`，并在 `CodeMirror` 主题中明确根节点固定宽度、长行仅在 `.cm-scroller` 内部横向滚动、使用稳定滚动槽防止滚动时可见宽度抖动；同时新增定向测试锁定这些约束。
- **Why**: 用户在编辑页上下滚动时出现“有时很窄有时很宽、宽时超出视口”的问题，根因是编辑器作为 flex 子项时没有把内容宽度与可视区域隔离，长行和滚动条一起参与了外层布局计算。
- **Goal**: 让编辑页在桌面与移动端都保持稳定宽度，超长行只在编辑器内部滚动，不再把详情区或整个视口撑宽。
---
### [2026-04-16 00:00] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/changelog_v14.md`
- **Change**: 记录本次磁盘清理任务的执行边界，限定仅删除本地可重建的编译产物目录：`src-tauri/target`、`android/app/build`、`android/capacitor-cordova-android-plugins/build` 与 `node_modules/.vite`。
- **Why**: 当前仓库占用约 `8.0G`，其中 `src-tauri/target` 单独约 `7.5G`；用户要求释放存储空间，同时工作树存在大量未提交源码改动，必须将清理范围限制在忽略的构建产物，避免误删开发中的文件。
- **Goal**: 在不影响当前源码工作树的前提下，最大化回收本地编译占用，并为后续核对清理结果提供日志依据。
---
### [2026-04-16 00:48] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v14.md`
- **Change**: 将当前任务切换为“本地打包 Linux x86_64 服务后端”，并记录本次执行以 `codex_monitor_daemon` 为唯一打包目标，沿用当前工作树内容而不回退未提交改动。
- **Why**: 用户明确要求实施上一轮打包计划，执行前需要让开发记忆与当前任务保持一致，并固化“基于现有工作树打包 daemon”的边界，避免与前序 Web 文件编辑任务混淆。
- **Goal**: 为本次 daemon release 构建、验证与最终交付提供清晰的日志上下文。
---
### [2026-04-16 00:48] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/Cargo.toml`, `/src-tauri/src/bin/codex_monitor_daemon.rs`
- **Change**: 完成本地打包前校验：确认 `git diff --check` 通过，并运行 `cd src-tauri && cargo check --bin codex_monitor_daemon` 成功，验证当前工作树可编译到 daemon 目标，期间仅出现未使用变量、未使用导入和未构造结构体等 warning。
- **Why**: 直接执行 release 构建成本较高，先用轻量校验确认当前未提交改动没有阻断 daemon 编译，可减少重构建失败后的排查范围。
- **Goal**: 为后续执行 `cargo build --release --bin codex_monitor_daemon --manifest-path src-tauri/Cargo.toml` 提供可验证的前置通过条件。
---
### [2026-04-16 01:02] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/Cargo.toml`, `/src-tauri/target/release/codex_monitor_daemon`
- **Change**: 执行 `cargo build --release --bin codex_monitor_daemon --manifest-path src-tauri/Cargo.toml` 完成本地 release 打包，生成 Linux x86_64 daemon 二进制 `src-tauri/target/release/codex_monitor_daemon`；随后运行 `src-tauri/target/release/codex_monitor_daemon --help` 验证产物可执行并输出预期参数说明。
- **Why**: 用户要求实施上一轮服务后端打包计划，本次需要交付实际可运行的本地 daemon 二进制，而不仅是构建方案。
- **Goal**: 产出可用于本机部署或后续分发的 `codex_monitor_daemon` release 二进制，并以最小验证确认其启动参数表面行为正常。
---
### [2026-04-19 00:56] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/Cargo.toml`, `/src-tauri/target/release/codex_monitor_daemon`, `/.dev_logs/changelog_v14.md`
- **Change**: 再次按当前工作树执行 `cargo build --release --bin codex_monitor_daemon --manifest-path src-tauri/Cargo.toml`，成功生成新的 Linux x86_64 release 二进制；随后用 `src-tauri/target/release/codex_monitor_daemon --help` 完成最小可执行验证，并确认产物为约 `17M` 的 ELF 64-bit 可执行文件。
- **Why**: 用户本轮再次要求“打包一个后端服务”，需要基于当前仓库状态重新产出后端 daemon，而不能仅引用旧日志中的历史构建结果。
- **Goal**: 交付一份与当前工作树一致、已完成基础运行验证的本地 daemon 可执行文件，便于后续部署或手动分发。
---
### [2026-04-20 00:20] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/target`, `/node_modules/.vite`, `/scripts/start_daemon.sh`, `/scripts/start_daemon.ps1`, `/scripts/start_codex_monitor_daemon.sh`, `/.dev_logs/changelog_v14.md`
- **Change**: 清理本地可重建编译缓存时保留后端服务交付物：先暂存 `src-tauri/target/release/codex_monitor_daemon`，删除 `src-tauri/target` 中除该二进制外的中间产物与 `node_modules/.vite` 前端缓存，再恢复 daemon 二进制；同时确认 `scripts/start_daemon.sh`、`scripts/start_daemon.ps1` 和 `scripts/start_codex_monitor_daemon.sh` 未被触碰。
- **Why**: 用户要求释放编译缓存占用，但明确要求保留后端服务脚本；直接清空 `target` 会误删当前可用的 daemon 可执行文件，因此需要做选择性清理。
- **Goal**: 在不影响后端服务启动脚本和已打包 daemon 的前提下回收磁盘空间，并保持仓库可继续用于服务分发或手动启动。
---
### [2026-04-28 00:15] | Agent: Codex (GPT-5)
- **File**: `/src/features/settings/hooks/useAppSettings.test.ts`, `/src/features/settings/hooks/useSettingsDefaultModels.test.tsx`, `/src/features/models/hooks/useModels.test.tsx`, `/src/features/settings/components/SettingsView.test.tsx`
- **Change**: 先按 TDD 调整并补充模型相关前端测试，锁定默认 `customModelIds` 需包含 `gpt-5.5`、设置页“自定义模型”文案应脱离 fallback-only 语义，以及自定义模型在服务端返回其他模型时仍需保留在候选列表中。
- **Why**: 当前问题表现为最新模型缺失和“不能自定义添加”的感知偏差，先用失败测试固定期望，避免实现阶段继续沿用旧语义。
- **Goal**: 为后续最小代码修改提供明确验收锚点，确保默认模型补位和自定义模型可见性按新规则生效。
---
### [2026-04-28 00:18] | Agent: Codex (GPT-5)
- **File**: `/src/features/settings/hooks/useAppSettings.ts`, `/src-tauri/src/types.rs`, `/src/features/models/utils/modelListResponse.ts`, `/src/features/settings/components/sections/SettingsCodexSection.tsx`, `/.dev_logs/manifest.md`
- **Change**: 将前后端默认 `customModelIds` 同步更新为 `gpt-5.5`、`gpt-5.4`、`gpt-5.3-codex`，并补充注释说明其用途；同时把自定义模型描述从 `Custom model fallbacks` 调整为 `Custom models`，更新帮助文案、推荐 starter IDs 和重复提示文案，使设置页明确表达“手动添加后始终可选，服务端同名元数据优先覆盖”。
- **Why**: 根因一部分是默认补位名单过旧，另一部分是 UI 文案把现有能力表述成仅在缺失时补位，导致用户难以理解自定义模型入口和生效范围。
- **Goal**: 修复最新模型缺失的默认体验，并让自定义模型能力在设置与模型选择链路中的行为和提示保持一致。
---
