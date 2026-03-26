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
