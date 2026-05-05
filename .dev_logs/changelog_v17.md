State Summary (from `changelog_v16.md`):
- 顶部 Server 快捷入口已收口为所有终端统一的单图标按钮。
- 远程低带宽模式与 worktree/workspace 同步降频修复已落地，当前发布默认走 GitHub Actions 与 GitHub Release。
- daemon Release workflow 已固定平台化资产命名与 macOS ARM runner，适合继续用于正式版本发布。

# Changelog v17

---
### [2026-05-05 20:16] | Agent: Codex
- **File**: `/package.json`, `/package-lock.json`, `/src-tauri/Cargo.toml`, `/src-tauri/Cargo.lock`, `/src-tauri/tauri.conf.json`, `/android/app/build.gradle`, `/.dev_logs/manifest.md`, `/.dev_logs/changelog_v17.md`
- **Change**: 将应用版本从 `1.0.3` 同步提升到 `1.0.4`，同时把 Android `versionCode` 从 `8` 递增到 `9` 并补充用途注释；按日志分片规则将活跃 changelog 切换到 `changelog_v17.md`，记录本次发版准备动作。
- **Why**: GitHub Release 的 APK 命名、Rust/Tauri 元数据、Android 安装升级序列和远程 tag 必须保持一致；`changelog_v16.md` 已接近 100 行，继续写入会违反项目记忆分片约束。
- **Goal**: 为推送 `v1.0.4` tag 和触发 GitHub Actions 发布链路准备一致的版本元数据与可追溯日志。
---
