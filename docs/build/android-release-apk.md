# Android Release APK 打包流程

本文档固化 CodexMonitor 的 Android release APK 打包步骤，适用于本仓库当前 Capacitor + Android 工程结构。

## 前置条件

- Node.js **>= 22**
- JDK **21**（TencentKonaJDK）
  - 已安装路径：`/usr/lib/jvm/java-21-konajdk-21.0.10-1.oc9`
- Android SDK 已安装并可被 Gradle 访问
- `android/keystore.properties` 已配置 release 签名

## 打包步骤

### 1. 构建前端产物

```bash
cd /www/wwwroot/CodexMonitor
npm run build
```

### 2. 同步 Capacitor 资源到 Android

> 注意：不要使用 `npx cap sync android`（会解析到 npm 的 `cap@0.2.1` 导致失败）。

```bash
cd /www/wwwroot/CodexMonitor
npx --yes @capacitor/cli@8.2.0 sync android
```

### 3. 使用 JDK 21 构建 release APK

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-konajdk-21.0.10-1.oc9
export PATH="$JAVA_HOME/bin:$PATH"
cd /www/wwwroot/CodexMonitor/android
./gradlew assembleRelease
```

### 4. APK 产物位置

```text
/www/wwwroot/CodexMonitor/android/app/build/outputs/apk/release/app-release.apk
```

## 常见问题

### 1) `invalid source release: 21`

说明 Gradle 未使用 JDK 21。请先设置：

```bash
export JAVA_HOME=/usr/lib/jvm/java-21-konajdk-21.0.10-1.oc9
export PATH="$JAVA_HOME/bin:$PATH"
```

再执行 `./gradlew assembleRelease`。

### 2) `npx cap sync android` 报 `could not determine executable to run`

原因：`npx cap` 被解析为 npm 上的 `cap@0.2.1`（无可执行 bin）。

解决：使用 Capacitor CLI 的正确入口：

```bash
npx --yes @capacitor/cli@8.2.0 sync android
```
