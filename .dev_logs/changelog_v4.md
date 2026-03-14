# Changelog v4

State Summary:
- `changelog_v3.md` 已完成 Web/Android 远程接入门禁、无效 RPC 响应回退与目录浏览交互接入。
- 当前聚焦修复 Web 首页启动后持续请求 `/rpc`、页面常驻加载，以及远程恢复链的请求放大问题。

---
### [2026-03-14 22:19] | Agent: CodeX
- **File**: `/.dev_logs/manifest.md`
- **Change**: 将活跃日志分片切换到 `changelog_v4.md`，并把当前任务更新为 Web 远程首页请求风暴修复。
- **Why**: `changelog_v3.md` 已超过 100 行，按仓库规则必须创建新分片继续记录。
- **Goal**: 为本轮首页远程请求收敛修复建立新的开发记忆入口。
---
### [2026-03-14 22:19] | Agent: CodeX
- **File**: `/.dev_logs/changelog_v4.md`
- **Change**: 创建新日志分片并写入上一分片状态摘要与当前任务起点。
- **Why**: 需要在任何新的代码修改前，保证开发日志分片与任务上下文同步。
- **Goal**: 连续追踪首页 `/rpc` 风暴修复的测试、实现与验证过程。
---
### [2026-03-14 22:20] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/home/hooks/useLocalUsage.test.ts`
- **Change**: 新增首页 usage 回归测试，约束 `useLocalUsage` 在仅发生 rerender、但参数语义未变时，不会立即重复触发 `localUsageSnapshot`。
- **Why**: 首页在 Web 远程模式下会挂载 usage 拉取；若 hook 因不稳定依赖在每次 render 后重跑，会直接放大 `/rpc` 请求量。
- **Goal**: 用测试锁定首页 usage 不得退化成按重渲染频率请求远端。
---
### [2026-03-14 22:20] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/hooks/useWorkspaceRestore.test.tsx`
- **Change**: 新增首屏 workspace 恢复回归测试，要求同一 workspace 在 rerender 后不会重复执行初始化恢复。
- **Why**: 启动阶段的 `connect + listThreadsForWorkspaces` 是本次请求风暴的另一条放大链，需要先锁住幂等行为。
- **Goal**: 防止首页重新渲染时重复恢复同一批 workspace。
---
### [2026-03-14 22:20] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/services/browserRemote.test.ts`
- **Change**: 新增网络失败回归测试，要求同一远程配置首次不可达后短时间内直接短路后续 RPC，而不是重复打 `/rpc`。
- **Why**: 现有浏览器远程熔断只覆盖 HTML/401，普通网络失败仍会在前端多条自动链路下持续重试。
- **Goal**: 锁定“不可达时短期熔断”行为，避免浏览器对服务端形成请求风暴。
---
### [2026-03-14 22:20] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/threads/hooks/useThreadActions.test.tsx`
- **Change**: 为多 workspace 线程恢复补充断言，要求 `listThreadsForWorkspaces(...)` 不再额外调用 `listWorkspaces()`。
- **Why**: 首屏恢复已经拿到目标 workspace 列表，再额外查一次 workspace 只会放大请求量。
- **Goal**: 把多 workspace 的线程恢复压缩为单次 `list_threads` 请求。
---
### [2026-03-14 22:24] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/home/hooks/useLocalUsage.ts`
- **Change**: 将 `onRemoteSetupRequired` 收入 ref，并移除对整个 `options` 对象的 callback 依赖，避免仅因 render 产生的新对象触发 usage 刷新函数重建。
- **Why**: 首页默认会在 `showHome` 场景挂载 usage 拉取；不稳定依赖会把本应低频的远程调用放大到接近每次重渲染一次。
- **Goal**: 收敛首页 usage 对 `/rpc` 的请求频率，消除由 React 依赖抖动造成的请求风暴。
---
### [2026-03-14 22:24] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/services/browserRemote.ts`
- **Change**: 为浏览器远程的网络不可达错误增加按远程签名的短时熔断（5 秒），在同一配置下直接复用首次错误并阻断重复 fetch。
- **Why**: 当前只有无效响应/401 会阻断，网络失败时多个自动刷新链路仍会同时轰炸 `/rpc`。
- **Goal**: 在远端不可达时快速止损，避免浏览器在失败窗口内持续堆积请求。
---
### [2026-03-14 22:24] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/hooks/useWorkspaceRestore.ts`
- **Change**: 将首屏线程恢复的 `maxPages` 从 6 降到 1，并把当前已知 `workspaces` 显式传给后续线程恢复逻辑。
- **Why**: 首页只需要首批线程摘要，不需要在初始恢复阶段深翻分页；同时避免后续再发额外的 workspace 列表请求。
- **Goal**: 降低启动阶段线程恢复对 `/rpc` 的放大倍数，并把恢复请求压缩到首批必要数据。
---
### [2026-03-14 22:24] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/threads/hooks/useThreadActions.ts`
- **Change**: 为 `listThreadsForWorkspaces` 增加 `allWorkspaces` 可选参数；多 workspace 恢复时直接复用调用方已知列表构建路径映射，仅在单 workspace 需要判别嵌套路径时才回退调用 `listWorkspaces()`。
- **Why**: 首屏恢复场景下再查一次 workspace 列表没有收益，只会增加额外 `/rpc`；但单 workspace 嵌套判别仍需要保留原有安全行为。
- **Goal**: 在不破坏嵌套 workspace 判别的前提下，消除多 workspace 首屏恢复的冗余 RPC。
---
### [2026-03-14 22:24] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.ts`
- **Change**: 在 focus/polling 刷新时把 `latestWorkspaces` 一并传入线程恢复，避免刷新后再次请求 workspace 列表。
- **Why**: 刷新链路已经拿到了最新 workspace 列表，应直接复用，避免无意义的二次远程查询。
- **Goal**: 让远程 workspace 刷新与线程恢复共享同一份最新列表，进一步收敛自动请求。
---
### [2026-03-14 22:25] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.test.tsx`
- **Change**: 更新 focus 刷新测试断言，要求传入 `allWorkspaces`，与新的共享列表恢复行为保持一致。
- **Why**: 线程恢复接口签名已扩展，用例需要同步验证实际的参数传递。
- **Goal**: 保证 focus 刷新链路复用最新 workspace 列表的行为受测试保护。
---
### [2026-03-14 22:26] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor`
- **Change**: 已运行 `npm run test -- src/features/home/hooks/useLocalUsage.test.ts src/features/workspaces/hooks/useWorkspaceRestore.test.tsx src/services/browserRemote.test.ts src/features/threads/hooks/useThreadActions.test.tsx src/features/workspaces/hooks/useWorkspaceRefreshOnFocus.test.tsx` 与 `npm run typecheck`，均通过。
- **Why**: 本轮修复改动了首页 usage、浏览器远程 transport 与首屏线程恢复链路，必须用最小回归集和类型检查共同验证。
- **Goal**: 证明请求风暴修复在目标链路上有效，并且没有引入新的类型回归。
---
### [2026-03-14 23:16] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/scripts/start_codex_monitor_daemon.sh`
- **Change**: 为 daemon 启动命令增加 `--data-dir /home/www/.local/share/codex-monitor-daemon`，避免默认数据目录落到 `/root/.local/share`。
- **Why**: 当前 daemon 以 `www` 用户运行，但进程环境变量 `HOME=/root`，导致默认 data dir 指向 root 目录，写入 `workspaces.json` 会触发 `Permission denied (os error 13)`。
- **Goal**: 让 `add_workspace` 能稳定持久化写入 workspace 列表，修复 Web “添加项目”失败。
---
### [2026-03-14 23:16] | Agent: CodeX
- **File**: `/home/www/.local/share/codex-monitor-daemon`
- **Change**: 创建并授权 daemon 数据目录为 `www:www`，用于持久化 `workspaces.json/settings.json`。
- **Why**: `www` 需要对 data dir 有写权限，否则 RPC `add_workspace` 只能返回权限错误。
- **Goal**: 为 Web 端添加 workspace 提供可写的持久化存储位置。
---
### [2026-03-14 23:16] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor`
- **Change**: 重启 `codex_monitor_daemon` 并验证其打印 `data dir: /home/www/.local/share/codex-monitor-daemon`；通过本地 RPC 调用验证 `add_workspace(/www/wwwroot/shanyu)` 成功并生成 `workspaces.json`。
- **Why**: 需要用服务端证据确认权限问题已修复，而不是仅调整前端提示。
- **Goal**: 确保 UI 选择目录后能真正完成 workspace 添加与持久化。
