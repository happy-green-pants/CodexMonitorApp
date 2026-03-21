# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v12.md`

## Current Task

- GitHub Actions daemon Linux 发布构建修复
- Goal: 修复 `release-daemon-binaries` 中 Linux x86_64 缺少 GTK/WebKit 依赖与 Linux aarch64 交叉编译 `pkg-config` 失败的问题，恢复 daemon 发布工作流。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
- `changelog_v11.md` approached the 100-line limit; start `changelog_v12.md` for daemon Linux release workflow fixes.
