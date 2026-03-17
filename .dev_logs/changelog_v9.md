State Summary (from `changelog_v8.md`):
- Android（Capacitor）远程对话同步体验已增强：事件流断开/停滞时移动端静默降级为 polling（不再弹 toast/弹窗），并在 polling + processing 时启用更高频轮询以避免“假轮询”。
- 移动端 thread-switch 强制触发 resume refresh，确保切回线程时补齐离开期间错过的最新消息。
- 已接入 Capacitor `@capacitor/app` 的 `appStateChange`（isActive=true）：Android 从后台回前台会自动刷新当前 workspace 的 thread 列表，并触发当前 thread 的重连/补齐（含冷却与守卫）。

# Changelog v9

---
### [2026-03-16 21:16] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v9.md`
- **Change**: 因 `changelog_v8.md` 超过 100 行，创建新的分片 `changelog_v9.md` 并将 manifest 的 Current 指向 v9；在 v9 开头写入 v8 的 State Summary。
- **Why**: 按仓库日志分片规则控制上下文规模，保证后续变更记录可持续维护。
- **Goal**: 让开发记忆与任务进度持续可追踪且不超出单分片容量。

---
### [2026-03-16 22:02] | Agent: Codex (GPT-5)
- **File**: `src/types.ts`
- **Change**: 新增通知强度类型 `NotificationIntensity`（`high|medium|low`），并在 `AppSettings` 增加 `notificationIntensity` 字段。
- **Why**: 为“每次 AI 回复完成都可通知”的三档策略提供可持久化配置入口。
- **Goal**: 让通知策略可配置且跨运行时一致读取。

---
### [2026-03-16 22:02] | Agent: Codex (GPT-5)
- **File**: `src/features/settings/hooks/useAppSettings.ts`
- **Change**: `buildDefaultSettings()` 默认 `notificationIntensity: "high"`；`normalizeAppSettings()` 对非法/未知值回退到 `"high"`。
- **Why**: 保证升级后默认行为符合“强度高”，且旧配置/损坏配置不会导致运行时异常。
- **Goal**: 提供稳定默认值与兼容性容错。

---
### [2026-03-16 22:02] | Agent: Codex (GPT-5)
- **File**: `src/features/settings/components/sections/SettingsDisplaySection.tsx`
- **Change**: 在 System notifications 下新增 `Notification intensity` 下拉选择（高/中/低），并更新系统通知相关文案；当 `systemNotificationsEnabled=false` 时禁用选择框。
- **Why**: 让用户可以直接在设置中控制通知“强度”策略，并减少开关关闭时的困惑。
- **Goal**: 提升通知可控性与可理解性，默认高强度覆盖多工作区并行对话。

---
### [2026-03-16 22:05] | Agent: Codex (GPT-5)
- **File**: `src/utils/notificationPolicy.ts`
- **Change**: 新增统一的通知强度策略函数 `shouldSendNotificationByIntensity(...)`，支持 high/medium/low，并以（前台/聊天可见/当前对话）作为 medium 的抑制条件。
- **Why**: 将通知强度判定从具体 hooks 中抽离，避免两套通知系统（turn/消息完成 vs response-required）出现规则漂移。
- **Goal**: 为后续通知 hooks 接线提供单一可信的策略实现与可测试点。

---
### [2026-03-16 22:17] | Agent: Codex (GPT-5)
- **File**: `src/features/notifications/hooks/useAgentSystemNotifications.ts`
- **Change**: 通知判定改为调用 `shouldSendNotificationByIntensity`，新增参数（`notificationIntensity`/active workspace&thread/`isChatVisible`）；高强度下将防抖间隔降为 0（不再强制 1500ms），并保持 sub-agent 过滤与 deep-link extra。
- **Why**: 实现“高：每次回复完成都通知；中：仅抑制当前可见聊天；低：仅后台通知”的核心规则，并覆盖多工作区并行事件。
- **Goal**: 让任意 workspace/thread 的 AI 回复完成都能按强度策略发出系统通知。

