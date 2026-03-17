State Summary (from `changelog_v7.md`):
- 已增强非 Tauri（含 Android WebView）事件订阅：支持 `Blob` 消息解析、WebSocket 自动重连、事件 hub `onError` 扇出。
- 远程 Live 连接已支持“事件流错误/停滞→自动降级 polling + toast 提示 + 冷却刷新”并有单测覆盖。
- Projects(WorkspaceHome) 已补齐 `Agent access`（`read-only/current/full-access`）选择，并在 run 首条消息与 codex params 种子中携带/持久化该权限。

# Changelog v8

---
### [2026-03-16 12:20] | Agent: Codex (GPT-5)
- **File**: `android/app/src/main/AndroidManifest.xml`
- **Change**: 增加 `android.permission.POST_NOTIFICATIONS` 并将权限声明移动到 `<application>` 之前。
- **Why**: Android 13+（尤其 targetSdk=33+）需要显式声明通知运行时权限；缺失时系统设置中通知开关可能置灰或无法授予。
- **Goal**: 修复 Android 16 设备上“通知权限按钮置灰无法点击”，为后续本地通知弹出打通权限前置条件。
---
### [2026-03-16 12:20] | Agent: Codex (GPT-5)
- **File**: `src/services/tauri.ts`
- **Change**: 为 `sendNotification()` 增加 Capacitor Native 分支：使用 `@capacitor/local-notifications` 请求权限并发送本地通知（含 best-effort channel 创建与 metadata 透传）。
- **Why**: 当前 Android APK 使用 Capacitor 运行时，Tauri notification plugin 不存在，导致“AI 回复完成后系统通知”链路在移动端实际不可用。
- **Goal**: 在 Android（Capacitor）上实现“AI 回复/turn 完成后发系统通知”，优先保障移动端可用性。
---
### [2026-03-16 12:20] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useUpdaterController.ts`
- **Change**: 扩展 Android 通知策略覆写判定：除 Tauri Android 外，新增识别 Capacitor Android（`Capacitor.isNativePlatform() && getPlatform()==='android'`）。
- **Why**: Android App 希望“回复完成即通知”（`minDurationMs=0`）与默认静音 subagent 通知策略；原逻辑仅覆盖 Tauri Mobile。
- **Goal**: 让 Android（Capacitor）也应用移动端的通知策略，提升移动端体验一致性。
---
### [2026-03-16 12:20] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useUpdaterController.test.ts`
- **Change**: 增加/调整测试：mock `@capacitor/core`，覆盖“Capacitor Android 时启用 overrides”的分支。
- **Why**: 锁定平台识别逻辑，防止后续重构导致 Android（Capacitor）通知策略失效。
- **Goal**: 用单测保障移动端通知策略可回归。

---
### [2026-03-16 12:23] | Agent: Codex (GPT-5)
- **File**: `package.json`
- **Change**: 增加依赖 `@capacitor/local-notifications`。
- **Why**: Capacitor Android 运行时需要使用 Capacitor 插件发送系统通知；现有 Tauri 通知插件仅适用于 Tauri runtime。
- **Goal**: 为 Android App 提供可用的本地通知能力。
---
### [2026-03-16 12:23] | Agent: Codex (GPT-5)
- **File**: `package-lock.json`
- **Change**: 锁定新增依赖 `@capacitor/local-notifications` 的安装结果。
- **Why**: 确保 CI/协作环境可复现依赖解析，避免不同机器安装出不同版本导致行为差异。
- **Goal**: 让通知能力在所有环境一致可构建。
---
### [2026-03-16 12:24] | Agent: Codex (GPT-5)
- **File**: `android/app/capacitor.build.gradle`
- **Change**: `cap sync android` 自动加入 `implementation project(':capacitor-local-notifications')`。
- **Why**: Android 原生层需要链接 Capacitor Local Notifications 插件模块，否则运行时无法调用通知能力。
- **Goal**: 让 Android 工程正确打包包含通知插件。
---
### [2026-03-16 12:24] | Agent: Codex (GPT-5)
- **File**: `android/capacitor.settings.gradle`
- **Change**: `cap sync android` 自动加入 `:capacitor-local-notifications` module include 与 projectDir 映射。
- **Why**: Gradle 需要认识该插件模块的工程位置以参与构建。
- **Goal**: 让 Android 构建链路可编译通过并打包插件。
---
### [2026-03-16 12:25] | Agent: Codex (GPT-5)
- **File**: `src/services/tauri.test.ts`
- **Change**: 增加测试覆盖：当处于 Capacitor Native runtime 时，`sendNotification()` 走 `@capacitor/local-notifications`（并验证不会调用 Tauri notification plugin）。
- **Why**: 锁定“Capacitor Android 通知实现”分支，避免未来回归让移动端再次默默不通知。
- **Goal**: 用单测保证 Android（Capacitor）通知通路长期稳定。
---
### [2026-03-16 12:26] | Agent: Codex (GPT-5)
- **File**: `src/services/events.ts`
- **Change**: 修复 ESLint `prefer-const`：将 WebSocket 订阅的 `onError` 引用改为 `const`。
- **Why**: 保持 `npm run lint` 无 error，满足仓库“自动检查”要求。
- **Goal**: 让本次改动在工程约束下可顺利通过检查。

