State Summary (from `changelog_v6.md`):
- 已完成 Web/Android 选图跨运行时适配（非 Tauri 使用 `<input type="file">` 并读取为 `data:` URL；Tauri 继续使用 dialog 插件），并补齐单测覆盖。
- Android(Tauri mobile) 已对“AI 回复完成系统通知”做了平台策略覆写与测试。
- Capacitor Android 工程与签名/同步流程已配置（用于产出 APK 验证）。

# Changelog v7

---
### [2026-03-16 09:05] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/changelog_v7.md`
- **Change**: 创建新日志分片并在文件头部记录上一分片最终状态摘要。
- **Why**: `changelog_v6.md` 已超过 100 行，按仓库规则需要分片以控制上下文与追踪成本。
- **Goal**: 为后续 “Android 远程事件流断开导致卡死” 的修复工作保持可追踪的开发记忆。
---
### [2026-03-16 09:05] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`
- **Change**: 将 Active Changelog 指向 `changelog_v7.md`，并更新 Current Task 为“远程事件流断开/停滞导致 AI 卡死”。
- **Why**: 当前修复焦点已从图片选择器迁移到远程事件流稳定性；需要确保开发记忆检索时不误导。
- **Goal**: 让后续改动围绕“Live→Polling 降级、自动重连、提示与回归测试”展开。

---
### [2026-03-16 09:10] | Agent: Codex (GPT-5)
- **File**: `src/services/events.ts`
- **Change**: 增强浏览器（非 Tauri）事件订阅：支持解析 `Blob` 消息、为 WebSocket 事件流加入自动重连；并为 event hub 增加 error handler 扇出机制，允许多个订阅者各自接收 `onError` 回调。
- **Why**: Android（Capacitor WebView）依赖 `/rpc/ws` 获取实时事件；WebSocket 断开/停滞时若不重连且 UI 仍显示 Live，会导致轮询暂停，从而出现“只请求一次后卡死”。
- **Goal**: 提升远程事件流在移动端的鲁棒性，使上层能够在错误时降级到 Polling 并提示用户，同时后台自动恢复连接。

---
### [2026-03-16 09:18] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useRemoteThreadLiveConnection.ts`
- **Change**: 为远程 Live 连接增加事件流错误降级与“停滞看门狗”：当事件订阅触发 `onError` 或在 processing 状态下超过阈值未收到任何相关事件时，自动将连接状态降级为 `polling`，触发一次 `refreshThread`（带冷却）并通过 toast 提示用户已切换为轮询同步。
- **Why**: 移动端 WebSocket 可能断开或进入“无 close 但无消息”的停滞态；若 UI 持续认为是 Live，会暂停轮询导致对话与审批事件永远不更新。
- **Goal**: 避免 Android（Capacitor WebView）远程模式下出现“只请求一次后卡死”，并在网络波动时实现自动自愈。

---
### [2026-03-16 09:18] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useRemoteThreadLiveConnection.test.tsx`
- **Change**: 增加测试覆盖：事件流 `onError` 触发时会降级到 `polling`、发出错误 toast 且触发一次 `refreshThread`；以及在 processing + Live 状态下事件停滞时会触发看门狗降级与刷新。
- **Why**: 锁定“断开/停滞→降级轮询”的关键行为，防止未来重构导致移动端再次静默卡死。
- **Goal**: 用自动化测试保证远程事件流故障的恢复路径可回归验证。

---
### [2026-03-16 09:18] | Agent: Codex (GPT-5)
- **File**: `src/services/events.test.ts`
- **Change**: 增加测试覆盖：非 Tauri WebSocket 事件可解析 `Blob` 消息；在连接建立后 `close` 会触发 `onError` 且按退避创建新 socket 重连；并补齐 fake timers 清理以避免测试互相污染。
- **Why**: Android WebView 对 WebSocket 消息类型与断链行为存在差异，必须通过测试锁定兼容与重连机制。
- **Goal**: 确保浏览器事件桥在移动端的稳定性与可回归性。

---
### [2026-03-16 09:24] | Agent: Codex (GPT-5)
- **File**: `src/services/events.ts`
- **Change**: 调整 `createBrowserEventSubscription()` 的契约：始终立即 `resolve` 返回 cleanup（即使认证尚未完成），并在后台进行认证与自动重连；同时修复 event hub 的 `start()` 形参未使用导致的 `tsc` 报错。
- **Why**: 上层订阅不应因为 WebSocket 认证/握手阶段的瞬态问题而“订阅失败”；否则 UI 容易进入无法恢复的状态。并且需要保持 `npm run typecheck` 通过。
- **Goal**: 让事件订阅具备持续性（自动重连）与工程约束一致性（类型检查通过）。

