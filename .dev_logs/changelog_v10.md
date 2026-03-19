State Summary (from `changelog_v9.md`):
- 已引入“系统通知强度”三档策略（high/medium/low），并将其贯穿到 turn 完成通知与 response-required 通知；移动端使用 `appStateChange` 增强前后台判定；相关单测已补齐且验证通过（typecheck/test/cargo check）。

### [2026-03-18 16:04] | Agent: Claude Code (Sonnet 4.6)
- **File**: `/.gitignore`
- **Change**: 在末尾新增 `.worktrees/` 忽略项。
- **Why**: 避免 Git 追踪本地 worktree 目录，保持仓库干净。
- **Goal**: 屏蔽临时 worktree 目录的版本控制干扰。
---

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

---
### [2026-03-19 11:58] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v10.md`
- **Change**: 将 manifest 的 Current Task 切换为“配置中新增前端自定义模型补全”，并在当前分片中追加该功能的实现与验证记录。
- **Why**: 按仓库约束在开始/完成新的代码任务时同步维护开发记忆，确保后续 Agent 读取到最新目标与上下文。
- **Goal**: 让当前活跃任务、设计范围与验证结论在 `/.dev_logs/` 中保持可追踪。

---
### [2026-03-19 11:58] | Agent: Codex (GPT-5)
- **File**: `src/types.ts`, `src/features/settings/hooks/useAppSettings.ts`, `src/features/settings/hooks/useAppSettings.test.ts`, `src-tauri/src/types.rs`, `src-tauri/src/storage.rs`
- **Change**: 为 `AppSettings` 新增 `customModelIds` 持久化字段；前后端默认值加入 `gpt-5.4`、`gpt-5.3-codex`；前端加载已保存设置时对该字段做归一化，并在远端响应缺少字段时显式保留空数组；补充前后端测试验证“默认预置存在”和“显式空数组不被默认值覆盖”。
- **Why**: 自定义模型补缺需要稳定的设置存储，同时必须兼容老用户已有 settings.json，避免在升级后无意把默认补缺模型写回到历史空配置。
- **Goal**: 提供兼容历史数据的 `customModelIds` 设置基座，作为前端模型补位与配置 UI 的单一数据源。

---
### [2026-03-19 11:58] | Agent: Codex (GPT-5)
- **File**: `src/features/models/utils/modelListResponse.ts`, `src/features/models/hooks/useModels.ts`, `src/features/models/hooks/useModels.test.tsx`, `src/features/settings/hooks/useSettingsDefaultModels.ts`, `src/features/settings/hooks/useSettingsDefaultModels.test.tsx`, `src/features/app/components/MainApp.tsx`, `src/features/settings/hooks/useSettingsCodexSection.ts`, `src/features/settings/hooks/useSettingsAgentsSection.ts`, `src/features/settings/hooks/useSettingsViewOrchestration.ts`
- **Change**: 抽取 `normalizeCustomModelIds` 与 `mergeModelOptionsWithFallbacks`，统一处理服务端模型、`config.toml` 模型和自定义 fallback 的补位合并；`useModels`、设置页默认模型源、Agents 模型源均接入 `customModelIds`；补充 `useModels` 与 `useSettingsDefaultModels` 的回归测试，并修复两个实现问题：用稳定空数组常量避免省略 `customModelIds` 时重复刷新，只对 provider 主模型排序后再追加 config/custom fallback，保证自定义模型始终位于补位尾部。
- **Why**: 该功能的核心契约是“服务端优先、配置次之、自定义最后、同名不重复”。在收尾验证时发现 `useSettingsDefaultModels` 的默认参数会造成重复请求，且整体排序会把 fallback 提前；这些都是功能性问题，必须一并修正。
- **Goal**: 让线程区、设置页和 Agents 配置看到一致的模型列表，同时严格遵守补位顺序与去重规则。

