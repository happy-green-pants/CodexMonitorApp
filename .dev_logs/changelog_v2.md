---
### [2026-03-13 15:24] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src-tauri/src/bin/codex_monitor_daemon.rs`
- **Change**: 为 daemon 补齐缺失的 workspace/worktree/agents 配置相关方法（add/remove/rename/worktree setup、agents config、file read/write、settings 等），并复用 `workspaces_core` + `workspace_git` 的实现；新增 git/resolve_git_root 引用与闭包适配。
- **Why**: rpc/codex.rs 与 rpc/workspace.rs 引用了 daemon 缺失的接口，导致编译失败。
- **Goal**: 让 codex_monitor_daemon 在新增目录浏览 RPC 后能顺利编译。
---
### [2026-03-13 15:24] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src-tauri/src/bin/codex_monitor_daemon/rpc/workspace.rs`
- **Change**: 修复 `rename_worktree` 与 `add_worktree` 传参（将 branch/copy_agents_md 包装为 Option）以匹配 daemon 接口签名。
- **Why**: 解决 RPC 层与 daemon 方法签名不一致导致的编译错误。
- **Goal**: 保障 workspace RPC 能正确调用 daemon 的实现。
---
### [2026-03-13 18:36] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/services/tauri.ts`
- **Change**: 新增 `addWorkspaceFromGitUrl` 导出，封装 `invoke("add_workspace_from_git_url")` 并将 `targetFolderName` 规范化为 `null`（当未提供时）。
- **Why**: 修复前端运行时报错：`src/services/tauri.ts` 未导出 `addWorkspaceFromGitUrl`，导致 ESM 命名导入失败。
- **Goal**: 支持从远程 Git URL 克隆并添加 workspace（与后端命令保持一致）。
---
### [2026-03-13 18:36] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/services/tauri.test.ts`
- **Change**: 增加 `addWorkspaceFromGitUrl` 的参数映射测试，覆盖 `targetFolderName` 传值与省略（映射为 `null`）两种情况。
- **Why**: 防止后续重构中命令名或 payload 键名漂移导致调用失败。
- **Goal**: 保障 `add_workspace_from_git_url` 调用契约稳定可回归验证。
---
### [2026-03-14 15:47] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/app/hooks/useWorkspaceDialogs.ts`
- **Change**: 在 browser runtime + remote 模式下接入远程目录浏览流程：新增 `directoryBrowserPrompt` 状态与导航/确认/取消回调；`requestWorkspacePaths` 改为优先走目录浏览（并用 `isTauri()` 识别运行时）；目录列表拉取失败时不再调用 Tauri dialog，而是落到 prompt 的 `error` 状态；对 `showAddWorkspacesResult` 的弹窗提示增加 web fallback（Tauri dialog 不可用时使用 `window.alert`）。
- **Why**: Web 端添加项目不应要求手输绝对路径；同时避免在 browser runtime 调用 Tauri dialog 导致崩溃。
- **Goal**: Web 端添加项目时提供“选择远程目录”的交互，并确保远程不可达时可重试/可退出。
---
### [2026-03-14 15:47] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/app/hooks/useWorkspaceController.ts`
- **Change**: 将 `directoryBrowserPrompt` 及 `onDirectoryBrowserNavigate/onDirectoryBrowserConfirm/onDirectoryBrowserCancel` 透出到 controller 返回值，供上层 `MainApp`/`AppModals` 渲染与驱动。
- **Why**: 目录浏览 prompt 的状态需要从 dialogs hook 贯通到顶层 modal 渲染层。
- **Goal**: 打通“点击添加项目 → 弹出目录浏览器 → 选择目录 → 添加 workspace”的完整链路。
---
### [2026-03-14 15:47] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/app/components/MainApp.tsx`
- **Change**: 从 `useWorkspaceController()` 解构目录浏览 prompt 与 handlers，并透传给 `useMainAppModals({ workspacePrompts })`，确保 `AppModals` 能渲染 `DirectoryBrowserPrompt`。
- **Why**: 之前 Web 端虽有目录浏览能力，但未在主界面把状态传入 modal 渲染层，导致弹窗永远不显示。
- **Goal**: Web 端“Add Workspaces”直接弹出远程目录浏览器（单选）。
---
### [2026-03-14 15:47] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/app/components/AppModals.tsx`
- **Change**: 新增 `DirectoryBrowserPrompt` 的 lazy 加载与渲染分支；扩展 `AppModalsProps` 增加目录浏览 prompt/handlers。
- **Why**: 目录浏览器是 modal 组件，需要在统一的 modal 容器中挂载以保持 UI/体验一致。
- **Goal**: 让 Web 端远程目录选择 UI 真正可见且可交互。
---
### [2026-03-14 15:47] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/types.ts`
- **Change**: 将 `RemoteBackendProvider` 从仅 `"tcp"` 扩展为 `"tcp" | "http"`，与 browser remote HTTP provider 的现有实现保持一致。
- **Why**: 多处代码与测试已使用 `"http"` provider，类型不一致会导致 `npm run typecheck` 失败。
- **Goal**: 统一前端类型定义，保障 Web 远程模式相关逻辑可编译、可测试。
---
### [2026-03-14 15:47] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/services/tauri.ts`
- **Change**: 移除与 `src/types.ts` 冲突的本地 `DirectoryListingResponse`/`DirectoryEntry` 类型声明，统一复用 `types.ts` 的结构用于 `listDirectoryEntries()` 返回值。
- **Why**: 解决 TS2440：import 与本地声明同名导致冲突。
- **Goal**: 保持 RPC wrapper 类型单一来源，降低漂移风险。
---
### [2026-03-14 15:47] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/app/hooks/useWorkspaceController.test.tsx`
- **Change**: 新增“mobile web + remote 模式打开目录浏览器”的测试；同时 mock `isTauri()` 区分 Tauri mobile 与 browser runtime，确保移动端远程仍走手输 prompt、Web 端走目录浏览 prompt。
- **Why**: 防止运行时判定逻辑回归，确保两条分支按预期工作。
- **Goal**: 为 Web 目录选择交互提供可回归的单元测试覆盖。
---
### [2026-03-14 15:47] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/package.json`
- **Change**: 增加 `overrides.parse5 = 7.2.1`，并执行 `npm install` 更新 `package-lock.json` 以消除 Vitest/jsdom 运行时 `ERR_REQUIRE_ESM`（jsdom CJS require parse5 ESM）问题。
- **Why**: 现有依赖组合下 jsdom 无法加载 parse5@8（仅 ESM），导致 jsdom 环境测试出现大量 unhandled errors。
- **Goal**: 恢复 `npm run test` 可稳定运行，保障自动检查闭环。
---
### [2026-03-14 16:15] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/settings/components/SettingsView.test.tsx`
- **Change**: 更新测试以匹配新的 server section 文案/aria-label（`New remote endpoint`、`Remote endpoint`/`Remote token`），并在需要 desktop 控件的用例中设置 `globalThis.isTauri = true` 以模拟 Tauri 运行时；替换掉过时的 iOS 提示文案断言。
- **Why**: `useSettingsServerSection` 通过 `isTauri()` 控制 desktop 控件显示；且 UI 文案/label 已调整，原测试断言失效。
- **Goal**: 让全量 `npm run test` 回归通过，确保本次 Web 目录选择功能变更的 CI 闭环可用。
---
### [2026-03-14 16:15] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/app/hooks/useWorkspaceDialogs.ts`
- **Change**: 为 browser runtime 增加对 Tauri dialog 的安全降级：删除/确认等场景在 `@tauri-apps/plugin-dialog` 不可用时 fallback 到 `window.confirm/window.alert`，避免 Web 端调用插件导致异常。
- **Why**: Web 运行时不具备 Tauri dialog bridge，直接调用会抛错并破坏交互。
- **Goal**: Web 端远程模式下，新增/删除 workspace 等流程都能稳定提示与继续操作。
---
