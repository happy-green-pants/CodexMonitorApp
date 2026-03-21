# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v11.md`

## Current Task

- GitHub Actions Linux release 构建补齐 glib 系统依赖
- Goal: 修复 GitHub Actions 在 Ubuntu release 构建中因缺失 `glib-2.0.pc` / `pkg-config` 导致 `glib-sys` 自定义构建脚本失败的问题，恢复 Tauri app 与 daemon 的 Linux 发布链路。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