---
### [2026-03-19 11:58] | Agent: Codex (GPT-5)
- **File**: `src/features/settings/components/sections/SettingsCodexSection.tsx`, `src/features/settings/components/SettingsView.test.tsx`
- **Change**: 在 Settings 的 Codex 分区新增 `Custom model fallbacks` UI，支持新增、编辑、删除自定义 model id，新增重复校验与推荐提示文案；为设置页补充交互测试，覆盖新增、编辑、删除、重复阻止等行为。
- **Why**: 用户需要在前端配置中直接维护补缺模型，而不是依赖后端 `model/list` 或手工改文件；测试保证 UI 行为和持久化调用保持稳定。
- **Goal**: 提供可用的前端配置入口，让 `gpt-5.4`、`gpt-5.3-codex` 等模型可以被用户显式管理并参与模型选择补位。

---
### [2026-03-19 11:58] | Agent: Codex (GPT-5)
- **File**: `package.json`, `src-tauri/Cargo.toml`（验证）
- **Change**: 运行并确认验证：`npm run test -- src/features/settings/hooks/useSettingsDefaultModels.test.tsx`、`npm run test -- src/features/models/hooks/useModels.test.tsx`、`npm run test -- src/features/settings/hooks/useAppSettings.test.ts`、`npm run test -- src/features/settings/components/SettingsView.test.tsx`、`npm run typecheck`、`cargo check --manifest-path src-tauri/Cargo.toml`、`cargo test --manifest-path src-tauri/Cargo.toml read_settings_preserves_explicit_empty_custom_model_ids`；另外在问题定位阶段先跑定向失败用例，确认顺序错误与重复刷新回归后再修复。
- **Why**: 按仓库验证矩阵为前端状态/组件、类型和 Rust 设置持久化分别提供新鲜证据，避免把未验证状态误报为完成。
- **Goal**: 证明本次自定义模型补全实现可编译、目标测试通过，并且新增设置持久化逻辑在 Rust 侧保持兼容。

---
### [2026-03-19 12:11] | Agent: Codex (GPT-5)
- **File**: `src/features/models/hooks/useModels.ts`, `src/features/models/hooks/useModels.test.tsx`
- **Change**: 根据收尾审查补充修复 `useModels`：将 hook 内缓存从“已合并模型列表”改为“服务端原始模型列表”，再用 `useMemo` 基于 `configModel + customModelIds` 派生最终模型；新增回归测试验证设置里的 `customModelIds` 变化后，主 Composer 模型列表会立刻追加新的 fallback，且不会重复请求 `model/list`。
- **Why**: 原实现只在首次拉取模型时做一次合并，导致用户在 Settings 中新增 `gpt-5.4` / `gpt-5.3-codex` 后，主会话区的模型下拉不会即时更新，必须切换 workspace 才能看到，属于功能性回归。
- **Goal**: 保证设置页修改自定义补缺模型后，主界面模型选择链路立即与之同步，同时保持远端模型请求次数稳定。

---
### [2026-03-18 10:09] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v10.md`
- **Change**: 将 manifest 当前任务切换为“全局强制 Codex app-server 启用联网搜索”，并在当前分片记录本轮变更与验证结果。
- **Why**: 当前活跃工作已从 Workspace Home 交互修复切换为 Codex 搜索能力对齐，需要让项目日志反映最新目标与实施结果。
- **Goal**: 保持多轮协作下的任务上下文一致，便于后续继续定位远端搜索行为。

---
### [2026-03-18 10:09] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/backend/app_server.rs`
- **Change**: 新增 `app_server_command_args`，在启动 `codex app-server` 时检测现有参数是否已含 `--search`，缺失时自动补入；`spawn_workspace_session` 改为使用该专用参数构造逻辑，确保所有经 CodexMonitor 启动的 app-server 会话默认开启联网搜索且不会重复追加。
- **Why**: 安卓 HTTPS 远端与桌面/CLI 的差异根因在于 app-server 启动链路未强制传入搜索参数，导致远端会话默认无联网搜索能力。
- **Goal**: 统一本地与远端会话的搜索能力，让 CodexMonitor 启动出来的 Codex 一律可用联网搜索。

