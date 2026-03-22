# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v12.md`

## Current Task

- v1.0.0 自动发布收敛与重发
- Goal: 在不回退 main 主线 1.0.1 演进的前提下，生成一个仅用于现有 `v1.0.0` Release 的自动发布提交，上传 Android APK 与 daemon 二进制，并避免桌面 bundle 流程继续阻断发布。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
- `changelog_v11.md` approached the 100-line limit; start `changelog_v12.md` for daemon Linux release workflow fixes.
