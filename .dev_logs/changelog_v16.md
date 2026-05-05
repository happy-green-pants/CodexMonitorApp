State Summary (from `changelog_v15.md`):
- Web 端 Sentry 默认 DSN 已改为仅在显式配置时启用，相关测试已补齐。
- 项目当前发布策略固定为 GitHub Actions 远程构建与 GitHub Release 交付 Android APK + 全平台 daemon。
- 本地工作目录仍会生成 `.tmp/` 与 `.downloads/` 这类临时目录，需要通过仓库级忽略规则避免污染提交流。

# Changelog v16

---
### [2026-05-05 00:00] | Agent: Codex (GPT-5)
- **File**: `/.gitignore`, `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v16.md`
- **Change**: 在根级 `.gitignore` 中新增 `.tmp/` 与 `.downloads/` 目录忽略规则，并按日志分片上限切换活跃 changelog 到 `changelog_v16.md`，记录本次 Git 忽略策略调整。
- **Why**: 这两个目录当前承载下载回来的 daemon 二进制、smoke/mcp 测试输出和其他本地临时文件，不应持续出现在 `git status` 中，更不应被误纳入提交；同时 `changelog_v15.md` 已接近 100 行，继续追加会违反项目日志分片约定。
- **Goal**: 让仓库默认忽略本地下载与临时运行产物，减少 Git 噪音并保持开发记忆分片可持续维护。
---
### [2026-05-05 00:19] | Agent: Codex (GPT-5)
- **File**: `/src/features/settings/utils/remoteBackends.ts`, `/src/features/settings/hooks/useSettingsServerSection.ts`
- **Change**: 抽出远程端共享工具模块，集中管理 provider/endpoint 归一化、active remote 解析、候选名称生成与 `remoteBackends + legacy active fields` 同步逻辑；设置页 Server section 改为复用这套 helper，并补充说明单活远程端镜像规则的注释。
- **Why**: 全局远程端快速切换与设置页管理依赖同一套远程端约束，如果继续分散维护，会很快出现默认值、校验与 active 同步规则漂移。
- **Goal**: 让全局切换入口与设置页共享同一套远程端真源逻辑，减少行为分叉与后续维护成本。
---
### [2026-05-05 00:19] | Agent: Codex (GPT-5)
- **File**: `/src/features/app/hooks/useRemoteBackendSwitcher.ts`, `/src/features/app/components/RemoteBackendSwitcher.tsx`, `/src/features/app/components/MainApp.tsx`, `/src/features/app/hooks/useMainAppShellProps.tsx`, `/src/styles/remote-switcher.css`, `/src/App.tsx`
- **Change**: 新增全局顶部远程端快速切换入口与面板，支持移动端 / Web 优先的远程端列表、预连接测试、确认切换、快速新增远程端，以及切换成功后跳转项目列表并刷新工作区；同时把远程切换器与现有 Live/Polling 状态指示共同挂入 topbar actions。
- **Why**: 项目虽已支持多远程端保存，但只能在 Settings -> Server 内切换，无法满足移动端和 Web 端频繁切换远程端的高频操作场景。
- **Goal**: 让用户无需进入设置页即可安全、快速地切换远程端，并在切换完成后立即回到项目列表开始操作。
---
### [2026-05-05 00:20] | Agent: Codex (GPT-5)
- **File**: `/src/features/app/hooks/useRemoteBackendSwitcher.test.tsx`, `/src/features/app/hooks/useMainAppShellProps.test.tsx`
- **Change**: 先按 TDD 补充“远程端先预连接再确认切换”“快速新增远程端需通过连通性验证”“顶栏同时渲染远程切换入口与 Live 指示”三组定向测试，并在实现迭代中修正测试桩类型和新增远程端时序，确认测试转绿。
- **Why**: 远程端切换涉及临时试连、设置回滚、正式持久化与全局 UI 组合输出，若不先用失败测试固定边界，后续容易把单活模型或顶栏行为改散。
- **Goal**: 用自动化测试证明这次新增的全局远程端切换主链路、快速新增路径和 topbar 挂载行为都符合设计预期。
---
### [2026-05-05 00:54] | Agent: Codex (GPT-5)
- **File**: `/.github/workflows/release-daemon-binaries.yml`, `/docs/build/github-release-runbook.md`
- **Change**: 将 daemon 的 macOS 构建 runner 从漂移式 `macos-latest` 固化为 `macos-15`，并修正 release 上传步骤：先复制为真实的平台化资产文件名再上传，避免 `codex_monitor_daemon` 同名文件在 GitHub Release 中相互覆盖；同时在发版 runbook 中补充 `v1.0.3` 重发约束和 Apple Silicon 构建说明。
- **Why**: 事实核对显示 `v1.0.3` 的 daemon workflow 中 macOS job 实际成功，但 Release 页面只保留了 Linux/Windows 资产，说明问题不在编译本身，而在上传阶段把多平台二进制当作同名文件上传，后者覆盖前者；另外显式 runner 标签可以减少 `macos-latest` 漂移引起的构建环境变化。
- **Goal**: 让 `v1.0.3` 重发后稳定产出并保留 `codex_monitor_daemon-macos-aarch64` 在内的全平台 daemon 资产，并把这套约束沉淀到正式发版流程中。
---
### [2026-05-05 00:54] | Agent: Codex (GPT-5)
- **File**: `/src/features/app/components/RemoteBackendSwitcher.tsx`, `/src/features/app/components/MainApp.tsx`, `/src/features/app/hooks/useSettingsModalState.ts`, `/src/features/app/hooks/useSettingsModalState.test.tsx`, `/src/styles/remote-switcher.css`
- **Change**: 按反馈将顶栏远程端入口从“完整半透明切换弹窗”收口为“轻量 Server 入口”：按钮点击后直接打开 `Settings -> Server`，移动端仅保留紧凑入口；同时删除原有顶栏远程切换弹层与对应透明样式，并补充测试锁定 `openSettings("server")` 行为。
- **Why**: 现有 REMOTE 弹窗透明度与主界面玻璃层冲突，文字可读性差；同时项目本就已有完整的 Server 管理面，再在顶栏复制一套切换 UI 会挤压移动端顶部空间并制造双入口分裂。
- **Goal**: 消除顶栏弹层的可读性问题，把远程端切换/新增/测试统一收回到现有 `Settings -> Server`，只在顶栏保留低占用的快捷入口。
---
### [2026-05-05 16:24] | Agent: Codex (GPT-5)
- **File**: `/src/types.ts`, `/src/features/settings/hooks/useAppSettings.ts`, `/src/features/settings/hooks/useAppSettings.test.ts`, `/src/features/settings/components/sections/SettingsServerSection.tsx`, `/src/features/settings/components/sections/SettingsServerSection.test.tsx`, `/src/features/settings/components/SettingsView.test.tsx`, `/src/services/browserRemote.ts`, `/src/services/events.test.ts`, `/src/services/tauri.test.ts`, `/src-tauri/src/types.rs`, `/src-tauri/src/storage.rs`
- **Change**: 新增 `remoteLowBandwidthMode` 设置项，并在前端设置页、浏览器远程配置归一化与 Rust 设置模型中补齐默认值、持久化兼容与测试覆盖；Server 设置区新增低带宽模式开关。
- **Why**: 远程部署在窄带服务器时，现有设置模型没有“减少自动流量”的控制位；新增字段如果不贯穿前后端默认值与兼容读取路径，旧配置升级时容易出现回归。
- **Goal**: 为远程环境提供可持久化的低带宽模式基础能力，并确保配置在旧数据、浏览器回退和跨端读取场景下都能稳定工作。
---
### [2026-05-05 16:24] | Agent: Codex (GPT-5)
- **File**: `/src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.ts`, `/src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.test.tsx`, `/src/features/app/hooks/useRemoteThreadRefreshOnFocus.ts`, `/src/features/app/hooks/useRemoteThreadRefreshOnFocus.test.tsx`, `/src/features/git/hooks/useGitStatus.ts`, `/src/features/git/hooks/useGitStatus.test.tsx`, `/src/features/git/hooks/useGitLog.ts`, `/src/features/workspaces/hooks/useWorkspaceFiles.ts`, `/src/features/app/hooks/useWorkspaceFileListing.ts`, `/src/features/app/hooks/useMainAppWorkspaceLifecycle.ts`, `/src/features/app/hooks/useMainAppGitState.ts`, `/src/features/app/hooks/useMainAppComposerWorkspaceState.ts`, `/src/features/app/components/MainApp.tsx`
- **Change**: 将 `remoteLowBandwidthMode` 透传到远程 workspace、thread、git status、git log 与文件列表相关 hooks；低带宽模式下关闭后台轮询，仅保留首次加载、手动刷新和窗口重新聚焦后的必要同步，并补充对应测试。
- **Why**: 远程 workspace、线程和 Git 面板此前存在多路定时轮询，在高延迟或小带宽服务器上会明显放大卡顿、报错与无效请求；保留显式刷新与 focus 恢复，比粗暴停功能更稳妥。
- **Goal**: 在不破坏核心远程操作链路的前提下，显著降低远程模式持续请求频率，改善 worktree / workspace 远程使用稳定性。
---
### [2026-05-05 16:24] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/bin/codex_monitor_daemon.rs`
- **Change**: 为 daemon 的 `sync_workspaces_from_storage` 增加基于 `workspaces.json` mtime 的同步标记缓存；当存储文件未变化时跳过重复读盘、工作区覆盖与 stale session 清理。
- **Why**: 远程 `list_workspaces` 高频触发时，daemon 之前每次都会重新读 storage 并做 prune，这在存在 worktree 的项目上会放大 IO 与状态抖动，表现为卡顿、报错以及不必要的远程资源消耗。
- **Goal**: 让远程 daemon 在工作区清单未变化时走轻量路径，减少 worktree 场景下的重复同步开销并提升远程列表操作稳定性。
---
### [2026-05-05 14:04] | Agent: Codex (GPT-5)
- **File**: `/src/features/app/hooks/useAppServerEvents.test.tsx`, `/src/features/app/hooks/useGitPanelController.test.tsx`, `/src/features/settings/components/sections/SettingsServerSection.test.tsx`, `/src-tauri/src/backend/app_server.rs`, `/src-tauri/src/shared/workspaces_core/connect.rs`, `/src-tauri/src/shared/workspaces_core/runtime_codex_args.rs`
- **Change**: 根据 GitHub CI 失败日志修正四类问题：移除 `requestUserInput` 旧断言里对 `isOther: false` 的依赖；在 Git 面板测试中显式固定 `lowBandwidthMode: false`；把低带宽开关测试改为按 `aria-label` 精确命中真实 toggle；同时修复 Rust 测试/编译基线，给 `WorkspaceSession` 测试构造器补齐 `mcp_startup_*` 字段，并将 `split_paths(path_env.as_ref())` 改为对 `String` 的无歧义调用。
- **Why**: 远程 CI 已明确失败，且失败分为“本轮改动引起的前端测试偏差”和“仓库当前 Rust 基线与新工具链不兼容”两类；如果不先对着日志逐项修正，就无法继续走 GitHub 编译与发布链路。
- **Goal**: 让本轮低带宽/worktree 修复在 GitHub CI 上重新恢复可验证状态，为后续远程 Release 编译清障。
---
### [2026-05-05 16:42] | Agent: Codex (GPT-5)
- **File**: `/src/features/app/hooks/useGitPanelController.test.tsx`, `/src/features/settings/components/sections/SettingsServerSection.test.tsx`, `/src-tauri/src/bin/codex_monitor_daemon.rs`, `/src-tauri/src/bin/codex_monitor_daemonctl.rs`, `/src-tauri/src/shared/workspaces_core/connect.rs`, `/src-tauri/src/shared/workspaces_core/runtime_codex_args.rs`
- **Change**: 继续按 GitHub CI 日志收口残余失败：更新重仓库 diff preload 测试预期并补充注释，避免把 hook 启用状态误当成 defer 行为；低带宽开关测试改为在多个同名 button 中精确筛选带 `aria-pressed` 的真实 toggle；同时为 daemon / workspace core 的测试构造器补齐 `storage_sync_marker_ms` 与 `mcp_startup_*` 字段，并把 `Notify` 导入缩到测试作用域，给 `codex_monitor_daemonctl.rs` 补上 `build_daemon_launch_env` 引用。
- **Why**: 新一轮 CI 日志说明前一版修复仍残留两类问题：前端测试选择器和预期没有完全对齐真实组件/实现；Rust 测试目标没有同步到新增字段与函数可见性要求。
- **Goal**: 清掉当前已知的 JS/Rust CI 失败根因，让下一次 GitHub Actions 能继续验证低带宽与 worktree 修复主线。
---
### [2026-05-05 16:58] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/bin/codex_monitor_daemonctl.rs`, `/src-tauri/src/bin/codex_monitor_daemon.rs`
- **Change**: 根据 `25364174509` 的 macOS Rust job 日志，修正测试作用域导入：移除 `codex_monitor_daemonctl.rs` 顶层对 `build_daemon_launch_env` 的错误引入，改为只在 `#[cfg(test)] mod tests` 中导入；同时在 `codex_monitor_daemon.rs` 的测试模块补上 `tokio::sync::Notify` 引用，匹配新增的 `WorkspaceSession` 构造字段。
- **Why**: 前一版修复把测试依赖放到了生产模块顶层，导致 `bin` 目标与 `bin test` 目标分别出现“重复定义”和“测试作用域找不到函数/类型”的相反错误。
- **Goal**: 让 Rust 测试在各 target 下共享一致的测试依赖作用域，消除当前 macOS/Windows 编译失败。
---
### [2026-05-05 17:09] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/shared/git_ui_core/tests.rs`, `/src-tauri/src/backend/app_server.rs`, `/src-tauri/src/shared/git_runtime.rs`
- **Change**: 根据 `25364421131` 的 Linux/macOS/Windows Rust 日志继续收口平台与契约漂移：将 `get_git_status_marks_large_mode_only_repo_as_heavy` 从断言已移除的 `loadHint` 字段改为验证原始状态列表仍完整返回 mode-only 变更；为 `build_codex_path_env_adds_usr_local_node_bin_on_unix` 增加 Unix 条件编译；把 Git runtime include 路径测试改为使用统一的斜杠归一化结果，避免 Windows 路径分隔符造成误报。
- **Why**: 剩余失败已经不在业务实现，而在测试对旧返回结构和 Unix 路径格式的假设；继续硬追实现只会引入无意义回退。
- **Goal**: 让跨平台 Rust 测试重新对齐当前真实契约，清掉本轮 GitHub CI 的最后一组测试误报。
---
### [2026-05-05 17:18] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/bin/codex_monitor_daemonctl.rs`
- **Change**: 根据 `25365100312` 的三平台 Rust 日志，修正 `daemon_launch_env_sets_codex_home_when_missing` 测试：不再错误地把 runner 环境下的 `HOME`/`USERPROFILE` 断言成固定 `/root`，而是按实现逻辑验证“优先继承现有 HOME，其次 USERPROFILE，最后才回落 `/root`”；同时把 PATH 断言分成 Windows 与非 Windows 两套预期。
- **Why**: 实现从一开始就是“复用当前运行环境的 HOME 与 PATH”，此前测试把 fallback 路径当成了通用行为，导致 Linux/macOS/Windows 全部误报。
- **Goal**: 消除最后一个跨平台一致失败的测试断言错误，让 CI 能继续完成 Rust 验证。
---
### [2026-05-05 17:31] | Agent: Codex (GPT-5)
- **File**: `/src/features/app/components/RemoteBackendSwitcher.tsx`, `/src/features/app/components/MainApp.tsx`, `/src/styles/remote-switcher.css`
- **Change**: 将顶部 Server 快捷入口收口为纯图标按钮，移除非手机场景下的远程名称文本显示；同时取消此前“仅 remote/mobile/web 才显示”的挂载条件，改为所有终端尺寸都显示该入口，并把按钮样式改成固定尺寸的图标胶囊。
- **Why**: 当前需求要求顶部只保留一个图标，且移动端也必须显示；继续保留桌面文字标签会占用 topbar 空间，并与“统一单图标入口”目标冲突。
- **Goal**: 让顶部远程入口在桌面和移动端都保持一致、紧凑的单图标表现，同时仍能一跳进入 `Settings -> Server`。