---
### [2026-03-18 10:09] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/backend/app_server.rs`
- **Change**: 增加 Rust 单测 `app_server_command_args_force_search_when_missing` 与 `app_server_command_args_do_not_duplicate_search`，覆盖“缺省自动补 `--search`”和“已有 `--search` 不重复追加”两个行为。
- **Why**: 需要把这次行为变更锁成可回归验证的契约，避免后续重构再次把远端搜索能力带丢。
- **Goal**: 为全局搜索默认开启提供最小而直接的后端回归保护。

---
### [2026-03-18 10:09] | Agent: Codex (GPT-5)
- **File**: `package.json`（验证）, `src-tauri/target`（验证环境）
- **Change**: 已运行 `npm run typecheck`，通过；已尝试运行 `cargo test app_server_command_args --manifest-path src-tauri/Cargo.toml`，但在 Rust 链接阶段因磁盘空间耗尽失败，错误为 `No space left on device (os error 28)`，当前根分区仅剩约 `214M`。
- **Why**: 按仓库验证要求执行 fresh verification，但当前机器磁盘状态不足以完成 Rust 产物链接，需如实记录验证阻塞原因。
- **Goal**: 提供真实的验证证据，区分“代码逻辑已改完”和“Rust 侧完整验证受环境阻塞”。

---
### [2026-03-18 10:15] | Agent: Codex (GPT-5)
- **File**: `src-tauri/target`（编译产物）
- **Change**: 运行 `cargo clean --manifest-path src-tauri/Cargo.toml` 清理 Rust 编译产物，删除约 `11.3GiB` 无效/可再生成文件；根分区可用空间从约 `214M` 恢复到约 `9.6G`。
- **Why**: 之前 Rust 测试在链接阶段被磁盘耗尽阻塞，必须先释放编译缓存空间，后续才能继续 `cargo test` / `cargo check`。
- **Goal**: 清除无效编译产物，恢复项目可验证和可构建状态。

---
### [2026-03-18 16:00] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `docs/plans/2026-03-18-custom-models-design.md`
- **Change**: 将 manifest 当前任务切换为“全局自定义模型前端设计与实现计划”，并新增自定义模型设计文档，明确 UI 放置位置、设置持久化位置、模型合并策略、推理强度处理和测试范围。
- **Why**: 用户确认要在前端补充全局自定义模型，需要先把约束和方案固化成文档，避免实现偏离已确认的交互边界。
- **Goal**: 为后续开发提供稳定的设计基线，确保“只填 model id、先选模型再选推理强度”的需求不走样。

---
### [2026-03-18 16:00] | Agent: Codex (GPT-5)
- **File**: `docs/plans/2026-03-18-custom-models.md`
- **Change**: 基于已确认设计新增实现计划文档，拆分为设置类型扩展、设置页 UI、模型合并逻辑、验证回归四个任务，并给出目标文件路径与测试命令。
- **Why**: 仓库要求多步实现先形成可执行计划，便于后续按任务推进并降低一次性改动过大的风险。
- **Goal**: 把自定义模型需求转换成可直接执行的工程任务清单。

---
### [2026-03-19 12:38] | Agent: Claude Code (Sonnet 4.6)
- **File**: `docs/plans/2026-03-19-daemon-release-build-design.md`
- **Change**: 新增 daemon 生产打包设计文档，明确 Linux x86_64 release 构建命令、产物路径、脚本约束与验证方式。
- **Why**: 固化用户确认的打包范围与约束，确保后续执行不偏离脚本路径与参数要求。
- **Goal**: 为 daemon 生产打包提供可追踪、可复用的设计基线。
