# Custom Models Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 CodexMonitor 前端提供全局自定义模型管理入口，并让手动添加的模型出现在现有模型选择链路中。

**Architecture:** 复用现有 `AppSettings` 持久化链路保存 `customModels`，在设置页 `SettingsCodexSection` 提供最小交互，在 `useModels` 中把服务端模型和自定义模型做补位合并。服务端真实模型优先，自定义模型只补缺。

**Tech Stack:** React, TypeScript, Vitest, Tauri, Rust serde

---

### Task 1: 扩展设置类型

**Files:**
- Modify: `src/types.ts`
- Modify: `src-tauri/src/types.rs`

**Step 1: Write the failing test**

在前端设置相关测试中加入 `customModels` 缺省结构，确保类型变化后测试能显式覆盖该字段。

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/settings/components/SettingsView.test.tsx`
Expected: 因 `AppSettings` 新字段缺失或类型不匹配导致失败。

**Step 3: Write minimal implementation**

为前后端 `AppSettings` 增加 `customModels`，Rust 端提供默认空数组。

**Step 4: Run targeted tests**

Run: `npm run test -- src/features/settings/components/SettingsView.test.tsx`
Expected: 类型与设置快照相关测试恢复通过。

**Step 5: Commit**

```bash
git add src/types.ts src-tauri/src/types.rs
git commit -m "feat: add custom model settings field"
```

### Task 2: 实现设置页自定义模型 UI

**Files:**
- Modify: `src/features/settings/components/sections/SettingsCodexSection.tsx`
- Test: `src/features/settings/components/SettingsView.test.tsx`

**Step 1: Write the failing test**

添加设置页测试，覆盖：

- 输入 `model id` 后点击添加会调用 `onUpdateAppSettings`
- 已添加模型可见
- 点击删除会调用 `onUpdateAppSettings`

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/settings/components/SettingsView.test.tsx`
Expected: 找不到新增 UI 或交互断言失败。

**Step 3: Write minimal implementation**

在 `SettingsCodexSection` 新增：

- `model id` 输入框
- 添加按钮
- 自定义模型列表
- 删除按钮

添加时构造最小 `ModelOption`，默认通用推理强度和 `medium` 默认值。

**Step 4: Run targeted tests**

Run: `npm run test -- src/features/settings/components/SettingsView.test.tsx`
Expected: 新增交互测试通过。

**Step 5: Commit**

```bash
git add src/features/settings/components/sections/SettingsCodexSection.tsx src/features/settings/components/SettingsView.test.tsx
git commit -m "feat: add custom model settings UI"
```

### Task 3: 接入模型合并逻辑

**Files:**
- Modify: `src/features/models/hooks/useModels.ts`
- Modify: `src/features/app/components/MainApp.tsx`
- Test: `src/features/models/hooks/useModels.test.tsx`

**Step 1: Write the failing test**

为 `useModels` 增加测试：

- 服务端缺失时追加自定义模型
- 服务端已返回同名模型时不重复
- 自定义模型具备通用推理强度

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/features/models/hooks/useModels.test.tsx`
Expected: 合并逻辑相关断言失败。

**Step 3: Write minimal implementation**

让 `useModels` 接收 `customModels` 并在解析服务端结果后合并。`MainApp` 将 `appSettings.customModels` 透传进 `useModels`。

**Step 4: Run targeted tests**

Run: `npm run test -- src/features/models/hooks/useModels.test.tsx`
Expected: 合并行为通过。

**Step 5: Commit**

```bash
git add src/features/models/hooks/useModels.ts src/features/app/components/MainApp.tsx src/features/models/hooks/useModels.test.tsx
git commit -m "feat: merge custom models into model list"
```

### Task 4: 验证回归

**Files:**
- Verify: `src/features/settings/components/SettingsView.test.tsx`
- Verify: `src/features/models/hooks/useModels.test.tsx`
- Verify: `src/features/settings/components/sections/SettingsCodexSection.tsx`
- Verify: `src/features/models/hooks/useModels.ts`

**Step 1: Run targeted tests**

Run: `npm run test -- src/features/settings/components/SettingsView.test.tsx src/features/models/hooks/useModels.test.tsx`
Expected: 目标测试全部通过。

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: 通过。

**Step 3: Run broader suite if needed**

Run: `npm run test`
Expected: 通过，若存在已有无关失败，单独记录。

**Step 4: Record result**

把实现与验证结果追加到 `/.dev_logs/changelog_v10.md`，必要时切分新分片。

**Step 5: Commit**

```bash
git add .dev_logs/changelog_v10.md
git commit -m "docs: record custom model validation"
```
