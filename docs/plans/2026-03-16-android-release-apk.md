# Android Release APK 打包 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 产出可安装的 Android release APK，并验证发送页上传图片流程正常。

**Architecture:** 复用现有 Capacitor Android 工程与前端 `dist/` 构建产物，通过 `npx cap sync android` 同步资源后使用 Gradle release 签名构建 APK。失败时只处理构建与环境问题，不改动业务逻辑。

**Tech Stack:** Capacitor 8, Gradle, Android SDK, JDK 21, Node.js 22, Vite

---

### Task 1: 构建前端产物

**Files:**
- Modify: `package.json`
- Output: `dist/`

**Step 1: Write the failing test**

不适用（构建任务）。

**Step 2: Run build to verify it fails (if environment broken)**

Run: `npm run build`
Expected: 若环境异常，显示构建错误；否则生成 `dist/` 目录。

**Step 3: Minimal implementation**

无代码修改。若构建失败，仅修复构建环境问题（Node/JDK/依赖）。

**Step 4: Run build to verify it passes**

Run: `npm run build`
Expected: 生成 `dist/` 目录并无错误。

**Step 5: Commit**

无代码变更不提交。

### Task 2: 同步 Capacitor 资源

**Files:**
- Modify: `android/` (generated assets)

**Step 1: Write the failing test**

不适用（同步任务）。

**Step 2: Run sync to verify it fails (if environment broken)**

Run: `npx cap sync android`
Expected: 若 Node/Android 环境异常则报错，否则输出同步成功。

**Step 3: Minimal implementation**

无代码修改。若失败，仅修复同步所需环境问题。

**Step 4: Run sync to verify it passes**

Run: `npx cap sync android`
Expected: Android assets 更新成功。

**Step 5: Commit**

无代码变更不提交。

### Task 3: 产出 release APK

**Files:**
- Modify: `android/app/build/outputs/apk/release/` (build output)

**Step 1: Write the failing test**

不适用（构建任务）。

**Step 2: Run Gradle release build**

Run: `cd android && ./gradlew assembleRelease`
Expected: 输出 release APK 至 `android/app/build/outputs/apk/release/`。

**Step 3: Minimal implementation**

无代码修改。若失败，检查 `android/keystore.properties` 与 JDK 21。

**Step 4: Re-run Gradle build**

Run: `cd android && ./gradlew assembleRelease`
Expected: 生成 release APK。

**Step 5: Commit**

无代码变更不提交。

### Task 4: 安装与验收

**Files:**
- None (manual)

**Step 1: Install APK on device/emulator**

Run: `adb install -r android/app/build/outputs/apk/release/*.apk`
Expected: 安装成功。

**Step 2: Verify core flow**

- 打开 APP
- 进入发送页点击“上传图片”
- 应唤起系统选择器
- 选中图片后成功附加
- 失败时有可见错误提示

**Step 3: Record result**

将验收结果反馈并记录。

**Step 4: Commit**

无代码变更不提交。
