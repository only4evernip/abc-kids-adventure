# PROMPT_TEMPLATES.md - ecom-scout-dashboard Agent Prompt 模板库

这份文件是给 OpenClaw / ACP / 其他代码 Agent 使用的标准 Prompt 模板。

目标：

> **让 Agent 每次只改对当前问题，不扩散、不脑补、不重构无关代码。**

使用方法：
- 先选最接近任务的模板
- 把文件路径和限制条件补完整
- 明确“不要改什么”
- 要求最后执行：测试 / 构建 / 汇报改动

---

# 1. 通用总模板

```text
你现在在 ecom-scout-dashboard 项目中工作。

任务目标：<写清楚这次只要完成什么>

只允许修改这些文件：
- <file 1>
- <file 2>
- <file 3>

必须遵守这些规则：
1. 不要改未列出的文件
2. 不要重构无关代码
3. 不要引入新依赖，除非我明确要求
4. 涉及 Dexie 读取时，必须使用 useLiveQuery 思路，不要手写 useEffect + useState 同步数据库
5. 涉及导入 merge 时，必须保留 notes 和 manual workflowStatus 的防覆写语义
6. 完成后运行测试和构建，并汇报：改了什么、为什么这么改、验证结果如何

额外上下文：
<补充必要类型/约束/现状>
```

---

# 2. UI 微调模板

适用：
- 改布局
- 改文案
- 改视觉高亮
- 改 stepper / badge / 表格展示

```text
请只做 UI 展示层修改，不要改数据语义和导入链路。

任务：<例如：在 ProductTable 中为人工接管行增加视觉高亮>

只允许修改：
- src/components/discovery/ProductTable.tsx
- 必要时 src/types/product.ts（仅当类型引用缺失时）

禁止：
- 修改 worker
- 修改 db schema
- 修改导入逻辑
- 修改 queryProducts 规则

要求：
1. 保持现有行为不变，只增强展示
2. 不要删除现有高亮/选中逻辑
3. 如果新增视觉状态，请给出简洁图例或注释性文案
4. 完成后运行 npm run build 并汇报结果
```

---

# 3. 查询逻辑模板

适用：
- 筛选增强
- 排序前置过滤优化
- 工作流快捷筛选

```text
请只修改查询逻辑，不要改导入链路和无关 UI。

任务：<例如：为 queryProducts 增加 manualOnly 和 changedOnly 过滤>

只允许修改：
- src/lib/productQuery.ts
- src/store/useScoutStore.ts
- 必要时调用方（例如 App.tsx）

必须遵守：
1. 先用 Dexie 索引尽量缩小范围，再做内存过滤
2. 不要把关键词匹配放在高频链路最前面
3. 不要引入新的状态管理方式
4. 不要把筛选逻辑散落到 UI 组件里

输出要求：
- 说明新增了哪些过滤条件
- 说明过滤顺序为何这样安排
- 最后运行 npm test && npm run build
```

---

# 4. 导入链路模板

适用：
- 改 Worker
- 改错误摘要
- 改导入统计
- 改状态机

```text
请只处理导入链路，不要重构无关 UI。

任务：<例如：在 score.worker.ts 中增加导入失败摘要回传>

只允许修改：
- src/workers/score.worker.ts
- src/hooks/useScoreWorker.ts
- 必要时 src/store/useScoutStore.ts
- 必要时相关展示组件（仅用于接收并展示结果）

必须遵守：
1. 保持 Vite Worker 写法：new Worker(new URL(..., import.meta.url), { type: 'module' })
2. 不要破坏现有 merge 保护：notes 和 manual workflowStatus 不能被覆盖
3. 不要把核心逻辑塞进 App.tsx
4. 能抽成纯函数的逻辑尽量抽纯函数

完成后：
- 汇报新增的数据结构
- 汇报事件流如何变化
- 运行 npm test && npm run build
```

---

# 5. Schema / 类型变更模板

适用：
- ProductRecord 字段调整
- Dexie version 升级
- Session payload 升级

```text
请处理数据模型变更。

任务：<例如：为 ProductRecord 增加 workflowStatusSource 字段，并完成 Dexie 迁移>

只允许修改：
- src/types/product.ts
- src/lib/db.ts
- 必要时直接依赖这些字段的调用方

必须遵守：
1. 任何新字段都要考虑历史数据迁移
2. 修改 Dexie schema 时必须给出 version 升级方案
3. 不要只改类型不改迁移
4. 不要重新耦合系统建议状态与人工状态

完成后汇报：
- 新增/修改了哪些字段
- 旧数据如何迁移
- Session 导入导出是否受影响
- 最后运行 npm test && npm run build
```