---
### [2026-03-16 22:17] | Agent: Codex (GPT-5)
- **File**: `src/features/notifications/hooks/useAgentResponseRequiredNotifications.ts`
- **Change**: 将 approvals/questions/plan-ready 通知接入强度策略（新增同样的上下文参数）；区分“策略抑制（不重试）”与“节流抑制（应重试）”；高强度下将节流间隔降为 0。
- **Why**: 你要求“所有流程（包含选择、确认等）都需要通知”，且 medium/low 在前台时要能正确抑制当前对话提示而不影响其他工作区。
- **Goal**: 让需要你响应的通知也遵循统一的强度策略，并避免前台抑制被误判为“稍后再通知”。

---
### [2026-03-16 22:17] | Agent: Codex (GPT-5)
- **File**: `src/features/app/hooks/useUpdaterController.ts`, `src/features/app/hooks/useResponseRequiredNotificationsController.ts`, `src/features/app/components/MainApp.tsx`
- **Change**: 从 MainApp 计算并传入 active workspace/thread 与 `isChatVisibleForNotifications`；两类通知 controller 均新增并透传 `notificationIntensity`；移除 Android 强制静音 sub-agent 通知的覆盖逻辑；在系统通知开启时预请求通知权限。
- **Why**: 通知强度的 medium 判定依赖“当前对话 + 聊天是否可见”，必须在主编排层提供上下文；同时与你选择的“sub-agent 仍由开关控制”保持一致。
- **Goal**: 保证多工作区并行时也能正确判断“当前对话是否需要抑制”，并提升第一次后台通知前的权限成功率。

---
### [2026-03-16 22:17] | Agent: Codex (GPT-5)
- **File**: `src/features/layout/hooks/useWindowFocusState.ts`
- **Change**: 在移动端（Capacitor native）额外监听 `@capacitor/app` 的 `appStateChange`，用 `state.isActive` 更新 focus 状态。
- **Why**: 解决移动端切后台后 DOM focus/visibility 事件不可靠导致的“后台不通知”问题，提高前后台判定准确性。
- **Goal**: 让 low/medium 的“后台才通知”在移动端更稳定生效。

---
### [2026-03-16 22:17] | Agent: Codex (GPT-5)
- **File**: `src/services/tauri.ts`
- **Change**: 新增 `ensureNotificationPermission()` 统一做通知权限预请求（Tauri plugin / Capacitor LocalNotifications），并抽出 `notificationChannel()` 复用 channel 配置。
- **Why**: 提前触发权限/通道创建可减少真正需要通知时失败概率，尤其是在移动端后台回调时。
- **Goal**: 提升系统通知在首次使用与后台场景下的成功率。

---
### [2026-03-16 22:17] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/types.rs`
- **Change**: 在 Rust `AppSettings` 增加 `notificationIntensity`（默认 `high`）并补齐默认 JSON 反序列化测试断言。
- **Why**: 该设置需要持久化到后端配置文件并能从旧配置平滑升级。
- **Goal**: 让通知强度配置在 Tauri/daemon 侧正确读写与默认生效。

---
### [2026-03-16 22:17] | Agent: Codex (GPT-5)
- **File**: `src/utils/notificationPolicy.test.ts`, `src/features/notifications/hooks/useAgentSystemNotifications.test.tsx`, `src/features/notifications/hooks/useAgentResponseRequiredNotifications.test.tsx`, `src/features/settings/components/SettingsView.test.tsx`, `src/features/settings/components/sections/SettingsDisplaySection.test.tsx`
- **Change**: 新增策略单测覆盖 high/medium/low；更新现有通知与设置测试的必填 settings 字段；新增“修改通知强度”设置 UI 测试；删除过时的 Android override 单测（对应实现已移除）。
- **Why**: 新增字段与策略会影响多处测试夹具，必须补齐以保持回归稳定；策略函数需要单测锁定行为。
- **Goal**: 让三档强度策略与设置 UI 在测试层可持续验证，降低后续改动风险。

---
### [2026-03-16 22:32] | Agent: Codex (GPT-5)
- **File**: `package.json`, `src-tauri/Cargo.toml`（验证）
- **Change**: 运行三轮验证：`npm run typecheck`、`npm run test`、`cd src-tauri && cargo check`；均通过。
- **Why**: 按仓库验证矩阵闭环，确保新增设置字段、通知策略接线与移动端前后台判定增强不会破坏既有逻辑。
- **Goal**: 交付一个可编译、测试通过、可在移动端前后台正确触发通知的新通知强度能力。
