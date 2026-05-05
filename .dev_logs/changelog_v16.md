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
