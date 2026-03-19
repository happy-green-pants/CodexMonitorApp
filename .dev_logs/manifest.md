# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v11.md`

## Current Task

- Git/Files 文件预览移动端浮层适配
- Goal: 修复底部 Git/Files 面板中文件预览在窄屏下超出视口、难以关闭、无法完整浏览的问题；移动端改为受限浮层+遮罩，桌面端保持现有锚点预览体验。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
