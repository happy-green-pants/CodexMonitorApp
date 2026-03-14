State Summary (from `changelog_v4.md`):
- 修复了 Web 远程模式下 `/rpc` 请求风暴（增加网络失败熔断、收敛首屏线程恢复等），并完成全量前端测试通过。
- 修复了 daemon `add_workspace` 因 data dir 落到 `/root/.local/share/...` 导致的 `Permission denied (os error 13)`：启动脚本增加 `--data-dir /home/www/.local/share/codex-monitor-daemon` 并验证生效。

# Changelog v5

---
### [2026-03-14 23:55] | Agent: CodeX
- **File**: `/.dev_logs/changelog_v5.md`
- **Change**: 创建新日志分片并记录上一分片最终状态摘要。
- **Why**: `changelog_v4.md` 已超过 100 行，按仓库规则需要分片。
- **Goal**: 为后续 Web 运行时崩溃修复保持可追踪的开发记忆。
---
### [2026-03-15 00:02] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/components/WorkspaceHome.tsx`
- **Change**: 在非 Tauri(Web) 运行时禁用 workspace 图标的 `convertFileSrc` 路径转换，并在 `iconSrc` 为空时不渲染 `<img>`。
- **Why**: Web 远程模式下 `@tauri-apps/api/core` 的 `convertFileSrc` 不可用，会抛 `Cannot read properties of undefined (reading 'convertFileSrc')` 导致白屏。
- **Goal**: 修复 Web 远程模式下选择 workspace 后的崩溃，保证页面可正常进入。
---
### [2026-03-15 00:02] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor/src/features/workspaces/components/WorkspaceHome.test.tsx`
- **Change**: 新增回归测试，断言非 Tauri 环境下渲染 `WorkspaceHome` 不会触发 `convertFileSrc` 调用并且不抛异常。
- **Why**: 该崩溃属于运行时环境差异问题，需要测试锁定防止回归。
- **Goal**: 保证 Web/移动 Web 预览等非 Tauri 环境下选择 workspace 稳定。
---
### [2026-03-15 00:02] | Agent: CodeX
- **File**: `/www/wwwroot/CodexMonitor`
- **Change**: 已运行 `npm run test -- src/features/workspaces/components/WorkspaceHome.test.tsx src/features/home/components/Home.test.tsx` 与 `npm run typecheck`，均通过。
- **Why**: 本轮变更影响 workspace 首页渲染路径，需做最小回归与类型检查。
- **Goal**: 证明修复生效且未引入 TS 类型回归。
