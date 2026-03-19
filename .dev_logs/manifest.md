# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v10.md`

## Current Task

- 配置中新增前端自定义模型补全
- Goal: 在 Settings 的 Codex 配置中允许维护自定义模型 ID，并将 `gpt-5.4`、`gpt-5.3-codex` 作为默认补缺模型接入现有模型选择链路，保持服务端模型优先、缺失时再补位。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