---
### [2026-03-16 21:15] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useRemoteThreadLiveConnection.ts`
- **Change**: 移动端静默降级：事件流错误/停滞降级到 `polling` 不再弹错误 toast；页面不可见时不触发降级后的 `refreshThread`；移动端 thread-switch 强制 `runResume` 以补齐离开期间错过的消息；增加 Capacitor `appStateChange`（isActive=true）时自动 `reconnectLive(..., runResume=true)`（含 2s 冷却）。
- **Why**: Android WebView/Capacitor 后台会中断 WebSocket/事件流；原逻辑会频繁 toast 干扰体验，且从后台回前台可能不触发 focus/visibility 导致数据不刷新。
- **Goal**: 让 Android 上“实时流断开→轮询”过程静默且可靠，回到前台/切回线程时自动补齐最新对话数据。
---
### [2026-03-16 21:15] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useRemoteThreadRefreshOnFocus.ts`
- **Change**: 将轮询变为“状态感知”：新增 `remoteThreadConnectionState` 与两个 interval 常量；仅在 `polling` 状态下启用轮询，且 processing 时使用更短间隔（默认 3000ms），避免“假轮询”；保持 `live` 状态下 suspend 轮询。
- **Why**: 原实现会在 processing 时禁用轮询，导致降级到 polling 后看起来在同步但实际上不拉取。
- **Goal**: 确保 polling 模式下（尤其 processing）会持续拉取并及时展示新消息。
---
### [2026-03-16 21:15] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useMainAppWorkspaceLifecycle.ts`
- **Change**: 接入 Capacitor `@capacitor/app` 的 `appStateChange`：移动端从后台回前台时自动 reconnect workspace（best-effort）并刷新当前 workspace 的 thread 列表（`preserveState + maxPages=1`），含 2s 冷却与 `suspendRemoteLoading`/`backendMode` 守卫；同时把 `remoteThreadConnectionState` 传给 `useRemoteThreadRefreshOnFocus`。
- **Why**: Android 从后台回前台经常不触发 DOM focus/visibility，导致线程与列表都停留旧数据，需要手动刷新。
- **Goal**: 后台→前台自动刷新 thread 列表与对话数据，减少手动刷新操作。
---
### [2026-03-16 21:15] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useMainAppLayoutSurfaces.ts`
- **Change**: 将 Messages 的 `pollingIntervalMs` 与连接状态/processing 联动：Polling+Processing 时显示 3s 倒计时，否则保持 12s。
- **Why**: UI 倒计时应与实际轮询频率一致，避免用户感知“轮询不真实”。
- **Goal**: 让移动端 polling 状态下的同步节奏可见且可信。
---
### [2026-03-16 21:15] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useRemoteThreadLiveConnection.test.tsx`, `src/features/app/hooks/useRemoteThreadRefreshOnFocus.test.tsx`
- **Change**: 新增/调整测试覆盖：移动端降级不 toast；Polling+Processing 会轮询（3s）；移动端 thread-switch 会触发 resume refresh；并更新原有断言以匹配新行为。
- **Why**: 锁定移动端行为，防止后续重构回归到“弹窗干扰/假轮询/回前台不刷新”。
- **Goal**: 用单测保证移动端远程同步体验长期稳定。
---
### [2026-03-16 21:15] | Agent: Codex (GPT-5)
- **File**: `package.json`, `package-lock.json`, `android/capacitor.settings.gradle`, `android/app/capacitor.build.gradle`
- **Change**: 新增依赖 `@capacitor/app` 并运行 `cap sync android`，使 Android 原生工程包含 App 插件模块。
- **Why**: Capacitor 的 app lifecycle（后台/前台）在移动端比 DOM focus/visibility 更可靠，是修复“回前台不刷新”的关键触发源。
- **Goal**: 在 Android（Capacitor）上稳定捕获 resume 事件并驱动自动刷新与重连。
