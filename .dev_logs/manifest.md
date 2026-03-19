# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v11.md`

## Current Task

- 通知细分、通知跳转与模型默认记忆修复
- Goal: 仅在“需回应”与“回合结束/最终失败”时触发通知；点击系统通知稳定跳转到对应会话；新建对话默认继承最近一次显式选择的模型与 reasoning effort。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
