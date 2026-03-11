# ecom-scout-dashboard

跨境电商选品侦察网页的 **v1 规则包 + 前端骨架（Gemini 评审后重构版）**。

## 这次重构的核心变化

我按 Gemini 的意见做了三刀减法：

1. **RPS 去乘法**
   - 去掉 `riskMultiplier`
   - 去掉 `confidenceMultiplier` 对总分的直接折损
   - 去掉 `overheatingPenalty` 的扣分逻辑
   - 改成：**线性打分 + 固定扣分 + 标签 + 状态分流**

2. **Dexie 变主数据仓**
   - 不再让 Zustand 存全量 CSV 数据
   - Zustand 只保留 UI 状态
   - 全量产品数据应写入 IndexedDB / Dexie

3. **MVP 收缩成表格优先**
   - 第一版先不上 Dashboard
   - 第一版先不上散点图
   - 第一版先不上拖拽 Kanban
   - 主战场就是：**导入 -> 评分 -> 表格 -> 筛选 -> 右侧详情抽屉**

---

## 当前输入样本

已基于工作区现有 CSV：

- `候选品侦察池_US_CA.csv`

当前字段共 24 列，已整理为字段字典。

---

## 当前最值钱的文件

### 文档
- `docs/01-frontend-architecture.md`
- `docs/02-field-mapping.md`
- `docs/03-rps-rules-v1.md`
- `docs/04-workflow-state-machine.md`

### 代码骨架
- `src/types/product.ts`
- `src/lib/fieldMap.ts`
- `src/lib/db.ts`
- `src/lib/csvSchema.ts`
- `src/domain/rps.ts`
- `src/store/useScoutStore.ts`
- `src/workers/score.worker.ts`

---

## 当前架构判断

现在这套方案不是“完整产品”，而是：

> **一个能继续往真实 CSV 导入链路推进的 v1 开发底座。**

也就是说，它已经适合进入：
- CSV 真实导入
- Zod 校验
- Worker 评分
- Dexie 入库
- TanStack Table 展示

但还不适合直接花时间堆图表和老板大盘。

---

## MVP 顺序（重排后）

### Phase 1：先跑通主链路
- CSV 上传
- PapaParse 解析
- Zod 校验
- Worker 内评分
- Dexie 入库
- 表格 + 筛选 + RPS 标签

### Phase 2：再加右侧详情
- VOC 差评 / 想要点
- 评分贡献拆解
- Eligibility Gate 结果
- 下一步动作
- 本地备注

### Phase 3：最后再扩展
- 散点图
- Dashboard
- 看板视图
- 更复杂的统计汇总

---

## 最自然的下一步

如果继续往下做，不该再先聊概念，而是应该直接做：

1. `csvSchema.ts` 接真实 CSV 列
2. `score.worker.ts` 真写 Dexie
3. `useLiveQuery` + TanStack Table 跑第一版数据表

---

_这版现在更适合拿去给 Gemini 做第二轮技术复审。_
