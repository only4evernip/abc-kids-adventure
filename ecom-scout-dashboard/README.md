# ecom-scout-dashboard

跨境电商选品侦察网页的 **v1 规则包 + 前端骨架**。

## 我这次先做什么

我没有直接先搭花哨界面，而是先把最容易返工的 5 件东西固定下来：

1. **字段字典**：把现有 CSV 字段映射成系统字段
2. **RPS 规则表 v1**：可执行的评分模型，不是空概念
3. **Eligibility Gate**：一票否决入口，先判能不能做
4. **状态机**：从“待评估”到“淘汰/供应链核价”的动作流转
5. **前端代码骨架**：后续真开工时不会从 0 开始

## 为什么不先做 Dashboard

因为这个工具的本质不是展示数据，而是：

> **用规则替代纠结，用证据驱动动作。**

如果规则层没定死，先做图表只会后面全部返工。

## 当前输入样本

已基于工作区现有 CSV：

- `候选品侦察池_US_CA.csv`

当前字段共 24 列，已经写进：

- `docs/02-field-mapping.md`

## 文档导航

- `docs/01-frontend-architecture.md`：前端技术架构
- `docs/02-field-mapping.md`：CSV 字段映射表
- `docs/03-rps-rules-v1.md`：RPS 评分规则 v1
- `docs/04-workflow-state-machine.md`：决策流转状态机
- `src/types/product.ts`：核心类型定义
- `src/lib/fieldMap.ts`：字段映射常量
- `src/domain/rps.ts`：评分逻辑代码骨架
- `src/store/useScoutStore.ts`：状态管理骨架
- `src/workers/score.worker.ts`：CSV 解析 / 评分 worker 骨架

## 我建议的 MVP 顺序

### 第 1 阶段：先能判
- CSV 导入
- 字段校验
- Eligibility Gate
- RPS 评分
- 列表筛选 + RPS 标签

### 第 2 阶段：再能深挖
- VOC 差评/想要点详情
- 破局点卡片
- 人工 override
- 状态流转看板

### 第 3 阶段：最后才做管理视图
- Dashboard 总览
- 筛选漏斗
- 周报/月报

## 后续接着怎么干

如果要继续往下做，最自然的顺序是：

1. 先补 CSV 缺失字段（利润、合规、供应链）
2. 再把 `src/domain/rps.ts` 接到真实 CSV 解析流程
3. 最后再上 React 页面

---

_这份包现在最适合拿去给 Gemini 做架构/规则复审。_
