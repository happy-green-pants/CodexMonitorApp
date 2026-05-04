# GitHub 发版 Runbook

本文档固化 CodexMonitor 当前可复用的 GitHub 发版流程。
当用户表达“打包到 GitHub”“发布到 GitHub”“上传 APK 和 daemon 到 GitHub Release”时，默认采用本流程，除非用户明确要求不同版本或不同产物范围。

## 适用范围

- 目标仓库：`git@github.com:happy-green-pants/CodexMonitorApp.git`
- 发布目标：GitHub Release 页面
- 当前默认发布产物：
  - Android release APK
  - `codex_monitor_daemon` 全平台二进制（由独立 daemon workflow 追加上传）
- 不默认承诺本流程会产出桌面 app bundle；若用户明确要求桌面安装包，需要单独确认对应签名与平台构建状态。

## 标准流程

### 1. 先确认发布目标版本

发布前必须先确认以下三件事：

- 本次要发布到哪个 tag，例如 `v1.0.0`
- GitHub 上该 Release 是否已经存在
- 这次是“新建 Release”还是“重发已有 Release 资产”

若用户要求重发已有 Release，优先复用原有 Release 页面，不新建额外版本。

### 2. 将代码与版本对齐到目标 tag

如果目标是现有版本（例如重发 `v1.0.0`），不要直接在 `main` 上回退主线版本。
应创建一个临时发布分支，在该分支中：

- 将 `package.json`、`package-lock.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock` 的显示版本改为目标版本
- 将 Android `versionName` 对齐到目标版本
- 将 Android `versionCode` 继续递增，保证 Android 安装升级序列单调递增
- 更新 `/.dev_logs/manifest.md` 与当前 changelog 分片

### 3. 主 Release workflow 只负责 APK

当前稳定流程中：

- `.github/workflows/release.yml` 只负责 Android APK 的构建与上传
- `Release` workflow 由 tag push 自动触发，也可 `workflow_dispatch`
- 产物命名为 `CodexMonitor_<version>_android.apk`
- 若同 tag 的 Release 已存在，使用 `gh release upload --clobber`
- 若同 tag 的 Release 不存在，使用 `gh release create`

这样可以避免桌面 bundle 的签名和 GUI 打包问题阻断 APK 发布。

### 4. daemon workflow 独立附加全平台 daemon 二进制

当前稳定流程中：

- `.github/workflows/release-daemon-binaries.yml` 独立构建 daemon 二进制
- 该 workflow 在 `v*` tag push 时自动触发
- 其 release job 必须等待目标 Release 出现后再执行 `gh release upload`
- daemon workflow 负责把各平台二进制追加到同一个 GitHub Release
- macOS ARM daemon 应使用显式 Apple Silicon runner 标签（当前固定为 `macos-15`），不要依赖 `macos-latest` 漂移
- 当前默认追加以下 daemon 资产：
  - `codex_monitor_daemon-linux-x86_64`
  - `codex_monitor_daemon-linux-aarch64`
  - `codex_monitor_daemon-macos-x86_64`
  - `codex_monitor_daemon-macos-aarch64`
  - `codex_monitor_daemon-windows-x86_64.exe`
- Linux daemon 的 GitHub runner 应优先保持较低 glibc 基线，避免在常见服务器环境下载后因 `GLIBC_x.y` 版本过高而无法运行。
- Release 上传时必须使用真实的平台化文件名，不能把多个平台产物继续上传成相同的裸文件名（例如都叫 `codex_monitor_daemon`），否则后上传的资产会覆盖先上传资产，最终导致 Release 丢失 macOS/Linux 目标文件。

### 5. 推送分支并移动目标 tag

推荐顺序：

```bash
git push github <temporary-release-branch>
git tag -f vX.Y.Z <release-commit>
git push github vX.Y.Z --force
```

说明：

- 若是重发已有版本，允许将远程 tag 强制移动到新的“重发提交”
- 强推 tag 前必须确认用户明确接受“重发该版本资产”这个动作
- 若同步需要保留其他远程（例如 `origin`），可按用户要求决定是否同步推送该分支或 tag

### 6. 用 GitHub API 验证结果

优先使用 GitHub API 验证，不依赖页面人工查看。
常用检查：

```bash
curl -s https://api.github.com/repos/happy-green-pants/CodexMonitorApp/actions/runs?per_page=20
curl -s https://api.github.com/repos/happy-green-pants/CodexMonitorApp/actions/runs/<run_id>/jobs
curl -s https://api.github.com/repos/happy-green-pants/CodexMonitorApp/releases/tags/vX.Y.Z
```

完成标准：

- `Release` workflow 成功，且 APK asset 已出现在目标 Release
- `Release Daemon Binaries` workflow 成功，且全平台 daemon 二进制已附加到目标 Release

## v1.0.3 重发补充

若 `v1.0.3` 需要补发 macOS Apple Silicon daemon：

- 复用现有 `v1.0.3` Release 页面，不新建 `v1.0.3-hotfix` 之类的额外 tag
- 先确保 `.github/workflows/release-daemon-binaries.yml` 已包含：
  - 显式 `macos-15` Apple Silicon runner
  - 上传前将产物重命名为真实资产名（如 `codex_monitor_daemon-macos-aarch64`）
- 然后将远程 `v1.0.3` tag 指向包含上述 workflow 修复的提交，并重新触发 `Release` 与 `Release Daemon Binaries`
- 验证 `v1.0.3` Release 至少包含：
  - `CodexMonitor_1.0.3_android.apk`
  - `codex_monitor_daemon-linux-x86_64`
  - `codex_monitor_daemon-linux-aarch64`
  - `codex_monitor_daemon-macos-x86_64`
  - `codex_monitor_daemon-macos-aarch64`
  - `codex_monitor_daemon-windows-x86_64.exe`

## 当前约定

当用户只说“打包到 GitHub”时，默认理解为：

- 发布到 `happy-green-pants/CodexMonitorApp` 的 GitHub Release
- 主发布内容至少包含 Android APK
- 同时追加全平台 daemon 二进制
- 若需要重发旧版本，优先复用已有 Release 页面并重打对应 tag

## 执行清单

每次按本流程发版前，至少执行：

```bash
git status --short --branch
git diff --check
npm run typecheck
```

如果改动涉及 Rust 版本或 workflow 中会读取 Rust/Tauri 配置，额外执行：

```bash
cd src-tauri && cargo check
```

## 相关文件

- `.github/workflows/release.yml`
- `.github/workflows/release-daemon-binaries.yml`
- `docs/build/android-release-apk.md`
- `AGENTS.md`
