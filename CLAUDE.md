# 项目协作说明

## 后端服务打包流程（主工作区）

当用户说“打包后端服务”时，**默认在主工作区** `/www/wwwroot/CodexMonitor` 执行以下流程：

```bash
# 必须在主工作区执行
cargo build --release --bin codex_monitor_daemon --manifest-path src-tauri/Cargo.toml

# 产物路径
ls -l src-tauri/target/release/codex_monitor_daemon

# 最小可执行性验证
src-tauri/target/release/codex_monitor_daemon --help

# 需要前台启动时使用脚本
bash scripts/start_codex_monitor_daemon.sh
```
