# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v8.md`

## Current Task

- Android（Capacitor）“AI 回复完成后通知”与通知权限适配
- Goal: 修复 Android 16 上通知权限入口置灰，并让 Android App 在 AI 回复/turn 完成后能弹出系统通知（Web 端可后置）。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
