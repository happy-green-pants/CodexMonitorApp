# Changelog v1

State Summary:
- Initialized project development log storage for the Web + Android remote-first expansion effort.

---
### [2026-03-12 20:27] | Agent: Codex
- **File**: `/.dev_logs/manifest.md`
- **Change**: 初始化开发日志索引，声明当前活跃 changelog 与当前任务目标。
- **Why**: 仓库要求在任何代码修改前建立并维护开发记忆入口。
- **Goal**: 为后续多端改造提供一致的变更追踪与任务进度索引。

---
### [2026-03-12 20:27] | Agent: Codex
- **File**: `/.dev_logs/changelog_v1.md`
- **Change**: 创建首个日志分片并写入初始化记录。
- **Why**: 仓库要求每次改动后立即记录，且使用分片文件管理上下文。
- **Goal**: 记录 Web + Android 远程化改造的连续变更历史。

---
### [2026-03-12 20:36] | Agent: Codex
- **File**: `/src-tauri/src/bin/codex_monitor_daemon.rs`
- **Change**: 为 daemon 新增 `--http-listen` 配置入口补充首轮失败测试，覆盖 usage 文案、参数解析与默认关闭行为。
- **Why**: Web/Android 的浏览器可用入口需要独立 HTTP/WS 监听边界，先用测试锁定 CLI 语义，避免后续实现与现有 TCP 行为冲突。
- **Goal**: 为内建 HTTP/WS daemon 入口建立 TDD 基线。

---
### [2026-03-12 20:39] | Agent: Codex
- **File**: `/src-tauri/src/bin/codex_monitor_daemon.rs`
- **Change**: 为 daemon 配置结构补充 `http_listen` 字段，新增 `parse_args_from(...)` 并扩展 usage/CLI 以支持 `--http-listen`。
- **Why**: 需要在不破坏现有 TCP 语义的前提下，为浏览器接入预留独立 HTTP/WS 监听地址。
- **Goal**: 让 daemon 具备可测试、可扩展的浏览器入口配置边界。

---
### [2026-03-12 20:45] | Agent: Codex
- **File**: `/src-tauri/Cargo.toml`
- **Change**: 为 daemon 浏览器入口引入 `axum` 与 `tower` 依赖。
- **Why**: 需要用稳定的 HTTP/WebSocket 路由层复用现有 RPC 与事件广播。
- **Goal**: 为 Web/Android 的 HTTP+WSS 访问提供服务端基础设施。

---
### [2026-03-12 20:45] | Agent: Codex
- **File**: `/src-tauri/src/bin/codex_monitor_daemon/http.rs`
- **Change**: 新增 daemon HTTP 子模块，提供 `/healthz`、`/version`、`/rpc`、`/rpc/ws` 路由，复用现有 RPC 分发并通过 broadcast 转发事件；同时补充基础 HTTP 路由测试。
- **Why**: 浏览器环境无法直接接入现有原始 TCP JSON-RPC，需要原生 HTTP/WS 壳层。
- **Goal**: 让 daemon 内建浏览器可用的远程接入面。

---
### [2026-03-12 20:45] | Agent: Codex
- **File**: `/src-tauri/src/bin/codex_monitor_daemon.rs`
- **Change**: 主进程按 `--http-listen` 可选启动第二个 HTTP 监听器，并保持原有 TCP listener 不变。
- **Why**: 需要在不中断桌面 TCP 远程兼容性的前提下，为 Web 端增加内建服务入口。
- **Goal**: 同进程提供 TCP 与 HTTP/WS 两种远程接入能力。

---
### [2026-03-12 20:49] | Agent: Codex
- **File**: `/src/services/browserRemote.test.ts`
- **Change**: 新增浏览器远程 transport 的失败测试，覆盖默认远程配置、本地持久化、HTTP JSON-RPC 调用与错误透传。
- **Why**: Web/Android 的浏览器可用 client 需要先锁定最核心的数据面和认证语义。
- **Goal**: 为前端 `http` provider 与浏览器 remote invoke 建立可执行测试基线。

---
### [2026-03-12 20:53] | Agent: Codex
- **File**: `/src/services/browserRemote.ts`
- **Change**: 新增浏览器远程 client 基础模块，提供本地存储远程配置、HTTP origin 规范化、RPC URL/WS URL 构造与 `browserRemoteInvoke(...)`。
- **Why**: Web 运行时没有 Tauri `invoke`，需要独立的浏览器 transport 实现。
- **Goal**: 为 Web/Android 的 `http` provider 提供最小可用的数据调用层。

---
### [2026-03-12 20:53] | Agent: Codex
- **File**: `/src/types.ts`
- **Change**: 将 `RemoteBackendProvider` 从单一 `tcp` 扩展为 `tcp | http`。
- **Why**: 前端需要显式区分原始 TCP 与浏览器可用的 HTTP 远程模式。
- **Goal**: 为多传输远程后端建立统一类型契约。