---
### [2026-03-16 10:21] | Agent: Codex (GPT-5)
- **File**: `src/features/workspaces/components/WorkspaceHomeRunControls.tsx`
- **Change**: 在 Projects（WorkspaceHome）运行控制栏新增 `Agent access` 下拉框（`read-only/current/full-access`），UI 复用 `composer-select` 样式与 `ComposerMetaBar` 盾牌图标，并通过 props 透传到上层选择处理器。
- **Why**: Projects 页面此前只能选模型/执行模式/协作模式/effort，缺少与 Codex 消息页一致的执行权限控制，导致 run 时无法显式设置 AI 的执行权限。
- **Goal**: 让用户在 Projects 页发起 run 前即可设置并调整 AI 执行权限。
---
### [2026-03-16 10:21] | Agent: Codex (GPT-5)
- **File**: `src/features/workspaces/hooks/useWorkspaceHome.ts`
- **Change**: 为 `useWorkspaceHome` 增加 `accessMode` 入参，并在 local/worktree run 启动消息的 `sendUserMessageToThread` options 与 `seedThreadCodexParams` patch 中携带 `accessMode`。
- **Why**: run 首条消息需要把权限配置传递到后端/daemon 执行面，同时将新 thread 的 codex params 种子写入存储以保持 UI 与后续线程行为一致。
- **Goal**: Projects 页选择的权限能真正影响执行，并成为该 workspace 的默认（`__no_thread__` scope）来源之一。
---
### [2026-03-16 10:21] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useMainAppComposerWorkspaceState.ts`
- **Change**: 将主应用的 `accessMode` 注入 `useWorkspaceHome`，使 Projects 页 run 状态与主线程权限状态一致并可持久化（通过既有 `persistThreadCodexParams` 机制）。
- **Why**: Projects 页与 Codex 页应共享同一套“线程/工作区默认”的权限状态来源，避免两处配置割裂。
- **Goal**: Projects 页权限选择与 Codex 页保持一致，并可被快捷键/菜单循环等机制统一控制。
---
### [2026-03-16 10:21] | Agent: Codex (GPT-5)
- **File**: `src/features/app/components/MainApp.tsx`
- **Change**: 在传入 `useMainAppComposerWorkspaceState` 的 models 中增加 `accessMode`，并在 `workspaceHomeProps` 里透传 `accessMode` 与 `onSelectAccessMode: handleSelectAccessMode` 给 `WorkspaceHome`。
- **Why**: Projects 页面 UI 需要显示当前权限值并允许修改，同时修改应复用现有选择处理器以确保写入 `__no_thread__` / thread scope 存储逻辑一致。
- **Goal**: Projects 页与 Codex 消息页共享同一权限选择与持久化路径，避免引入新状态源。
---
### [2026-03-16 10:21] | Agent: Codex (GPT-5)
- **File**: `src/features/workspaces/components/WorkspaceHome.tsx`
- **Change**: 为 `WorkspaceHome` 增加 `accessMode`/`onSelectAccessMode` props，并透传到 `WorkspaceHomeRunControls`。
- **Why**: 统一 Projects 页组件树的数据流，避免 `WorkspaceHomeRunControls` 直接耦合全局状态。
- **Goal**: Projects 页可配置权限且组件职责边界清晰。
---
### [2026-03-16 10:21] | Agent: Codex (GPT-5)
- **File**: `src/features/workspaces/hooks/useWorkspaceHome.test.tsx`
- **Change**: 更新 hook 单测：所有 `useWorkspaceHome` 调用补齐 `accessMode` 入参，并断言 `sendUserMessageToThread` 与 `seedThreadCodexParams` 都携带正确的 `accessMode`。
- **Why**: 锁定 “Projects 页选择权限 → run 传参/种子写入” 的关键行为，防止未来回归导致权限选择仅停留在 UI。
- **Goal**: 以自动化测试确保权限在 local/worktree 两种 run 模式下都能正确生效。
---
### [2026-03-16 10:21] | Agent: Codex (GPT-5)
- **File**: `src/features/workspaces/components/WorkspaceHome.test.tsx`
- **Change**: 补齐 `WorkspaceHome` 测试的新增 props（`accessMode`/`onSelectAccessMode`），保持测试通过。
- **Why**: 组件新增必选 props 后，旧测试需要同步更新以避免无关失败。
- **Goal**: 保持现有测试稳定并持续覆盖 “非 Tauri 环境不调用 convertFileSrc” 的行为。
