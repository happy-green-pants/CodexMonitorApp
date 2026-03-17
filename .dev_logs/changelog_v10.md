State Summary (from `changelog_v9.md`):
- 已引入“系统通知强度”三档策略（high/medium/low），并将其贯穿到 turn 完成通知与 response-required 通知；移动端使用 `appStateChange` 增强前后台判定；相关单测已补齐且验证通过（typecheck/test/cargo check）。

# Changelog v10

---
### [2026-03-17 10:36] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v10.md`
- **Change**: 因 `changelog_v9.md` 接近 100 行且本次将新增多条记录，创建新的分片 `changelog_v10.md` 并将 manifest 的 Current 指向 v10；更新 manifest 的 Current Task 为“Workspace Home 发送误切旧会话”。
- **Why**: 按仓库日志分片规则控制单分片规模，并保持 manifest 的任务描述为“当前活跃任务”。
- **Goal**: 让后续 bug 修复记录可持续维护且不超出分片容量。

---
### [2026-03-17 10:36] | Agent: Codex (GPT-5)
- **File**: `src/features/workspaces/hooks/useWorkspaceHome.ts`
- **Change**: 将 Workspace Home 的 Local run 在创建 thread 时改为 `startThreadForWorkspace(..., { activate: true })`。
- **Why**: 让“发起新对话”的语义与交互一致：无论点击 Send 还是回车，都应进入刚创建的新 thread；同时减少因误点/布局变化导致切到旧 thread 的概率。
- **Goal**: 修复点击发送按钮后误加载最新旧会话的问题，并统一键盘/按钮发送行为。

---
### [2026-03-17 10:36] | Agent: Codex (GPT-5)
- **File**: `src/features/composer/components/ComposerInput.tsx`
- **Change**: 为 mic/send 按钮补齐 `type="button"`；在 send/stop 主按钮增加 `onPointerDown`/`onMouseDown` 的 `preventDefault + stopPropagation`，并 best-effort 使用 `setPointerCapture`。
- **Why**: 移动端点击发送时易因 textarea 失焦/viewport 变化触发“幽灵点击”落到下方列表导致切到旧 thread；通过阻止按钮抢焦点并捕获 pointer，可降低误点概率且不改变实际发送逻辑（仍由 `onClick` 驱动）。
- **Goal**: 让点击 Send 与回车发送在交互上稳定一致，不再误加载最新旧会话。

---
### [2026-03-17 10:36] | Agent: Codex (GPT-5)
- **File**: `src/features/workspaces/hooks/useWorkspaceHome.test.tsx`, `src/features/composer/components/ComposerSend.test.tsx`
- **Change**: 新增/更新单测：local run 断言 `startThreadForWorkspace(..., { activate: true })`；send-button 测试增加 `pointerDown` 以覆盖新的 pointer 处理且仍确保只发送一次。
- **Why**: 防止回归：确保 Workspace Home 的“发起新对话=进入新 thread”契约被锁定，同时避免 pointerdown 处理引入双发。
- **Goal**: 用自动化测试覆盖本次修复的两个关键点（thread 激活 + 发送按钮交互稳定性）。

---
### [2026-03-17 12:27] | Agent: Codex (GPT-5)
- **File**: `package.json`（验证）
- **Change**: 运行验证：`npm run typecheck`、`npm run test`；均通过（测试存在既有 stderr 提示但无失败）。
- **Why**: 按验证矩阵闭环，确保交互修复与线程激活行为不会引入类型/单测回归。
- **Goal**: 提供可编译、测试通过的稳定修复。

---
### [2026-03-17 15:40] | Agent: Codex (GPT-5)
- **File**: `src/features/workspaces/hooks/useWorkspaceHome.ts`, `src/features/app/components/MainApp.tsx`, `src/features/app/hooks/useMainAppComposerWorkspaceState.ts`
- **Change**: 为 Workspace Home Local run 增加“发送后自动 refresh 新 thread”的补齐逻辑：在 `sendUserMessageToThread` 后调用 `refreshThread(workspaceId, threadId)`（并追加一次短延迟重试），同时在编排层将 `refreshThread` 透传给 `useWorkspaceHome`。
- **Why**: 修复“点击发送按钮进入新 thread 后聊天空白，需要手动点右上角刷新才能显示”的问题：当新 thread 切换发生时，事件流/快照水合可能尚未到位，主动 refresh 可稳定拉取并渲染消息。
- **Goal**: 让点击 Send 后进入的新对话能立即显示内容，无需手动刷新。