---
### [2026-03-12 20:55] | Agent: Codex
- **File**: `/src/services/browserRemote.ts`
- **Change**: 修正浏览器远程配置归一化逻辑，使活动远程节点与 legacy `remoteBackendHost/token/provider` 字段保持同步。
- **Why**: 测试暴露出保存后的活动节点仍使用旧 host，导致 HTTP RPC 命中错误地址。
- **Goal**: 保证浏览器远程配置的持久化与实际请求地址一致。

---
### [2026-03-12 11:20] | Agent: Codex
- **File**: `/src/services/tauri.test.ts`
- **Change**: 补齐浏览器模式测试导入，并新增 `updateAppSettings()` 在非 Tauri 环境下写入浏览器远程设置的失败测试。
- **Why**: 需要先把浏览器运行时的服务层行为锁定到可执行测试，而不是让测试因缺失导入或未覆盖的保存路径失真。
- **Goal**: 为 `tauri.ts` 的浏览器 settings 分流建立正确的 TDD 红灯基线。

---
### [2026-03-12 11:21] | Agent: Codex
- **File**: `/src/services/tauri.ts`
- **Change**: 引入统一 `invoke(...)` 分流器，非 Tauri 环境下将 `get/update_app_settings` 转到浏览器本地存储，将其余命令在 `http` provider 下转发到 `browserRemoteInvoke(...)`。
- **Why**: Web/Android 浏览器运行时没有 Tauri bridge，但现有服务层广泛依赖 `invoke` 封装，需要最小侵入地复用原命令封装。
- **Goal**: 让现有前端业务代码在浏览器环境中通过 HTTP JSON-RPC 远程访问服务器端 Codex。

---
### [2026-03-12 11:31] | Agent: Codex
- **File**: `/src/services/tauri.ts`
- **Change**: 修正统一分流器的兼容性细节，保持 Tauri 调用在无 payload 时使用原始单参数签名，并改为直接基于浏览器远程设置判断 `http` provider 可用性。
- **Why**: 目标测试暴露出 `invoke(command, undefined)` 会破坏既有断言，且通过独立 helper 判断浏览器 transport 时会被测试 mock 干扰。
- **Goal**: 保持旧服务层调用契约稳定，同时让浏览器远程模式按实际设置可靠生效。

---
### [2026-03-12 11:34] | Agent: Codex
- **File**: `/src/services/events.test.ts`
- **Change**: 为浏览器模式新增 WebSocket 事件桥失败测试，覆盖首帧 token 认证、`app-server-event` 推送分发以及连接初始化错误上报。
- **Why**: 事件订阅层目前只绑定 Tauri `listen(...)`，Web 端即使能调 RPC 也收不到服务端实时事件。
- **Goal**: 为 `events.ts` 的浏览器远程事件桥建立明确的 TDD 契约。

---
### [2026-03-12 11:36] | Agent: Codex
- **File**: `/src/services/events.ts`
- **Change**: 为事件订阅 hub 增加运行时分流，浏览器环境下通过远程 `WS` 建立受 token 保护的事件流，并将 `app-server-event`、`terminal-output`、`terminal-exit` 复用到现有订阅接口。
- **Why**: Web/Android 即使已有 HTTP RPC，若没有事件桥仍无法获得线程、终端等实时更新。
- **Goal**: 让浏览器端具备最小可用的实时远程控制能力，而不改动上层业务 hooks。

---
### [2026-03-12 11:41] | Agent: Codex
- **File**: `/src/features/settings/hooks/useAppSettings.test.ts`
- **Change**: 新增 `http` 远程 provider 的归一化测试，要求已保存的 `https://` 远程端点在加载后保持为 `http` provider。
- **Why**: 当前设置归一化仍把远程 provider 压回 `tcp`，会破坏浏览器远程模式。
- **Goal**: 锁定 Web/HTTP 远程配置在设置加载阶段不被回退。

---
### [2026-03-12 11:41] | Agent: Codex
- **File**: `/src/features/settings/components/sections/SettingsServerSection.test.tsx`
- **Change**: 新增 Server 设置区的移动/Web 远程界面测试，要求出现 provider 选择、endpoint 文案和 `https://` 占位提示，并移除 Tailscale 文案依赖。
- **Why**: 现有界面仍以桌面 TCP/Tailscale 为中心，不符合一期的 Web/Android 远程优先目标。
- **Goal**: 用组件级测试约束远程设置入口切换到 endpoint-first 交互。

---
### [2026-03-12 11:41] | Agent: Codex
- **File**: `/src/features/mobile/hooks/useMobileServerSetup.test.ts`
- **Change**: 新增移动向导 hook 测试，要求连接保存时保留当前远程 provider，而不是强制回退为 `tcp`。
- **Why**: Android/Web 入口需要支持 `http` 远程端点，移动连接流程不能覆盖用户选择。
- **Goal**: 保证移动端远程配置与服务层 transport 选择一致。

