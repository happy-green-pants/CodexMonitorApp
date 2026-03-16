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
