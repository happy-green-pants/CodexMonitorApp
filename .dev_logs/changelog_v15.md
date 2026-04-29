---
State Summary (from `changelog_v14.md`):
- Web 文件编辑、Linux daemon 打包，以及默认模型候选修复已在前序分片记录。
- 当前工作树仍存在与本次任务无关的前端类型错误，主要集中在 `GitDiffPanel`、`useGitStatus` 测试和 `appServerEvents` 类型收窄。
- Web 端 Sentry 默认硬编码 DSN 会触发共享配额告警，本分片开始记录该问题的修复。

# Changelog v15

---
### [2026-04-28 00:20] | Agent: Codex (GPT-5)
- **File**: `/src/main.test.tsx`
- **Change**: 先按 TDD 调整启动测试，补充“未配置 `VITE_SENTRY_DSN` 时不得初始化 Sentry 或发送 `app_open` metric”与“显式配置 DSN 时才允许初始化和上报”的双分支断言，并在测试初始化阶段清理 env stub。
- **Why**: 当前 Web 控制台提示来自 Sentry 配额或内部限流，修复前需要先锁定默认禁用、显式启用的期望行为，避免实现阶段继续依赖硬编码 DSN。
- **Goal**: 用失败测试固定 Web 监控启动边界，确保后续实现能直接证明这条 Sentry 告警不会再被默认触发。
---
### [2026-04-28 00:21] | Agent: Codex (GPT-5)
- **File**: `/src/main.tsx`
- **Change**: 移除前端启动流程中的默认硬编码 Sentry DSN，仅在 `VITE_SENTRY_DSN` 显式存在且非空时才初始化 Sentry 并发送 `app_open` metric；同时补充注释说明这是为了避免共享配额告警直接暴露给 Web 终端用户。
- **Why**: 根因是 Web 版默认启用了共享 Sentry DSN，启动即发送 metrics，配额耗尽后 SDK 会在浏览器控制台输出 dropped data / rate limit 告警，造成用户误判为应用故障。
- **Goal**: 将 Web 监控改为显式配置才启用，消除默认访问时的 Sentry 配额提示，同时保留需要时的可配置异常上报能力。
---
### [2026-04-28 00:29] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/target`, `/node_modules/.vite`, `/.dev_logs/changelog_v15.md`
- **Change**: 按用户要求停止刚触发的 Rust 编译/测试进程，先把现有 `src-tauri/target/release/codex_monitor_daemon` 备份到临时目录，再删除 `src-tauri/target` 与 `node_modules/.vite` 的可重建产物，最后仅恢复 daemon 二进制到原路径并确认保留成功。
- **Why**: 当前服务器磁盘空间紧张，继续保留刚生成的 Rust 调试构建会显著占用存储；但用户明确要求清理时保留后端服务，因此不能直接整体删除 `target` 后不做恢复。
- **Goal**: 在不保留本轮编译垃圾的前提下回收磁盘空间，并继续保有可用的后端服务二进制供现有部署使用。
---
### [2026-04-28 00:31] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/backend/app_server.rs`, `/.dev_logs/manifest.md`
- **Change**: 修复 Codex CLI 路径探测误判：在 Unix 平台的 `build_codex_path_env()` 中补充 `/usr/local/node/bin`，并新增定向测试 `build_codex_path_env_adds_usr_local_node_bin_on_unix` 锁定该目录会被注入到运行时 PATH。
- **Why**: 当前服务器上的 `codex` 实际安装在 `/usr/local/node/bin/codex`，而后端运行时 PATH 补全白名单此前遗漏这个目录，导致应用进程即便系统已安装 Codex 也会误报 “Codex CLI not found”。
- **Goal**: 让 CodexMonitor 的 app/daemon 运行进程在当前服务器环境下稳定找到 `codex`，消除 PATH 继承差异引起的误判。
---
### [2026-04-28 01:09] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/backend/app_server.rs`, `/src-tauri/target/release/codex_monitor_daemon`
- **Change**: 先执行 `cargo check --manifest-path src-tauri/Cargo.toml --bin codex_monitor_daemon` 做单目标前置校验，再运行 `cargo build --release --manifest-path src-tauri/Cargo.toml --bin codex_monitor_daemon` 仅编译当前服务器可用的 Linux x86_64 daemon；构建后用 `src-tauri/target/release/codex_monitor_daemon --help` 做最小运行验证，并立即清空 `src-tauri/target` 的中间产物后仅恢复 release 二进制。
- **Why**: 用户要求修好 PATH 问题后只为当前服务器产出一个可用后端服务，且服务器存储空间紧张，不能保留完整 Rust 构建缓存。
- **Goal**: 交付与当前代码一致、在本机可执行、且不伴随大体积构建垃圾的 `codex_monitor_daemon` 二进制。
---
### [2026-04-29 15:42] | Agent: Codex (GPT-5)
- **File**: `/src-tauri/src/bin/codex_monitor_daemonctl.rs`
- **Change**: 为 daemon 启动路径新增 `build_daemon_launch_env()`，在拉起 `codex_monitor_daemon` 前显式注入 `HOME`、`CODEX_HOME` 和包含 `/usr/local/node/bin` 的 `PATH`；同时补充两条定向单元测试，锁定“缺省落到 `/root/.codex`”与“保留现有 `CODEX_HOME` 且始终补齐 Node PATH”的行为，并用注释说明这一步是为让 daemon 与 CLI 看到同一套 Codex/Gemini MCP 环境。
- **Why**: 根因排查显示当前运行中的 daemon 进程环境缺少 `HOME/CODEX_HOME`，且 `PATH` 不含 `/usr/local/node/bin`，导致项目内 `codex app-server` 侧无法稳定读取与 CLI 相同的 `~/.codex/config.toml` 和 Gemini MCP 依赖。
- **Goal**: 让 CodexMonitor 在不依赖外部 shell/session 环境的前提下，稳定继承与 CLI 一致的 Codex 配置与可执行路径，从而恢复 Gemini MCP 可见性。
---
### [2026-04-29 15:54] | Agent: Codex (GPT-5)
- **File**: `/package.json`, `/package-lock.json`, `/src-tauri/Cargo.toml`, `/src-tauri/Cargo.lock`, `/src-tauri/tauri.conf.json`, `/android/app/build.gradle`
- **Change**: 在发布分支 `release/v1.0.3` 上将应用版本从 `1.0.2` 统一推进到 `1.0.3`，并把 Android `versionCode` 从 `7` 递增到 `8`，确保 GitHub Release / APK 构建链路与新版本号对齐。
- **Why**: 用户要求新建分支并在原有版本基础上推进 `0.0.1`；当前基线版本是 `1.0.2`，因此本轮发布版本应为 `1.0.3`，且 Android 必须保持单调递增的安装升级序列。
- **Goal**: 为后续推送到 GitHub、触发远程编译打包和发布 `v1.0.3` 做好版本元数据准备。
---
### [2026-04-29 18:07] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/src/features/git/components/GitDiffPanel.test.tsx`, `/src/features/git/hooks/useGitStatus.test.tsx`, `/src/utils/appServerEvents.ts`
- **Change**: 在项目记忆中新增“所有编译、验证、打包统一走 GitHub Actions，产物再从 GitHub 下载回本地”的执行约定；同时根据 `v1.0.3` 远程构建日志修复三组前端类型错误：移除 `GitDiffPanel` 测试中已删除的 `deferredDiffsNotice` 断言、把 `useGitStatus` 测试对齐为当前单参数 hook 签名并改写轮询预期、修正 `normalizeRequestUserInputQuestions()` 对 `isOther` 的可选字段收窄，避免把 `null` 混入 `RequestUserInputQuestion[]`。
- **Why**: `Release` workflow 的 `npm run build` 在 GitHub 远程环境中因这三组类型漂移直接失败，阻断了 APK 与 Release 资产生成；同时用户要求把后续所有验证/打包职责统一迁移到 GitHub，避免本地继续承担编译压力。
- **Goal**: 固化新的远程构建约束，并消除当前阻断 `v1.0.3` GitHub 打包的 TypeScript 编译错误。
---
### [2026-04-29 18:12] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`
- **Change**: 在项目记忆中补充“GitHub 产物回收只下载最终交付件，不回收无关日志包、临时 artifacts 或中间产物”的约定，明确本地只保留 APK、daemon 二进制等关键产物。
- **Why**: 用户要求远程构建完成后仅下载关键二进制交付件，避免把非交付 artifacts 拉回本地占用空间或污染工作目录。
- **Goal**: 让后续 GitHub 发布闭环默认只回收必要最终产物，符合当前机器磁盘与交付边界要求。
---
### [2026-04-29 18:12] | Agent: Codex (GPT-5)
- **File**: `/AGENTS.md`
- **Change**: 在仓库级执行约束中新增两条规则：默认将编译、验证、打包、发布工作交给 GitHub Actions / GitHub Release，而不是本地执行；并规定从 GitHub 回收产物时只下载 APK、daemon 二进制等最终交付件，不回收无关日志和临时 artifacts。
- **Why**: 用户要求这条约定不仅保存在开发记忆里，也要进入仓库的长期协作契约，确保后续任何代理都不会默认走本地编译或把无关产物拉回本机。
- **Goal**: 将远程构建与精简产物回收策略固化为项目级默认规则，减少本地磁盘占用并统一后续发布流程。
---
### [2026-04-29 18:20] | Agent: Codex (GPT-5)
- **File**: `/src/utils/appServerEvents.ts`
- **Change**: 将 `normalizeRequestUserInputQuestions()` 从 `map + filter` 改为显式循环和结果数组累积，按需写入可选的 `isOther` 字段，避免 TypeScript 把中间对象推断成“属性必有但值可为 undefined”的形态。
- **Why**: 第二轮 `v1.0.3` 远程构建显示其余类型错误已消失，只剩这一处因谓词收窄与可选属性形状不一致而阻断 `tsc`，需要用更直接的构造方式消除推断歧义。
- **Goal**: 清掉当前 `build frontend` 的最后一组 TypeScript 错误，让 GitHub Release workflow 能继续进入 APK 构建与发布阶段。
---
### [2026-04-29 18:52] | Agent: Codex (GPT-5)
- **File**: `/.github/workflows/release-daemon-binaries.yml`, `/docs/build/github-release-runbook.md`, `/AGENTS.md`, `/.dev_logs/manifest.md`
- **Change**: 将 daemon GitHub workflow 的 Linux runner 从 `ubuntu-24.04*` 下调到 `ubuntu-22.04*` 以压低 glibc 运行时基线，并在 release 上传阶段按 target 显式映射为 `codex_monitor_daemon-linux-x86_64`、`codex_monitor_daemon-linux-aarch64`、`codex_monitor_daemon-macos-x86_64`、`codex_monitor_daemon-macos-aarch64`、`codex_monitor_daemon-windows-x86_64.exe` 等全平台资产名；同时把默认发布策略更新为“Android APK + 全平台 daemon”。
- **Why**: 实测从 `v1.0.3` Release 下载的 Linux daemon 虽然哈希正确，但在当前服务器上因要求 `GLIBC_2.39` 而无法启动；根因是 Linux runner 基线过新且 Release 资产命名不统一，不利于跨平台交付与回收。
- **Goal**: 让 GitHub 默认发布链路稳定产出可识别、可回收、对常见 Linux 服务器更兼容的全平台 daemon 二进制，并保持 APK 发布流程不受桌面/daemon 侧复杂度拖累。
---
### [2026-04-29 19:20] | Agent: Codex (GPT-5)
- **File**: `/.github/workflows/release-daemon-binaries.yml`
- **Change**: 在 Linux daemon workflow 中新增 `Reset Linux host build cache` 步骤，在执行 `cargo build` 前删除 `src-tauri/target/release` 与当前 target 的 `release/build` 目录，强制重建 host 侧 build-script。
- **Why**: 失败日志表明 `rust-cache` 还原的 `whisper-rs-sys` build-script 仍然链接到了更高版本的 glibc，迁移到 `ubuntu-22.04` 后一启动就因为 `GLIBC_2.39` 缺失而崩溃；仅更换 runner 不足以消除这类跨镜像缓存污染。
- **Goal**: 让 Linux daemon 在较低 glibc 基线 runner 上从干净的 host 构建脚本重新编译，避免缓存产物继续把旧 ABI 问题带回流程中。
