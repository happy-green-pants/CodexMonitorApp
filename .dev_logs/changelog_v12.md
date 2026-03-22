State Summary (from `changelog_v11.md`):
- 已补齐主 `release.yml` 的 Linux app bundle 基础依赖，修复 `glib-sys` 因 `glib-2.0.pc` 缺失导致的 Ubuntu release 构建失败。
- `release-daemon-binaries.yml` 仍存在 Linux daemon 发布问题：x86_64 继承 `src-tauri` 的 Tauri/GTK/WebKit 依赖链但未安装完整系统库，aarch64 在 `ubuntu-latest` 上交叉编译时又触发 `pkg-config` cross-compilation 配置失败。
- 已有共享 `git_runtime` 修复 Git ownership / `safe.directory` 问题，app 与 daemon 均在启动早期接入该运行时。
- Git CLI / `gh` / libgit2 访问已统一走受控 Git 运行时，避免打包后跨 owner 仓库在 Git 面板直接失败。
- 通知细分、通知跳转与模型默认记忆修复，以及 Git/Files 移动端预览浮层适配，均已在上一分片完成并验证。

# Changelog v12

---
### [2026-03-21 10:32] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v12.md`
- **Change**: 因 `changelog_v11.md` 已接近 100 行上限，创建新分片 `changelog_v12.md`，并将 manifest 的 Active Changelog / Current Task 切换到 daemon Linux 发布构建修复。
- **Why**: 按仓库日志分片规则控制开发记忆规模，并让后续 Agent 读取到当前真实焦点与最新上下文。
- **Goal**: 为本轮 `release-daemon-binaries` Linux 修复提供独立、可追踪的开发记录。
---
### [2026-03-21 10:35] | Agent: Codex (GPT-5)
- **File**: `.github/workflows/release-daemon-binaries.yml`
- **Change**: 将 Linux daemon 发布矩阵从 `ubuntu-latest` 调整为原生 runner：`x86_64-unknown-linux-gnu` 使用 `ubuntu-24.04`，`aarch64-unknown-linux-gnu` 使用 `ubuntu-24.04-arm`；同时把 Linux 依赖安装扩展为 `pkg-config`、`libglib2.0-dev`、`libwebkit2gtk-4.1-dev`、`libgtk-3-dev`、`libayatana-appindicator3-dev`、`librsvg2-dev`、`libasound2-dev`。
- **Why**: daemon 仍与 `src-tauri` 共用 Tauri 包级依赖链，Linux 构建需要与桌面 app 类似的 GTK/WebKit 系统库；而 `aarch64` 在 `ubuntu-latest` 上交叉编译时会因 `pkg-config` 未配置 cross sysroot 直接失败，切换到原生 ARM runner 是最小且更稳的修复。
- **Goal**: 恢复 daemon Linux x86_64 / aarch64 发布任务，避免再次出现 `glib-sys` 缺依赖或 `pkg-config has not been configured to support cross-compilation`。
---
### [2026-03-21 10:36] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v12.md`, `.github/workflows/release-daemon-binaries.yml`
- **Change**: 运行静态验证：先用 `git diff --check` 检查改动，发现文件为 `CRLF` 导致的尾随空白噪声；随后统一转换为 `LF`，为最终交付恢复干净 diff 基线。
- **Why**: 若不先消除行尾格式噪声，CI 修复本身会被 diff 质量问题掩盖，且不利于后续 review 聚焦有效变更。
- **Goal**: 确保本次 workflow 修复具备可审查、可提交的最小差异形态。
---
### [2026-03-21 11:02] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `.github/workflows/release.yml`
- **Change**: 将 manifest 当前任务切换为 Android APK 发布接入；在统一 `release.yml` 中新增 `build_android` job，使用 Node 22、JDK 21、Android SDK 运行 `npm run build`、`npx --yes @capacitor/cli@8.2.0 sync android`、`./gradlew assembleRelease`，并将 release APK 重命名为 `CodexMonitor_<version>_android.apk` 后上传为 workflow artifact。
- **Why**: 仓库已具备 Capacitor Android 工程与 release keystore，本次需求是将现有开源 APK 打包流程并入 GitHub Actions，而不是新增上架或 AAB 分发链路。
- **Goal**: 让桌面端与 Android APK 在同一条 `release.yml` 中统一构建，减少手工打包与单独上传步骤。
---
### [2026-03-21 11:02] | Agent: Codex (GPT-5)
- **File**: `.github/workflows/release.yml`
- **Change**: 在 `release` job 中新增 Android artifact 下载与校验逻辑，并将 `*_android.apk` 一并附加到 `gh release create` 上传列表。
- **Why**: 仅构建 APK 不足以完成开源发布；必须将 Android 产物接入现有 release 聚合步骤，才能和 macOS/Linux/Windows 安装包一起出现在 GitHub Release 页面。
- **Goal**: 让每次统一发布都自动携带可直接下载安装的 Android release APK。
---
### [2026-03-21 22:33] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/changelog_v12.md`, `/.dev_logs/manifest.md`, `src-tauri/src/shared/git_runtime.rs`
- **Change**: 将 manifest 当前任务切换为“远程 Git 继承系统全局身份修复”；重写 `git_runtime` 的 app-managed Git 配置生成逻辑：全局 `.gitconfig` 通过 `include.path` 继承系统 `~/.gitconfig` 与系统 XDG Git config，app-managed XDG config 仅保留 `safe.directory = *`，避免重复加载系统 XDG 配置；Git 子进程注入 `GIT_CONFIG_GLOBAL` 时同步设置 `XDG_CONFIG_HOME` 指向 app-managed `.config`。
- **Why**: 之前的 app-managed 全局配置只有 `safe.directory = *`，会在远程 daemon / APP 执行 `git commit` 等命令时屏蔽服务端系统用户原本的 `user.name` / `user.email`，导致移动端远程 Git 操作提示缺少身份信息。
- **Goal**: 在不回退既有 ownership/safe.directory 修复的前提下，让远程 Git 继续继承服务端已经配置好的全局用户名、邮箱和 XDG Git 配置。
---
### [2026-03-21 22:33] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/shared/git_runtime.rs`, `src-tauri/Cargo.toml`（验证）
- **Change**: 先补 Rust 回归测试并按 TDD 经历失败到通过：新增 app-managed 配置包含系统 Git config include、Git 子进程注入 `XDG_CONFIG_HOME`、在临时 repo 中仍可读取系统 `user.name` / `user.email` 的测试；随后运行 `cargo test --manifest-path src-tauri/Cargo.toml shared::git_runtime::tests:: -- --nocapture` 与 `cargo check --manifest-path src-tauri/Cargo.toml`，均通过（存在仓库既有 warning，无新增 error）。
- **Why**: 该问题属于 Git 配置解析顺序与运行时环境注入的组合回归，必须用自动化测试锁定“继承身份 + 保留 safe.directory”的契约，并提供 fresh verification evidence。
- **Goal**: 证明远程 Git 身份修复已在 Rust 单测和编译层面闭环，避免未来再次退化成“缺少 user.name / user.email”。
---
### [2026-03-21 23:06] | Agent: Codex (GPT-5)
- **File**: `src-tauri/src/shared/git_runtime.rs`
- **Change**: 根据代码审查再次收敛 Git runtime：去掉 app-managed XDG 对系统 XDG 配置的重复 include，只保留 app-managed global 对系统 XDG + `~/.gitconfig` 的一次性继承，并新增“global 同键优先于 XDG”“XDG 独有邮箱仍可读到”的回归测试。
- **Why**: 若系统 XDG 配置在 global include 与 app-managed XDG 中被重复加载，会改变 Git 原生优先级，让 `user.name`/`credential.helper` 等同键被 XDG 值错误覆盖。
- **Goal**: 既恢复远程 Git 身份继承，又严格保持服务端现有 Git 配置的原生优先级与行为。
---
### [2026-03-22 12:23] | Agent: Codex (GPT-5)
- **File**: `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v12.md`, `.github/workflows/release.yml`, `.github/workflows/release-daemon-binaries.yml`, `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `android/app/build.gradle`
- **Change**: 将当前任务切换为 `v1.0.1` 发版；把 `Release` 工作流从仅手动触发改为支持 `v*` tag 自动触发，修复 `latest.json` 和 updater 仍指向上游 `Dimillian/CodexMonitor` 的错误仓库地址，并将 release 上传逻辑改为“Release 已存在则 `upload --clobber`，否则 `create`”；同时为 `release-daemon-binaries.yml` 增加等待主 Release 出现的轮询，避免 daemon 工作流比主 release 更早执行时上传失败；统一桌面、Rust、lockfile 与 Android 版本到 `1.0.1`，并将 Android `versionCode` 提升到 `5` 以满足升级要求。
- **Why**: 用户要求直接发布 `v1.0.1`，且产物必须同时包含桌面包、安卓 APK 和 daemon 二进制；当前仓库虽然已有 APK 构建，但 `release.yml` 不会随 tag 自动触发，daemon 工作流还依赖“主 Release 已存在”的隐含前提，并且 updater/release URL 仍指向上游仓库，直接打 tag 会导致发布链路不完整或失效。
- **Goal**: 让推送 `v1.0.1` tag 后，GitHub 能自动生成并汇总桌面安装包、Android release APK 与 daemon 二进制，并保证应用更新元数据指向当前开源仓库。
