# ecom-scout-dashboard

一个本地优先的选品专用工作台，用来支持助理持续导入、筛选、判断、跟进商品，而不是做成一个过早复杂化的多人 SaaS 平台。

---

# 1. 这个项目是什么

这个项目当前的核心定位是：

> **助理替用户持续做选品工作的专用本地工作台**

它擅长：
- 导入真实 CSV 数据
- 本地打分与入库
- 快速筛选候选品
- 记录人工判断与备注
- 防止二次导入覆盖已有心血
- 支持持续跟进同一批商品

它当前**不是**：
- 云协作平台
- 多账号权限系统
- 重型 BI 看板
- 后端驱动的 SaaS 产品

---

# 2. 当前技术栈

- **Vite + React 19 + TypeScript**
- **Dexie**（本地数据库）
- **dexie-react-hooks**（响应式读取）
- **Zustand**（状态管理）
- **Web Worker**（导入/打分链路）
- **PapaParse**（CSV）
- **Zod**（校验）
- **@tanstack/react-virtual**（虚拟滚动）
- **Vitest**（测试）

---

# 3. 如果你是新接手的 Agent，先看这些文件

## 第一优先级
### `PROJECT_CONTEXT.md`
先看这个。

它会告诉你：
- 项目定位
- 当前核心架构
- 哪些语义绝不能碰
- 当前做到哪一步
- 最适合继续做什么

## 第二优先级
### `AGENT_RULES.md`
这是项目内 AI 协作规则。

它会告诉你：
- 怎么喂上下文
- 哪些技术栈约束必须遵守
- Dexie / Worker / merge 的硬规则
- 什么时候该小步提交
- 连续修不对时该怎么回退

## 第三优先级
### `PROMPT_TEMPLATES.md`
这是实战 Prompt 模板库。

当你要：
- 改 UI
- 改查询
- 改导入链路
- 改 schema
- 补测试
- 做性能优化

都可以先从这里挑模板。

## 第四优先级
### `NEXT_STEPS.md`
这是路线图约束。

它会告诉你：
- 当前最值得做什么
- 哪些先别做
- 什么时候进入 V1.1

---

# 4. 当前最不能碰坏的核心语义

如果你只记三件事，就记这三件：

## 4.1 系统建议状态与人工状态必须解耦
- `rps.suggestedStatus` = 系统建议
- `workflowStatus` = 当前工作流状态
- `workflowStatusSource` = `system | manual`

## 4.2 人工沉淀必须保护
导入时必须保留：
- `notes`
- `workflowStatus`（当 `workflowStatusSource === 'manual'`）

## 4.3 Dexie 读取必须走 `useLiveQuery`
默认不要手写：
- `useEffect + useState` 去同步数据库数据

---

# 5. 当前已经完成的核心能力

- 导入防覆写
- 状态解耦
- stable ID 加固
- 导入失败摘要
- 导入统计
- 自适应布局
- 导入状态机 + stepper
- 查询性能第一轮优化
- 核心测试补强
- 专用工作流高亮 + 快捷筛选

---

# 6. 当前目录中的关键文件

## 数据模型 / Schema
- `src/types/product.ts`
- `src/lib/db.ts`

## 查询 / 规则
- `src/lib/productQuery.ts`
- `src/domain/rps.ts`

## 导入链路
- `src/workers/score.worker.ts`
- `src/hooks/useScoreWorker.ts`

## 主要 UI
- `src/App.tsx`
- `src/components/import/ImportSection.tsx`
- `src/components/discovery/FilterSidebar.tsx`
- `src/components/discovery/ProductTable.tsx`
- `src/components/detail/DetailDrawer.tsx`

---

# 7. 开发时推荐流程

每次开始新任务，按这个顺序走：

1. 先看 `PROJECT_CONTEXT.md`
2. 再看 `AGENT_RULES.md`
3. 从 `PROMPT_TEMPLATES.md` 里选模板
4. 小步改代码
5. 运行：
   - `npm test`
   - `npm run build`
6. commit

---

# 8. 当前开发原则

> **不追求功能越来越多，而追求让我持续干活越来越顺。**

因此优先做：
- 更稳的导入
- 更快的筛选
- 更清楚的人工判断沉淀
- 更好的“继续处理什么”工作流

暂时不做：
- 云同步
- 多账号权限
- 富文本备注
- 复杂图表
- 重型后端化

---

# 9. 常用命令

```bash
npm install
npm test
npm run build
npm run dev
```

---

# 10. 一句话总结

> **这是一个本地优先、保护人工判断沉淀、面向持续选品工作的专用工作台。**

任何改动，都应围绕这个目标，而不是把它推向一个过早复杂化的平台。
