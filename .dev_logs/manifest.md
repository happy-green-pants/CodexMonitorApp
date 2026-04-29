# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v15.md`

## Current Task

- 统一改为 GitHub 远程编译/验证/打包流程，并修复 `v1.0.3` 远程发布中暴露的前端 TypeScript 错误
- Goal: 当前项目后续所有编译、验证、打包都通过 GitHub Actions 完成，产物完成后再从 GitHub 下载回本地；当前优先让 `v1.0.3` 的远程 Release 构建恢复通过。

## Notes

- Read-before-edit requirement satisfied by checking this manifest path and confirming it did not exist prior to initialization.
- Create a new changelog shard when the active file exceeds 100 lines or 5 independent feature modules.
- `changelog_v1.md` is saturated and archived after the initial Web + Android remote-first implementation batch.
- `changelog_v2.md` reached >5 modules; start `changelog_v3.md` for ongoing work.
- `changelog_v3.md` exceeded 100 lines; start `changelog_v4.md` for startup request-storm stabilization work.
- `changelog_v5.md` exceeded 100 lines; start `changelog_v6.md` for image picker runtime compatibility work.
- `changelog_v11.md` approached the 100-line limit; start `changelog_v12.md` for daemon Linux release workflow fixes.
- `changelog_v12.md` 已承载上一轮发版与远程 MCP 修复记录；当前 Android 远程恢复任务跨越前端、后端、RPC 与测试多模块，切换到 `changelog_v13.md` 继续记录。
- `changelog_v13.md` 已接近 100 行且已混合多轮发布/远程恢复/文档任务；本轮 Web 文件编辑扩展切换到 `changelog_v14.md`，避免功能记忆串扰。
- `changelog_v14.md` 已接近 100 行且混合 Web 文件编辑、daemon 打包与模型配置修复；本轮 Sentry Web 告警修复切换到 `changelog_v15.md`，避免继续跨主题堆叠。
- 项目最新约定：本地环境不再承担编译、验证、打包；统一由 GitHub Actions 执行构建/校验/发布，完成后从 GitHub 下载产物回本机。
