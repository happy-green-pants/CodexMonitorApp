# Android Release APK 设计说明

**目标**
- 产出可安装的 Android release APK（基于现有 Capacitor 工程）。
- 验证发送页“上传图片”流程：可唤起系统选择器、成功附加、失败有可见提示。

**约束**
- 复用现有 `android/` 与 `capacitor.config.ts`，不引入新移动端框架。
- 不修改业务逻辑，仅进行构建与打包流程。
- 使用已配置的 release 签名（`android/keystore.properties`）。

## 架构与流程
1. 前端构建生成 `dist/`。
2. 执行 `npx cap sync android` 同步资源到 Android 工程。
3. 使用 Gradle `assembleRelease` 生成 release APK。
4. 在设备或模拟器安装并按验收点手动验证。

## 组件/步骤
- **前端构建**：`npm run build` → `dist/`
- **Capacitor 同步**：`npx cap sync android` → 更新 Android assets
- **APK 产出**：`./gradlew assembleRelease` → `android/app/build/outputs/apk/release/`
- **验收**：安装 APK → 验证上传图片流程

## 错误处理与回滚
- 构建/同步失败时先核查环境（Node 22、JDK 21、Android SDK）。
- release 构建失败时核查 `keystore.properties` 配置完整性。
- 不做业务代码改动，保留日志与产物用于复现。

## 测试与验收
- APK 可安装并启动。
- 发送页点击“上传图片”后唤起系统选择器。
- 选择图片后能成功附加。
- 失败路径有可见错误提示。
