---
### [2026-03-27 11:24] | Agent: Claude Code (Sonnet 4.6)
- **File**: `/CLAUDE.md`
- **Change**: 新增“后端服务打包流程（主工作区）”说明，固化 `codex_monitor_daemon` release 构建命令、产物路径、`--help` 验证与脚本启动方式。
- **Why**: 用户要求将打包流程写入 CLAUDE.md，确保后续指令直接按主工作区流程执行。
- **Goal**: 让“打包后端服务”在主工作区可重复、可验证地完成。
---

State Summary (from `changelog_v12.md`):
- GitHub Release 的 Android APK + daemon 发布流程已固化为默认 runbook。
- 远程 MCP 的 PATH/绝对路径问题已修复，`gemini` 可在远程工作区正常暴露工具。
- 当前工作区仍保留与发版相关的未提交改动，应避免回退或混淆。
- Android 远程模式下仍存在两类待修复问题：远程不可达时 UI 可能长期卡住，以及 `requestUserInput` 丢失实时事件后线程会一直停在回复中。

# Changelog v13

---
### [2026-03-26 00:00] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v13.md`
- **Change**: 将活跃日志分片切换到 `changelog_v13.md`，并把当前任务更新为“Android 远程断连恢复与待响应请求回补”。
- **Why**: 本轮修复跨前端、后端、RPC 与测试多模块，继续堆叠在 `changelog_v12.md` 会逼近分片上限且不利于后续检索。
- **Goal**: 为 Android 远程卡死与 `requestUserInput` 丢失修复提供独立、连续的开发记忆。
---
### [2026-03-26 13:12] | Agent: Codex (GPT-5)
- **File**: `/src/services/browserRemote.ts`, `/src/services/tauri.ts`, `/src/utils/appServerEvents.ts`, `/src/features/app/hooks/useAppServerEvents.ts`, `/src/services/browserRemote.test.ts`
- **Change**: 为浏览器远程 HTTP RPC 增加超时与中止支持；新增 `listPendingServerRequests` 前端封装；把 `serverRequest/resolved` 纳入方法白名单与路由；修正超时测试实现避免 `vi.useFakeTimers()` 与只读 `requestAnimationFrame` 冲突。
- **Why**: Android 远程模式在服务端不可达或请求悬挂时会长期等待，且前端无法感知已解决的 server request。
- **Goal**: 先消除远程请求无限挂起的根因，并为后续 pending request 回补/清理提供稳定前端入口。
---
### [2026-03-26 13:12] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/backend/app_server.rs`, `/src-tauri/src/shared/codex_core.rs`, `/src-tauri/src/codex/mod.rs`, `/src-tauri/src/lib.rs`, `/src-tauri/src/bin/codex_monitor_daemon.rs`, `/src-tauri/src/bin/codex_monitor_daemon/rpc/codex.rs`
- **Change**: 在 `WorkspaceSession` 增加 pending server request 缓存；缓存 approval / `item/tool/requestUserInput` 请求并在 `serverRequest/resolved` 或 `respond_to_server_request` 后清理；新增 `list_pending_server_requests` 的 shared core、Tauri command 与 daemon RPC 支持。
- **Why**: `requestUserInput` 和 approval 之前只依赖实时事件流，移动端断流或恢复后无法重新拿回这些待处理请求。
- **Goal**: 让 app/daemon 都能在重连后按线程查询未完成的 server request，为前端恢复 UI 提供只读回补来源。
---
### [2026-03-26 13:12] | Agent: Codex (GPT-5)
- **File**: `/src/features/threads/hooks/useThreads.ts`, `/src/features/app/hooks/useRemoteThreadLiveConnection.ts`, `/src/features/app/components/MainApp.tsx`, `/src/features/app/hooks/useMainAppLayoutSurfaces.ts`, `/src/features/messages/components/Messages.tsx`, `/src/styles/messages.css`
- **Change**: 在 `useThreads` 中新增 pending request 同步入口并接入 `serverRequest/resolved` 的前端清理；`useRemoteThreadLiveConnection` 在 resume 后同步 pending requests，并暴露 `recoverThreadState()`；移动端消息区新增“Reconnect and Sync”恢复横幅，主界面手动刷新链路改为刷新线程 + 同步 pending requests + 重新挂 live。
- **Why**: 单靠 `refreshThread` 只能恢复消息列表，不能恢复被丢失的 approval / user input；移动端需要显式兜底入口而不是靠重启应用。
- **Goal**: 打通 Android 远程断连后的自动恢复和手动恢复路径，避免线程一直卡在处理中且没有可交互输入。
---
### [2026-03-26 13:12] | Agent: Codex (GPT-5)
- **File**: `/docs/app-server-events.md`
- **Change**: 更新 app-server 协议文档，记录 `serverRequest/resolved` 已被路由，以及新增的 `list_pending_server_requests` 恢复辅助接口。
- **Why**: 本轮改动扩展了事件支持面和 CodexMonitor 自身的恢复接口，文档需要与实现保持一致。
- **Goal**: 降低后续协议排查与多端同步时的认知偏差。
---
### [2026-03-26 15:54] | Agent: Codex (GPT-5)
- **File**: `/package.json`, `/package-lock.json`, `/src-tauri/Cargo.toml`, `/src-tauri/Cargo.lock`, `/src-tauri/tauri.conf.json`, `/android/app/build.gradle`, `/.dev_logs/changelog_v13.md`
- **Change**: 将前端、Tauri、Rust 与 Android 的版本元数据统一提升到 `1.0.2`，并把 Android `versionCode` 从 `6` 递增到 `7`。
- **Why**: `v1.0.1` tag 已误指向旧提交，新的 GitHub 修复发版需要使用全新版本号，避免 Release tag、APK 文件名与应用内部版本信息不一致。
- **Goal**: 为当前合并后的修复代码生成一致的 `v1.0.2` 发布标识，确保 GitHub Release 与客户端版本元数据对齐。
---
### [2026-03-27 09:10] | Agent: Codex (GPT-5)
- **File**: `/src/features/app/hooks/useLiquidGlassEffect.ts`, `/src/features/app/hooks/useLiquidGlassEffect.test.tsx`, `/src/services/tauri.ts`, `/src/services/tauri.test.ts`
- **Change**: 为液态玻璃 hook 增加 `isTauri()` 运行时守卫，并对缺失 `metadata` 的 Tauri 窗口初始化错误做静默降级；为 `setMenuAccelerators` 增加非 Tauri no-op；补充对应回归测试覆盖浏览器/远程模式下的跳过行为与桌面模式下的保留行为。
- **Why**: 远程/移动模式不应访问桌面窗口 API，也不应为菜单快捷键发起远程 RPC，否则会产生 `liquid-glass/apply-error` 与 `menu/accelerator-error` 噪音。
- **Goal**: 让非关键桌面增强在远程/移动 runtime 静默降级，同时保留桌面 Tauri 下原有能力。
---
### [2026-03-27 10:55] | Agent: Codex (GPT-5)
- **File**: `/www/wwwroot/baoyao3/app/cron/controller/Task.php`
- **Change**: 将 `baoyao3` 站点计划任务控制器从“执行后 `sleep(60)` 并再次 HTTP 回调自身”的长阻塞链路改为抽出的 `runCron()` 单次执行；`execute()` 快速返回 JSON，`phpCron()` 在 `fastcgi_finish_request()` 后后台继续执行任务，避免首个触发请求同步等待完整 cron 处理。
- **Why**: 现场证据显示 `baoyao3` 的高延迟来自 `/cron/task/execute.html` 长时间阻塞与自循环调用，PHP-FPM slowlog 明确落在 `Task.php:47` 的 `sleep()`，访问日志持续出现该路由的 `499`。
- **Goal**: 消除可复现的单站点长请求卡顿，让 cron HTTP 入口快速返回，避免持续占用 PHP-FPM worker 并放大访问卡顿。
---
### [2026-03-27 12:58] | Agent: Codex (GPT-5)
- **File**: `/src/features/git/hooks/useGitStatus.test.tsx`, `/src/features/app/hooks/useGitPanelController.test.tsx`, `/src/features/git/components/GitDiffPanel.test.tsx`, `/src-tauri/src/shared/git_ui_core/tests.rs`, `/.dev_logs/manifest.md`
- **Change**: 新增 heavy Git 工作区回归测试骨架，覆盖远程模式下停止 Git 状态轮询、heavy 仓库默认停用自动 diff 加载、Git 面板降级提示，以及 Rust 侧 large mode-change 仓库的 `loadHint` 判定。
- **Why**: 本轮修复要求先用失败测试锁定“远程移动端被 heavy Git 自动链路拖慢”的具体行为，再反推最小实现，避免只做表层限流。
- **Goal**: 为 heavy Git workspace 降级实现提供明确红灯测试，并把当前任务切换到远程移动端连接稳定性修复。
---
### [2026-04-06 17:11] | Agent: Codex (GPT-5)
- **File**: `/src/utils/appServerEvents.ts`, `/src/features/app/hooks/useAppServerEvents.ts`, `/src/services/tauri.ts`, `/src/features/app/components/Sidebar.tsx`, `/src/services/tauri.test.ts`, `/src/features/app/hooks/useAppServerEvents.test.tsx`, `/src/features/app/components/Sidebar.test.tsx`, `/.dev_logs/manifest.md`
- **Change**: 抽出共享 `requestUserInput` 归一化函数，统一兼容 `threadId/thread_id`、`turnId/turn_id`、`itemId/item_id` 与问题选项的清洗；让 `listPendingServerRequests()` 与 `useAppServerEvents()` 共用同一入口；为 Sidebar 的 pending key 计算补充缺字段防御；新增 pending 快照 camelCase、live 事件 camelCase 与 Sidebar 坏数据不崩溃三类回归测试。
- **Why**: 浏览器远程模式下 `list_pending_server_requests` 会把后端原始 camelCase `params` 直接透传到前端，而多个消费点默认读取 snake_case `params.thread_id`；Sidebar 是第一个触发 `trim()` 空引用崩溃的组件，但消息区、通知与响应必需判断也存在同类结构依赖。
- **Goal**: 让网页版、桌面端与移动端都消费同一份稳定的 `RequestUserInputRequest` 形状，消除 pending/live 结构漂移，并把 malformed request 从“整栏崩溃”降级为“忽略坏数据”。
---
### [2026-04-06 18:18] | Agent: Codex (GPT-5)
- **File**: `/src/features/app/hooks/useRemoteThreadLiveConnection.ts`, `/src/features/app/components/MainApp.tsx`, `/src/features/app/hooks/useMainAppLayoutSurfaces.ts`, `/src/features/messages/components/Messages.tsx`, `/src/features/messages/components/MessageRows.tsx`, `/src/features/app/hooks/useRemoteThreadLiveConnection.test.tsx`, `/src/features/messages/components/Messages.test.tsx`, `/.dev_logs/manifest.md`
- **Change**: 移除远程线程实时流报错/卡死时的 toast 提示；停用消息区 `Reconnect and Sync` 横幅与轮询倒计时文案；保留 `Messages` 旧 props 作为兼容壳层但不再生效；将测试改为断言仅通过右上角连接标签表达状态。
- **Why**: 用户要求流断开时不再弹提示，也不再通过消息区额外提示表达轮询/恢复状态，只通过右上角 `Polling` 标签判断即可。
- **Goal**: 让远程流从 `live` 静默降级为 `polling` 或 `disconnected` 时不打断使用体验，同时保留原有自动刷新、自动重连和手动刷新能力。
---
### [2026-04-15 20:31] | Agent: Codex (GPT-5)
- **File**: `/AGENTS.md`, `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v13.md`
- **Change**: 为仓库根 `AGENTS.md` 增补项目特定执行约束，明确本地磁盘受限时禁止将 `tauri:build`、`cargo build --release`、Android 本地打包等作为默认验证手段；同步把 Android、Windows 与 daemon 产物统一收敛到 GitHub Release runbook；更新 manifest 当前任务说明并记录本次文档变更。
- **Why**: 用户要求针对当前项目补充约束，避免本地构建产物挤满磁盘，同时让桌面端、移动端与 daemon 的发行路径统一走线上流程。
- **Goal**: 让后续执行者在阅读 `AGENTS.md` 时直接采用轻量验证和 GitHub 线上发版策略，减少误操作和环境风险。
---
