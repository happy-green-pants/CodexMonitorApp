State Summary (from `changelog_v11.md`):
- 已补齐主 `release.yml` 的 Linux app bundle 基础依赖，修复 `glib-sys` 因 `glib-2.0.pc` 缺失导致的 Ubuntu release 构建失败。
- `release-daemon-binaries.yml` 仍存在 Linux daemon 发布问题：x86_64 继承 `src-tauri` 的 Tauri/GTK/WebKit 依赖链但未安装完整系统库，aarch64 在 `ubuntu-latest` 上交叉编译时又触发 `pkg-config` cross-compilation 配置失败。

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
