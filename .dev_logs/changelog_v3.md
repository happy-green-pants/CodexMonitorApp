State Summary (from `changelog_v2.md`):
- 已接入 Web 端远程目录浏览弹窗用于添加 workspace（`DirectoryBrowserPrompt` + `list_directory_entries`）。
- 已修复与 Web 远程模式相关的 TS 类型漂移（`RemoteBackendProvider` 支持 `http`；`DirectoryListingResponse` 类型冲突）。
- 已为 Vitest/jsdom 修复 `parse5` ESM/CJS 兼容问题（通过 `overrides.parse5=7.2.1`），并完成测试回归。

---
### [2026-03-14 16:28] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/app/hooks/useWorkspaceDialogs.ts`
- **Change**: 统一 `ask/message` 在 Web runtime 下的降级策略：删除确认框使用 `await ask(...)`，若插件不可用则 fallback `window.confirm`；删除错误提示同理 fallback `window.alert`。
- **Why**: `@tauri-apps/plugin-dialog` 在浏览器运行时无法调用，必须降级避免抛错；同时修复未 `await` 导致的返回类型不稳定风险。
- **Goal**: 确保 Web 端远程模式下 workspace 删除/错误提示等交互稳定可用。
---
### [2026-03-14 17:02] | Agent: CodeX
- **File**: `/root/.bashrc`
- **Change**: 将 `/root/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin` 加入 PATH，确保 `cargo`/`rustc` 可直接命中。
- **Why**: 当前环境 PATH 无法找到 `cargo`，导致清理/编译需手动指定路径。
- **Goal**: 让后续编译流程可直接使用 `cargo` 与 `rustc`。
---
### [2026-03-14 19:08] | Agent: Claude Code
- **File**: `/www/wwwroot/CodexMonitor/src-tauri/src/bin/codex_monitor_daemon/http.rs`
- **Change**: 为 HTTP 路由加入 `CorsLayer`，允许 `GET/POST` 方法与 `Authorization`/`Content-Type`/`x-codex-monitor-client-version` 头，并开放 `allow_origin(Any)`。
- **Why**: Web 端跨域调用 `/rpc` 被浏览器拦截，需要在后端显式返回 CORS 响应头。
- **Goal**: 让 `codex-monitor.pklm.cloud` 能正常访问 `codex-monitor-server.pklm.cloud/rpc`。
---
### [2026-03-14 19:08] | Agent: Claude Code
- **File**: `/www/wwwroot/CodexMonitor/src-tauri/Cargo.toml`
- **Change**: 新增 `tower-http` 依赖并开启 `cors` feature。
- **Why**: 使用 Axum 的 CORS 中间件需要 `tower-http` 支持。
- **Goal**: 支持 HTTP 服务端 CORS 响应头配置。
---
### [2026-03-14 19:22] | Agent: Claude Code
- **File**: `/etc/profile.d/sh.local`
- **Change**: 增加 `/root/.cargo/bin` 到全局 PATH，确保登录/非登录 shell 都能找到 `cargo`。
- **Why**: 当前 shell 未加载 `~/.cargo/env` 导致 `cargo` 不在 PATH。
- **Goal**: 保证系统级环境变量可定位 Rust 工具链。
---
### [2026-03-14 19:30] | Agent: CodeX
- **File**: `/www/server/panel/vhost/nginx/other_start_codex_monitor_daemon_sh.conf`
- **Change**: 移除 `/rpc` location 内所有 `Access-Control-Allow-*` 相关 `add_header`，并删除对 `OPTIONS` 的 Nginx 侧短路（`return 204`），让预检与实际请求都转发到上游。
- **Why**: Nginx 与上游 Axum CORS 同时注入 `Access-Control-Allow-Origin` 会造成重复值（浏览器报 `*, *` 并拦截）。
- **Goal**: 让浏览器只看到单份 CORS 响应头，修复 Web 端跨域调用远端 `/rpc` 的失败。
---
### [2026-03-14 19:30] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src-tauri/src/bin/codex_monitor_daemon/http.rs`
- **Change**: CORS `allow_methods` 增加 `Method::OPTIONS`，确保预检请求由 Axum `CorsLayer` 正常处理，无需依赖反向代理层兜底。
- **Why**: 浏览器在携带 `Authorization` 头的跨域 POST 前会发起预检 OPTIONS；上游显式允许可减少部署环境差异。
- **Goal**: 让 `codex-monitor.pklm.cloud` 对 `codex-monitor-server.pklm.cloud/rpc` 的跨域 fetch 预检稳定通过，并避免重复头导致的 CORS 拦截。
---
### [2026-03-14 21:12] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/services/browserRemote.test.ts`
- **Change**: 新增浏览器远程返回 HTML/404/非 JSON 时的回归测试，要求其被识别为“无效 RPC 地址”而非笼统无效响应。
- **Why**: 当前 Web 端会把前端站点 HTML 错页误报为通用 invalid response，无法驱动首屏接入门禁重新拉起。
- **Goal**: 为远程地址失效自动回退提供可验证的错误分类基线。
---
### [2026-03-14 21:12] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.test.tsx`
- **Change**: 新增远程接入门禁激活时暂停 focus/polling 刷新的测试，要求不再触发 workspace 刷新与线程列表刷新。
- **Why**: 仅拦截首次加载不足以解决报错，门禁显示期间仍需停止后台轮询避免重复噪音。
- **Goal**: 确保 Web/Android 未完成接入或地址失效时，远程刷新链路完全静默。
---
### [2026-03-14 21:12] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/mobile/hooks/useMobileServerSetup.test.ts`
- **Change**: 新增 Web runtime 下未配置远程地址时显示接入向导的测试，并验证此时不会提前发起 `listWorkspaces`。
- **Why**: 当前首轮 `useWorkspaces -> refreshWorkspaces` 会在 Web 未配置完成前直接触发远程请求，导致初始化报错。
- **Goal**: 锁定“先配置后进入”的首屏门禁行为，并覆盖 Web/Android 共用接入逻辑。
---
### [2026-03-14 21:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/services/browserRemote.ts`
- **Change**: 为浏览器远程调用新增“无效 RPC 响应”错误分类，识别 HTML/404/非 JSON 返回并暴露 `isInvalidBrowserRemoteResponseError` 与本地存储是否已显式保存远程配置的判定函数。
- **Why**: 需要把“请求打到前端站点”与普通网络失败区分开，才能在 Web/Android 中自动重新拉起远程接入门禁。
- **Goal**: 让错误语义可诊断、可编排，支撑首屏接入和运行时失效回退。
---
### [2026-03-14 21:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/mobile/hooks/useMobileServerSetup.ts`
- **Change**: 将移动端接入向导泛化为 Web + Android 共用的远程接入门禁：未显式配置时阻断进入；保存时仅做格式校验；暴露 `notifyRemoteSetupRequired` 供运行时错误回退复用。
- **Why**: 当前 Web 首次进入会在地址未配置完成前直接触发远程请求，导致 `useWorkspaceCrud` 与 usage 拉取报错。
- **Goal**: 统一 Web/Android 的“先配置远程地址再进入”流程，并支持地址失效后自动重新拦截。
---
### [2026-03-14 21:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/hooks/useWorkspaces.ts`
- **Change**: 为 workspace 初始化增加 `suspendInitialRefresh` 开关，允许首屏门禁显示期间跳过首次 `refreshWorkspaces()`。
- **Why**: `useWorkspaces` 挂载即刷新是本次 Web 端初始化报错的直接触发点。
- **Goal**: 从根源阻断未接入完成时的首轮远程 workspace 请求。
---
### [2026-03-14 21:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/hooks/useWorkspaceCrud.ts`
- **Change**: 在 `refreshWorkspaces` 中捕获“无效 RPC 响应”并交由上层门禁回退，而不是继续输出通用加载错误。
- **Why**: 典型地址失效场景应触发重新接入，不应只停留在控制台错误。
- **Goal**: 让已保存但错误的远程地址自动回退到接入弹窗。
---
### [2026-03-14 21:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.ts`
- **Change**: 新增 `suspended` 开关，在远程接入门禁显示期间停止 focus/visibility/polling 刷新。
- **Why**: 即便首轮加载被拦住，后台轮询仍可能继续打到错误地址并重复报错。
- **Goal**: 确保接入门禁显示期间远程刷新链路完全静默。
---
### [2026-03-14 21:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/home/hooks/useLocalUsage.ts`
- **Change**: 为本地 usage 拉取增加远程失效回调，在浏览器远程返回无效 RPC 响应时通知上层重新显示接入门禁。
- **Why**: 首页 usage 轮询是另一路会暴露同类错误的自动请求链路。
- **Goal**: 让 workspace 与 usage 两条入口在地址失效时都能回落到同一接入流程。
---
### [2026-03-14 21:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/app/components/MainApp.tsx`
- **Change**: 将首屏远程门禁接入主应用启动流程，并把暂停开关传递给 workspace 初始化、焦点轮询和首页 usage 加载。
- **Why**: 只有在主编排层统一控制，才能彻底避免 Web/Android 在接入前提前访问远程后端。
- **Goal**: 让“先配置后进入”和“地址失效自动重拦截”成为应用级行为。
---
### [2026-03-14 21:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/mobile/components/MobileServerSetupWizard.tsx`
- **Change**: 将接入弹窗文案改为通用的 remote/backend setup 语义，并把主操作改为 `Save and continue`。
- **Why**: 该弹窗已不再仅限移动端，也不再强制做连接探活。
- **Goal**: 统一 Web/Android 首屏接入体验并与新的保存即进入流程一致。
---
### [2026-03-14 21:27] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor`
- **Change**: 已运行 `npm run test -- src/services/browserRemote.test.ts src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.test.tsx src/features/mobile/hooks/useMobileServerSetup.test.ts src/features/app/hooks/useWorkspaceController.test.tsx` 与 `npm run typecheck`，两者通过。
- **Why**: 需要为本次远程接入门禁改造提供最小回归验证与类型安全证据。
- **Goal**: 确保首屏门禁、无效远程响应回退、轮询暂停与类型约束保持一致。
---
### [2026-03-14 21:41] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/services/browserRemote.ts`
- **Change**: 将 `401/403/unauthorized` 统一归类为远程接入配置错误，并新增按 `host+token` 签名的前端熔断：首次命中后同配置下短路后续 RPC 请求，直到用户重新保存远程设置。
- **Why**: 命令行探测显示 `codex-monitor-server.pklm.cloud/rpc` 可快速返回 `401 unauthorized`，说明服务可达；浏览器出现 `ERR_INSUFFICIENT_RESOURCES` 更像是前端在错误 token/缺 token 场景下持续堆积重复请求。
- **Goal**: 一旦鉴权失败，立即停止继续轰炸 `/rpc`，并强制用户回到接入弹窗修正地址或 token。
---
### [2026-03-14 21:41] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/mobile/hooks/useMobileServerSetup.ts`
- **Change**: 新增运行时 `runtimeSetupRequiredReason` 状态；当 workspace/usage 等链路通知远程接入失效时，保持门禁弹窗持续显示，直到用户重新保存配置。
- **Why**: 仅一次性弹窗无法阻止随后 effect 再次把应用误判为“已配置完成”，需要在运行时失败后维持门禁锁定。
- **Goal**: 让 unauthorized / 非 RPC 响应在运行中也能稳定回退到接入流程，而不是反复失败重试。
---
### [2026-03-14 21:41] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor`
- **Change**: 追加验证 `npm run test -- src/services/browserRemote.test.ts src/features/mobile/hooks/useMobileServerSetup.test.ts src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.test.tsx src/features/app/hooks/useWorkspaceController.test.tsx` 与 `npm run typecheck`，均通过。
- **Why**: 本轮修复引入了错误语义变更、门禁回退与请求熔断，需要重新确认行为和类型安全。
- **Goal**: 证明 unauthorized 归类、熔断、门禁保持和轮询暂停协同生效。
---
