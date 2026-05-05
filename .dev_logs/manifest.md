# Dev Logs Manifest

## Active Changelog

- Current: `/.dev_logs/changelog_v16.md`

## Current Task

- 远程 workspace/worktree 卡顿治理，并新增远程低带宽模式以减少服务器链路开销
- Goal: 修复远程 daemon 高频同步工作区带来的卡顿与报错，降低远程自动轮询与持续连接压力，让窄带服务器上的远程项目使用更稳定。

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
- `changelog_v15.md` 已接近 100 行；本轮 Git 忽略规则调整切换到 `changelog_v16.md`，避免继续在 Sentry / GitHub 发布修复分片上叠加无关主题。
- `changelog_v16.md` 当前继续承载仓库级 Git 忽略与远程端快速切换主题；后续若再跨 5 个独立模块或接近 100 行，需要继续分片。
- 项目最新约定：本地环境不再承担编译、验证、打包；统一由 GitHub Actions 执行构建/校验/发布，完成后从 GitHub 下载产物回本机。
- 产物回收约定：仅下载最终交付所需的关键产物（如 APK、daemon 二进制等），不下载无关日志、临时 artifacts 或非交付中间产物。
- 发布约定扩展：GitHub Release 默认交付 Android APK 与全平台 daemon；Linux daemon 构建需优先使用较低 glibc 基线 runner，避免服务器侧 ABI 不兼容。
