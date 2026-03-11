# 前端架构方案（Gemini 评审后重构版）

## 1. 目标

这是一个 **本地可运行、无后端、偏数据产品** 的选品侦察网页。

它不是普通 BI，也不是内容站。
它的核心目标是：

1. **先用规则排除不该做的方向**
2. **再对剩余候选做优先级排序**
3. **最后把分析强制推进到动作**

所以前端的本质不是“展示层”，而是一个 **本地规则工作台**。

---

## 2. 技术栈（重构后）

### 核心框架
- **Vite**
- **React + TypeScript**
- **Tailwind CSS**
- **shadcn/ui**

### 数据处理
- **PapaParse**：CSV 解析
- **Zod**：字段校验 + 归一化
- **Web Worker**：解析、校验、评分、入库

### 本地数据层
- **Dexie / IndexedDB**：主数据仓
- **dexie-react-hooks**：UI 查询层

### UI 状态层
- **Zustand**：只存 UI 状态

### 列表能力
- **TanStack Table**
- **@tanstack/react-virtual**

### 图表（延后）
- **ECharts**（不是 MVP 必做）

---

## 3. 这次最关键的架构修正

## 修正一：Dexie 是主仓，不是 Zustand

### 不再这样做
- Zustand 存 `rawRows`
- Zustand 存 `scoredRows`

### 改成这样
- CSV 解析后直接入 **Dexie**
- React 页面通过 `useLiveQuery` 从 Dexie 查数据
- Zustand 只放轻状态：
  - filters
  - sortModel
  - selectedRowId
  - drawerOpen
  - importProgress

### 原因
如果导入几千到几万行 CSV，把全量数据塞进 Zustand：
- React 状态树会膨胀
- DevTools 会卡
- 内存占用会飙升
- 筛选时会非常容易掉帧

---

## 4. Worker 职责（重构后）

Worker 不是可选项，而是主链路核心。

### Worker 负责
1. PapaParse 解析 CSV
2. Zod 校验列与字段
3. 字段归一化
4. Eligibility Gate
5. RPS 评分
6. 打标签（假阳性 / 过热 / 数据过期）
7. **bulkPut 到 Dexie**

### 主线程负责
1. 触发导入
2. 接收 Worker 进度
3. 渲染表格
4. 控制筛选 / 抽屉 / 动作栏

### 原则
主线程不要接收“几万行完整打分结果数组”。
主线程只接收：
- `done`
- `count`
- `errors`
- `batchId`

---

## 5. MVP 页面重排

## 第一版只做 2.5 页

### Page 1：导入页
功能：
- 上传 CSV
- 校验字段
- 显示缺失列
- 导入结果统计

### Page 2：发现矩阵（主战场）
功能：
- 左侧筛选器
- 中间高性能表格
- RPS 分数标签
- Eligibility Gate 标记
- 风险 / 假阳性标签

### Page 2.5：右侧详情抽屉（不是完整独立页）
功能：
- VOC 差评 / 想要点
- 打分明细
- 下一步动作
- 本地备注

## 暂缓
- Dashboard Overview
- 蓝海散点图
- 看板拖拽
- 雷达图
- 老板管理视图

---

## 6. 目录结构（重构后）

```text
src/
├── app/
├── components/
│   ├── import/
│   ├── discovery/
│   ├── detail/
│   └── shared/
├── domain/
│   ├── rps.ts
│   ├── eligibility.ts
│   ├── tags.ts
│   └── workflow.ts
├── lib/
│   ├── csvSchema.ts
│   ├── fieldMap.ts
│   ├── db.ts
│   └── formatters.ts
├── store/
│   └── useScoutStore.ts
├── types/
│   └── product.ts
├── workers/
│   └── score.worker.ts
└── main.tsx
```

---

## 7. 状态管理原则

### Dexie 存什么
- 全量产品记录
- 导入批次号
- RPS 结果
- workflowStatus
- 本地备注
- 标签

### Zustand 存什么
- 当前筛选条件
- 当前排序
- 当前选中的行
- Drawer 开关
- 当前导入进度
- UI 偏好

### 不要放进 Zustand 的东西
- 完整 CSV 数组
- 评分后的完整结果数组
- 图表聚合结果数组

---

## 8. 数据流水线

```text
上传 CSV
  -> PapaParse（worker）
  -> Zod 校验（worker）
  -> 字段归一化（worker）
  -> Eligibility Gate（worker）
  -> RPS 评分（worker）
  -> 标签生成（worker）
  -> Dexie bulkPut（worker）
  -> UI useLiveQuery 渲染表格
```

---

## 9. 为什么先不做图表

不是图表没用，而是第一版图表不值钱。

当前最该先打穿的是：

> **导入 → 判案 → 排序 → 查看详情 → 决定动作**

只要这条链路没通，散点图再漂亮也只是装饰品。

---

## 10. 最危险的坑

1. 把全量数据放 Zustand
2. 让 worker 把几万行完整数组 postMessage 回主线程
3. 太早上图表
4. 太早上复杂状态机拖拽
5. 还没跑真实 CSV 就先调 UI 细节

---

## 11. 一句话总结

> **先把本地数据链路打穿，再谈炫图和管理视图。**
