# PROJECT_CONTEXT.md - ecom-scout-dashboard 项目上下文

这份文件给新接手的 OpenClaw / ACP / 其他代码 Agent 使用。

目标：

> **让任何新 Agent 在最短时间内理解：这个项目是什么、为什么这样设计、哪些地方绝不能乱碰。**

---

# 1. 项目定位

## 不是通用 SaaS，不是多人平台
这个项目当前阶段首先是：

> **助理替用户持续做选品工作的专用本地工作台**

重点不是：
- 云同步
- 多账号权限
- 团队协作平台化
- 复杂 BI 图表
- 重型后端架构

重点是：
- 稳定导入 CSV
- 快速筛选候选品
- 沉淀人工判断
- 连续跟进同一批商品
- 防止二次导入覆盖心血

---

# 2. 当前技术栈

- **前端**：Vite + React 19 + TypeScript
- **本地数据库**：Dexie
- **响应式读取**：dexie-react-hooks / `useLiveQuery`
- **状态管理**：Zustand
- **虚拟滚动**：`@tanstack/react-virtual` v3
- **CSV 解析**：PapaParse
- **数据校验**：Zod
- **导入打分链路**：Web Worker
- **测试**：Vitest

---

# 3. 当前核心架构

## 3.1 数据流主链路
1. 用户导入 CSV
2. Worker 解析 CSV
3. Zod 校验并标准化
4. 计算 RPS
5. 生成稳定 ID
6. 与本地旧记录 merge
7. 落库 Dexie
8. React 通过 `useLiveQuery` 驱动界面更新

## 3.2 主界面结构
- **导入区**
  - 导入按钮
  - stepper
  - 导入状态/统计
  - 失败摘要
- **左栏**：筛选器 + 工作流捷径
- **中栏**：虚拟滚动表格（发现矩阵）
- **右栏**：详情抽屉（状态、备注、RPS、VOC 等）

---

# 4. 当前最重要的数据语义

这是项目里最不能乱碰的部分。

## 4.1 系统建议状态 vs 人工状态
当前设计：

- `rps.suggestedStatus` = 系统建议状态
- `workflowStatus` = 当前工作流状态
- `workflowStatusSource` = `system | manual`
- `workflowStatusUpdatedAt` = 当前状态最后更新时间

### 绝对禁止
- 把系统建议状态和人工状态重新合并回一个字段
- 让导入过程直接覆盖人工状态

## 4.2 人工沉淀保护
以下内容属于人工资产：
- `notes`
- `workflowStatus`（当 `workflowStatusSource === 'manual'`）

导入时必须保护，不能被二次导入冲掉。

## 4.3 系统可刷新内容
这些内容允许随着导入变化：
- `rps`
- 导入时间
- 批次号
- 原始商品数据字段
- `rps.suggestedStatus`

---

# 5. 当前已解决的关键问题

## 已完成的核心项
- 导入防覆写
- 系统状态与人工状态解耦
- stableProductId 加固
- 导入失败摘要可视化
- 导入结果统计
- 自适应布局
- 导入状态机
- 导入 stepper
- 查询性能第一轮优化（keyword debounce + 过滤顺序优化）
- 核心单元测试（merge / stableProductId / 统计 / 错误摘要）
- 专用工作台增强（行级高亮 + 工作流捷径）

---

# 6. 当前 UI / 工作流特征

## 6.1 表格行级高亮
当前表格有三类重点视觉提示：
- **人工接管**：蓝色侧边强调
- **状态分叉**：黄色侧边强调
- **高分待处理**：绿色侧边强调

## 6.2 工作流捷径
筛选器里已有：
- 只看人工接管
- 只看状态分叉
- 只看高分待处理

这些不是泛化需求，而是为了让助理自己快速继续工作。

## 6.3 导入反馈
导入区目前有：
- 阶段 stepper
- 当前阶段
- 进度
- 最近消息
- 新增/更新/保留统计
- 失败摘要

---

# 7. 当前项目规则

## 7.1 Dexie 读取规则
所有数据库读取默认必须使用：
- `useLiveQuery`

禁止把数据库数据手动同步到 React state 里长期维护。

## 7.2 Worker 规则
本项目使用 Vite，Worker 写法必须是：

```ts
new Worker(new URL("../workers/score.worker.ts", import.meta.url), { type: "module" })
```

## 7.3 小步开发规则
每次只做一个原子任务：
1. 改代码
2. 跑测试
3. 跑 build
4. commit

不要一次改很多无关点。

## 7.4 失败处理规则
如果连续几轮修不对：
- 停止 patch
- 回到上一个稳定提交
- 换更清晰的 prompt

不要继续在脏状态上叠补丁。

---

# 8. 当前目录中最关键的文件

## 数据模型 / 语义
- `src/types/product.ts`
- `src/lib/db.ts`

## 查询 / 规则
- `src/lib/productQuery.ts`
- `src/domain/rps.ts`

## 导入链路
- `src/workers/score.worker.ts`
- `src/hooks/useScoreWorker.ts`

## UI 核心
- `src/App.tsx`
- `src/components/import/ImportSection.tsx`
- `src/components/discovery/FilterSidebar.tsx`
- `src/components/discovery/ProductTable.tsx`
- `src/components/detail/DetailDrawer.tsx`

## 协作规范
- `AGENT_RULES.md`
- `PROMPT_TEMPLATES.md`

---

# 9. 当前最适合继续做的方向

如果继续按“专用工作台”方向推进，优先考虑：

## 高优先级
1. **继续处理队列**
   - 快速看到“今天最该继续处理的商品”
2. **备注结构化增强**
   - 让 notes 更像决策沉淀，而不是散乱文本
3. **查询 profiling / 可观测性**
   - 了解筛选性能与结果分布

## 中优先级
4. **失败清单导出**
5. **更细的导入恢复语义**
6. **更多专用工作流视图**

## 低优先级 / 暂缓
- 云同步
- 权限系统
- 多账号
- 富文本备注
- 重型后端化
- 复杂图表

---

# 10. 接手前请先确认的三件事

新 Agent 接手时，先确认：

1. **这次任务是改 UI、改查询、改导入，还是改 schema？**
2. **这次任务会不会触碰人工状态 / notes / merge 保护？**
3. **这次任务是否真的值得为“单用户专用工作台”增加复杂度？**

如果第 2 条答案是“会”，必须先读取：
- `src/types/product.ts`
- `src/lib/db.ts`
- `src/workers/score.worker.ts`

---

# 11. 一句话记住这个项目

> **这是一个本地优先、以持续选品工作为核心、优先保护人工判断沉淀的专用工作台。**

任何改动，都应该服务于这个目标，而不是把它推向一个过早复杂化的平台。
