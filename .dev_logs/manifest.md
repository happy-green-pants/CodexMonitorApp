# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v13.md`

## Current Task

- 远程移动端 heavy Git 工作区连接降级与稳定性修复
- Goal: 识别大规模脏仓库与 mode-change 主导仓库，在远程/移动端停止高成本自动 Git diff 链路并保留手动查看能力，避免添加工作区后卡顿或连接失败。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
- `changelog_v11.md` approached the 100-line limit; start `changelog_v12.md` for daemon Linux release workflow fixes.
- `changelog_v12.md` 已承载上一轮发版与远程 MCP 修复记录；当前 Android 远程恢复任务跨越前端、后端、RPC 与测试多模块，切换到 `changelog_v13.md` 继续记录。
