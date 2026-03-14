# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v5.md`

## Current Task

- Web 远程模式 Workspace 选择崩溃修复
- Goal: 修复非 Tauri(Web) 运行时选择 workspace 时 `convertFileSrc` 报错导致白屏

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