---
### [2026-03-12 11:52] | Agent: Codex
- **File**: `/src/features/settings/hooks/useAppSettings.ts`
- **Change**: 扩展远程设置归一化，支持 `http` provider，并对 `http` endpoint 与 `tcp host:port` 分别做默认值/格式归一化。
- **Why**: Web 远程模式要求保留 `https://...` 端点，不能再把所有远程配置都折叠回 TCP。
- **Goal**: 让应用层设置模型同时承载浏览器可用的 HTTP 远程和原有 TCP 远程。

---
### [2026-03-12 11:52] | Agent: Codex
- **File**: `/src/features/settings/hooks/useSettingsServerSection.ts`
- **Change**: 引入远程 provider 草稿状态与 endpoint 验证逻辑，区分 Web/移动的 remote-only 运行时和桌面受控运行时，并在浏览器环境禁用桌面专属 daemon/Tailscale 轮询。
- **Why**: 现有 Server 设置 hook 默认强推 TCP 且会在 Web 环境请求桌面专属能力，无法支撑浏览器远程控制。
- **Goal**: 为 Web + Android 的远程设置流提供统一、运行时感知的状态管理。

---
### [2026-03-12 11:52] | Agent: Codex
- **File**: `/src/features/settings/components/sections/SettingsServerSection.tsx`
- **Change**: 将 Server 设置区重构为 endpoint-first UI，增加 provider 选择、远程 endpoint 文案、Web/移动的 remote-only 展示分支，并隐藏浏览器中的桌面专属控件。
- **Why**: 一期目标是远程控制服务器中的 Codex，当前以桌面 Tailscale/TCP 为中心的界面会误导 Web/Android 用户。
- **Goal**: 让设置页直接服务于 Web/Android 远程接入，而不破坏桌面运行时的本地能力。

---
### [2026-03-12 11:52] | Agent: Codex
- **File**: `/src/features/mobile/components/MobileServerSetupWizard.tsx`
- **Change**: 将移动向导文案从 Tailscale/desktop backend 改为通用 remote server endpoint + token 说明。
- **Why**: Android 首发路径不能再把配置说明绑死在 Tailscale 桌面守护进程上。
- **Goal**: 让移动端首次连接流程与新的远程传输模型一致。

---
### [2026-03-12 11:52] | Agent: Codex
- **File**: `/src/features/mobile/hooks/useMobileServerSetup.ts`
- **Change**: 移动连接保存流程保留当前远程 provider，并同步更新最近连接远程节点的 provider 元数据。
- **Why**: 移动远程接入不能在保存时把 `http` provider 强制改回 `tcp`。
- **Goal**: 保证 Android/Web 共享的远程连接模型在移动向导中保持一致。

---
### [2026-03-12 11:52] | Agent: Codex
- **File**: `/src/services/browserRemote.ts`
- **Change**: 为浏览器远程设置归一化补充显式 provider 类型约束，消除 `http|tcp` 扩展后的类型漂移。
- **Why**: `RemoteBackendProvider` 扩展后，浏览器远程设置的推断类型需要与前端主设置模型保持一致。
- **Goal**: 保证浏览器 transport 与应用设置层的 provider 类型契约一致。

---
### [2026-03-12 11:58] | Agent: Codex
- **File**: `/src/features/settings/components/sections/SettingsServerSection.tsx`
- **Change**: 进一步收紧 provider 选择范围，仅在 Web/移动的 remote-only 运行时展示 `HTTP` 选项，桌面 Tauri 运行时继续保留 TCP-only 控件语义。
- **Why**: 桌面 Rust remote transport 目前仍只有 TCP，实现前不能让桌面 UI 静默暴露一个不可用的 `HTTP` 远程模式。
- **Goal**: 在保证 Web/Android 远程能力的同时，避免桌面运行时误选到未实现的 transport。

---
### [2026-03-12 11:58] | Agent: Codex
- **File**: `/src-tauri/src/types.rs`
- **Change**: 将 Rust 侧 `RemoteBackendProvider` 扩展为 `Tcp | Http`，并补充反序列化测试覆盖 `http` provider。
- **Why**: 前端设置模型已经支持 `http`，后端持久化类型若不扩展会在读取设置时产生契约漂移。
- **Goal**: 保持前后端设置结构一致，为 Web/Android 远程配置提供稳定序列化边界。

---
### [2026-03-12 11:58] | Agent: Codex
- **File**: `/src-tauri/src/remote_backend/mod.rs`
- **Change**: 在桌面 Rust remote transport 解析阶段显式拒绝 `HTTP` provider，并新增对应单测。
- **Why**: 当前桌面 remote backend 只实现了 TCP transport，若接受 `http` 会把 URL 当成 TCP host 使用，错误不可诊断。
- **Goal**: 在未实现桌面 HTTP transport 前给出明确错误边界，防止协议误用。