---

# 6. 测试补强模板

适用：
- 给核心纯函数补测试
- 给 merge / ID / 统计逻辑补护栏

```text
请只补测试，不要顺手重构生产代码，除非为了导出纯函数供测试使用。

任务：<例如：为 stableProductId 和 mergeImportedRecord 增加 Vitest 覆盖>

优先覆盖：
- 边界 case
- 回归风险高的逻辑
- 数据语义相关逻辑

要求：
1. 测试文件尽量贴近被测模块
2. 不要引入额外测试框架
3. 若必须调整生产代码，仅允许做“导出纯函数”这类最小改动
4. 最后运行 npm test
```

---

# 7. 性能优化模板

适用：
- debounce
- 查询顺序优化
- 减少无意义重渲染

```text
请做小范围性能优化，不要进行大重构。

任务：<例如：为关键词筛选增加 debounce，并优化 queryProducts 的过滤顺序>

只允许修改：
- 直接相关的 hook / 查询模块 / 调用方

禁止：
- 引入新依赖（除非明确要求）
- 改写整个页面架构
- 提前做重型优化（如后端化、索引系统重构）

要求：
1. 先做高 ROI 优化
2. 优先减少无意义查询和高频重算
3. 保持现有行为语义不变
4. 最后跑测试和构建
```

---

# 8. 专用工作台优化模板

适用：
- 让这套系统更适合“助理自己持续使用”
- 工作流捷径
- 继续处理队列
- 行级高亮

```text
请按“专用工作台”方向优化，不要往多人平台/SaaS 方向扩展。

任务：<例如：增加‘只看人工接管 / 只看状态分叉 / 只看高分待处理’的工作流捷径>

必须遵守：
1. 以“我接下来最该继续处理什么”为核心目标
2. 不要引入云同步、多账号、权限体系等平台化能力
3. 不要为了泛化而增加复杂度
4. 优先增强：高亮、快捷筛选、状态沉淀、继续处理队列

完成后说明：
- 这个改动如何提升持续工作效率
- 哪些用户动作会因此变少/更快
- 最后运行 npm test && npm run build
```

---

# 9. Bug 修复模板

适用：
- 已知 bug 修复
- 回归修复
- 小范围问题定位

```text
请只修这个 bug，不要顺手做功能增强。

Bug 描述：
<清楚描述现象、预期、复现步骤>

只允许修改：
- <相关文件>

要求：
1. 先解释 bug 根因
2. 再给出最小修复方案
3. 不要改与 bug 无关的文件
4. 若修复涉及数据语义，必须保持现有 merge / status 规则不变
5. 最后运行相关测试 + build
```

---

# 10. 当 Agent 容易“发疯”时的约束模板

适用：
- 问题复杂
- 之前修坏过
- 容易误改很多文件

```text
这次请严格执行最小改动原则。

硬约束：
- 不要修改未明确列出的文件
- 不要引入新依赖
- 不要做样式顺手优化
- 不要重命名已有字段
- 不要改变现有状态语义
- 不要把多个目标混在一次提交里

如果你发现实现任务必须改更多文件，请先停下并说明原因，而不是直接扩散修改。

最后必须输出：
1. 改动文件列表
2. 每个文件为什么要改
3. 测试/构建结果
```

---

# 11. 推荐使用方式

建议实际协作时这样下指令：

1. **先下“约束 prompt”**
2. **再下“本轮原子任务 prompt”**
3. **要求最后测试/构建/汇报**

例如：

```text
请遵守 AGENT_RULES.md。
这次使用“查询逻辑模板”。
任务：为选品工作台增加‘只看人工接管’和‘只看状态分叉’筛选。
只允许修改：src/lib/productQuery.ts、src/store/useScoutStore.ts、src/App.tsx、src/components/discovery/FilterSidebar.tsx。
不要改导入链路，不要改 db schema。
完成后运行 npm test && npm run build，并汇报改动。
```

---

最后原则：

> **Prompt 越小、边界越清、约束越硬，Agent 越稳定。**
