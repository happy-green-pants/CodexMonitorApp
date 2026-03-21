# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v12.md`

## Current Task

- 远程 Git 继承系统全局身份修复
- Goal: 修复远程 HTTP/TCP 连接下 Git 子进程只读取 app-managed `safe.directory` 配置、却丢失服务端系统 `user.name` / `user.email` 的问题；保持现有 ownership/safe.directory 兼容能力，同时恢复对系统全局 Git 身份与 XDG Git 配置的继承。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
