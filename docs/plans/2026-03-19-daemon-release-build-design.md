# 2026-03-19-daemon-release-build-design

## 背景与目标

- 目标：为 Linux x86_64 生成 `codex_monitor_daemon` 的生产二进制，供 `scripts/start_codex_monitor_daemon.sh` 直接使用。
- 约束：保持脚本不变；不修改参数与路径；不做静态链接或 strip。

## 方案选择

### 方案 A（推荐）
- 命令：`cargo build --release --bin codex_monitor_daemon --manifest-path src-tauri/Cargo.toml`
- 产物：`src-tauri/target/release/codex_monitor_daemon`
- 优点：路径与脚本一致、改动最小
- 缺点：依赖本机 Rust 工具链

### 方案 B（目标三元组）
- 命令：`cargo build --release --bin codex_monitor_daemon --manifest-path src-tauri/Cargo.toml --target x86_64-unknown-linux-gnu`
- 优点：目标明确
- 缺点：产物路径变化，不符合现有脚本

### 方案 C（strip）
- 命令：构建后 `strip`
- 优点：体积更小
- 缺点：依赖系统工具，降低可调试性

## 设计说明

### 架构/打包流程
- 仅构建 `src-tauri` 内的 `codex_monitor_daemon` release 二进制。
- 使用 Cargo release 构建，产物输出到 `src-tauri/target/release/codex_monitor_daemon`，保持脚本路径不变。
- 不改动脚本参数与数据目录。

### 组件与数据流
- 组件：Rust 二进制 `codex_monitor_daemon`。
- 数据流：daemon 通过 `--http-listen 127.0.0.1:9010 --token 123456 --data-dir /home/www/.local/share/codex-monitor-daemon` 接受本机 HTTP 请求并读写 data-dir。
- 外部依赖：Rust toolchain + system linker；不引入新依赖。

### 错误处理与验证
- 构建失败即退出，不新增运行时错误处理。
- 构建后执行 `src-tauri/target/release/codex_monitor_daemon --help` 验证可执行性。
- 不修改脚本/配置，不做静态链接或 strip。
