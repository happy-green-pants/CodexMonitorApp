# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v12.md`

## Current Task

- v1.0.1 发布链路修复与发版
- Goal: 统一桌面、Rust 与 Android 版本号为 1.0.1，修复 GitHub Release 自动触发、updater 链接和 daemon 上传竞态问题，并通过推送 `v1.0.1` tag 自动产出桌面包、安卓 APK 与 daemon 二进制。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
- `changelog_v11.md` approached the 100-line limit; start `changelog_v12.md` for daemon Linux release workflow fixes.
