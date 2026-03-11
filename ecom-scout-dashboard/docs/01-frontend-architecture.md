# 前端架构方案（本地运行 / 无后端 / 数据产品）

## 1. 目标

这是一个 **本地可运行、无后端、偏数据产品** 的选品侦察网页。

核心目标不是“展示数据”，而是：

1. **先淘汰不该做的方向**
2. **再对剩余候选做优先级排序**
3. **最后强制流转到下一步动作**

所以，前端不只是 UI，而是一个带规则引擎的本地工作台。

---

## 2. 技术栈（我最终建议）

### 核心
- **Vite**
- **React + TypeScript**
- **Tailwind CSS**
- **shadcn/ui**

### 数据层
- **PapaParse**：CSV 解析
- **Zod**：字段校验 + 类型归一化
- **Zustand**：全局状态管理
- **Dexie / IndexedDB**：本地持久化

### 复杂视图
- **TanStack Table**：表格能力
- **@tanstack/react-virtual**：虚拟滚动
- **ECharts**：气泡图 / 高密度图表

### 性能层
- **Web Worker**：CSV 解析、RPS 评分、规则计算放 worker

---

## 3. 为什么是这套

### 为什么不是 Next.js
因为这是本地工具，不靠 SEO，也不需要 SSR。

### 为什么不是 Redux
因为是数据工具，不是大型多团队前台站点；Zustand 更轻、更直接。

### 为什么必须加 Zod
CSV 工具最怕的不是“没数据”，而是：
- 列名不统一
- 数字字段进来是字符串
- 空值、脏值、奇怪标签导致页面白屏

Zod 在这里不是可选项，是保险丝。

### 为什么必须加 Worker
后面一旦 CSV 上千行，再加：
- RPS 打分
- 一票否决
- 假阳性识别
- VOC 规则判断

主线程一定会卡。

---

## 4. 页面优先级

## MVP 只做 3 页

### Page 1：导入与校验页
功能：
- 上传 CSV
- 字段校验
- 缺失列提示
- 导入预览

### Page 2：选品发现矩阵（主战场）
功能：
- 超级筛选器
- 数据表格
- RPS 标签
- 一票否决标记
- 蓝海散点图

### Page 3：单品深挖页
功能：
- 产品画像
- VOC 差评 / 想要点
- Eligibility Gate 结果
- RPS 贡献条
- 下一步动作

## 暂缓
- Dashboard 总览
- 老板管理视图
- 过多花哨图表

---

## 5. 目录结构

```text
src/
├── app/
├── components/
│   ├── discovery/
│   ├── deepdive/
│   ├── import/
│   └── shared/
├── domain/
│   ├── eligibility.ts
│   ├── rps.ts
│   ├── tags.ts
│   └── workflow.ts
├── lib/
│   ├── csv-schema.ts
│   ├── fieldMap.ts
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

## 6. 状态管理原则

Store 里只存：
- `rawRows`
- `normalizedRows`
- `filters`
- `selectedRowId`
- `kanbanCards`
- `notes`
- `importMeta`
- `uiState`

**不要直接存**：
- `filteredRows`
- `sortedRows`
- `chartRows`

这些都应该是 selector / memo 派生状态。

---

## 7. 数据流水线

```text
CSV 上传
  -> PapaParse 解析
  -> Zod 校验
  -> 字段归一化
  -> Eligibility Gate
  -> RPS 评分
  -> 标签生成
  -> 入 Zustand / Dexie
  -> 页面消费
```

---

## 8. 工程约束

### 必须满足
- 本地运行
- 无后端依赖
- 可离线查看历史结果
- 可导出本地 session

### 不建议一开始上
- 聚类算法
- DuckDB-WASM
- 太复杂的图表系统
- 多层路由

---

## 9. 先做什么，不先做什么

### 先做
- 规则引擎
- CSV 字段映射
- 本地评分流水线
- 表格 + 筛选

### 后做
- 美化
- 花哨大盘
- 管理汇总页

一句话：

> **先让工具会判案，再让它看起来高级。**
