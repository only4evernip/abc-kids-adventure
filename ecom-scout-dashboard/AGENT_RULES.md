# AGENT_RULES.md - ecom-scout-dashboard AI 协作规则

这不是给人看的产品文档，而是给 OpenClaw / ACP / 其他代码 Agent 的项目内开发守则。

目标只有一个：

> **降低上下文污染、减少技术栈幻觉、避免在稳定代码上叠废补丁。**

---

## 1. 总原则

### 1.1 小步快跑，禁止宏大叙事
不要一次性要求 Agent “把某个大功能做完”。

必须拆成原子任务，例如：
1. 改数据类型
2. 改查询/规则纯函数
3. 改 hook 接入
4. 改 UI 展示
5. 跑测试与构建
6. commit

### 1.2 只给完成当前任务所需的最小上下文
不要把整个 `src/` 一次性喂给 Agent。

按任务边界提供最小闭包上下文：
- 改 UI：当前组件 + 调用它的 store/hook
- 改查询：`productQuery.ts` + `useScoutStore.ts` + 相关调用方
- 改导入：`score.worker.ts` + `types/product.ts` + `lib/db.ts` + 相关 hook
- 改状态语义：`types/product.ts` + `lib/db.ts` + 相关 UI

### 1.3 每完成一个小功能必须验证
默认流程：
1. 改代码
2. `npm test`
3. `npm run build`
4. `git commit`

不要攒一堆改动后再一起验证。

### 1.4 连续修不对，不要叠补丁
如果 Agent 连续 2–3 轮还没修对：
- 停止继续 patch
- 回到上一个稳定提交
- 重写 prompt
- 重新分解任务

不要让错误代码成为下一轮上下文基础。

---

## 2. 本项目技术栈硬规则

## 2.1 Dexie 读取规则
**所有 Dexie 读取默认使用 `dexie-react-hooks` 的 `useLiveQuery`。**

禁止随手写：
- `useEffect + useState` 去同步数据库数据
- 手工维护“数据库镜像 state”

允许例外：
- 一次性命令式操作（例如导出、清空、手动触发导入）

## 2.2 Web Worker 规则
本项目使用 **Vite**。

Worker 必须使用：

```ts
new Worker(new URL("../workers/score.worker.ts", import.meta.url), { type: "module" })
```

禁止：
- Webpack 风格 worker loader 写法
- 过时的原生路径字符串写法

## 2.3 虚拟滚动规则
只使用：
- `@tanstack/react-virtual` v3

禁止：
- `react-virtualized`
- 旧版虚拟滚动库混入

## 2.4 数据语义规则
涉及状态、导入、merge 时，必须遵守当前语义：

- `rps.suggestedStatus` = 系统建议状态
- `workflowStatus` = 当前工作流状态
- `workflowStatusSource` = `system | manual`
- `workflowStatusUpdatedAt` = 当前状态最近更新时间

禁止把“系统建议状态”和“人工工作流状态”重新耦合到同一个字段里。

## 2.5 导入合并规则
导入时必须遵守：

### 永远保留
- `notes`
- `workflowStatus`（当 `workflowStatusSource === 'manual'`）

### 永远允许刷新
- `rps`
- 导入时间
- 批次号
- 原始源数据字段

### 条件刷新
- 如果 `workflowStatusSource !== 'manual'`，允许 `workflowStatus` 跟随 `rps.suggestedStatus`

禁止直接 `bulkPut(incomingRecords)` 覆盖所有旧记录而不做 merge。

---

## 3. 上下文喂给 Agent 的规则

## 3.1 涉及字段 / 状态 / 落库时，必须带这两个文件
- `src/types/product.ts`
- `src/lib/db.ts`

否则 Agent 极容易：
- 捏造字段
- 写错状态语义
- 忘记 Dexie schema 对应关系

## 3.2 改 UI 时不要混入无关规则文件
例如改 `ProductTable.tsx`：
- 应带：`ProductTable.tsx`、`useScoutStore.ts`、必要时 `product.ts`
- 不应顺手把 worker、导入链路、db 全塞进去

## 3.3 改规则时不要混入大块 UI
例如改筛选规则：
- 应带：`productQuery.ts`、`useScoutStore.ts`、相关测试
- 不应把 `DetailDrawer.tsx`、`ImportSection.tsx` 这种无关 UI 一起喂进去

---

## 4. 推荐开发顺序模板

遇到新需求时，优先按这个顺序拆：

1. **先确认数据模型是否要变**
2. **再改纯函数 / 查询函数 / merge 规则**
3. **再改 hook / store 接入**
4. **最后改 UI**
5. **补测试**
6. **build + commit**

不要一上来先改 `App.tsx`。

---

## 5. Prompt 模板建议

## 5.1 改查询逻辑
> 只修改 `src/lib/productQuery.ts` 和必要的类型定义。不要改 UI。必须保持 Dexie 读取方式与现有架构一致，优先索引缩范围，再做内存过滤。完成后不要引入新的依赖。

## 5.2 改 UI 展示
> 只修改当前组件和必要的类型引用，不要改导入链路和数据库 schema。保持现有行为不变，只做展示增强。完成后确保 `npm run build` 可通过。

## 5.3 改导入链路
> 允许修改 `score.worker.ts`、`types/product.ts`、`lib/db.ts` 和直接相关 hook。禁止重构无关 UI。必须保留当前的 merge 保护语义：notes 和 manual workflowStatus 不可被覆盖。

## 5.4 改 Dexie 读写
> 所有读取必须遵守 `useLiveQuery` 规则；不要引入 `useEffect + useState` 同步数据库数据。修改 schema 时同时考虑历史迁移。

---

## 6. Git 安全规则

每完成一个微小功能，必须：

```bash
npm test
npm run build
git add ...
git commit -m "..."
```

如果改坏：
- 优先看 `git diff`
- 优先 `git restore <file>` 或回到上一个稳定提交
- 不要让未验证的大块脏改动长期堆在工作区

---

## 7. 当前项目优先级观

这个系统首先是：

> **给助理自己使用、替用户持续做选品工作的专用本地工作台**

不是当前阶段的重点：
- 云同步
- 多账号权限
- 复杂图表
- 富文本备注
- 重型后端化

优先方向：
- 更稳的导入
- 更快的筛选
- 更清晰的人工判断沉淀
- 更强的“继续处理什么”工作流支持

---

## 8. 现阶段判定一个改动是否值得做

问自己三个问题：

1. 这个改动是否让助理更容易持续跟进商品？
2. 这个改动是否会破坏已有数据语义或 merge 保护？
3. 这个改动是否值得为当前单用户专用场景增加复杂度？

如果第 1 条不明显成立，或者第 2/3 条风险过高，先别做。

---

最后原则：

> **稳定、可解释、可持续迭代，永远优先于“看起来很强”。**
