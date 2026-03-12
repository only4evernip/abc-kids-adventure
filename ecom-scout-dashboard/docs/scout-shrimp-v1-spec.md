# 选品侦察虾 V1 架构说明书

## 1. 目标

选品侦察虾 V1 的目标不是“全网搜索引擎”，而是一个**稳定产卡引擎**：

> 输入一个方向 brief，经过固定信息源检索、证据提炼与保守判断后，输出一张符合 `scout-card.v1` 的结构化侦察卡。

V1 必须优先保证：
- 输入稳定
- 输出稳定
- 证据门槛稳定
- 角色边界稳定

而不是追求：
- 平台覆盖最多
- UI 最花
- 自动化程度最高

---

## 2. V1 范围

### 2.1 V1 要做
- 接收 `scout-brief.json`
- 基于固定白名单信息源做侦察
- 提炼三类证据：需求 / 痛点 / 竞争或风险
- 生成保守初判的 `scout-card.v1`
- 产物可直接导入 `ecom-scout-dashboard`

### 2.2 V1 不做
- TikTok / 小红书 / YouTube / B站评论区接入
- 前端“一键联网生成”按钮
- 多阶段 Agent 编排平台
- 自动直接写 Feishu
- 激进型 go/no-go 决策

---

## 3. 输入契约：`scout-brief.json`

### 3.1 结构

```json
{
  "version": 1,
  "keyword": "posture corrector",
  "market": "US",
  "language": "en",
  "platformFocus": ["Amazon US"],
  "researchGoal": "需求验证 + 竞争初筛 + 风险排查",
  "notes": "优先看用户是否愿意为智能提醒功能付费"
}
```

### 3.2 字段定义
- `version`: 当前固定为 `1`
- `keyword`: 必填，侦察主关键词
- `market`: 必填，V1 仅允许 `US` / `CA`
- `language`: 默认 `en`
- `platformFocus`: 可选，平台焦点列表
- `researchGoal`: 可选，说明这次侦察重点
- `notes`: 可选，人类补充上下文

### 3.3 校验规则
- `keyword` 不能为空
- `market` 必须属于 `US | CA`
- 未提供 `language` 时补 `en`
- 未提供 `platformFocus` 时允许空数组

---

## 4. 输出契约：`scout-card.v1`

V1 输出必须符合现有 `scout-card.v1`，不得自由发挥。

### 4.1 最低必填字段
- `schemaVersion`
- `cardId`
- `createdAt`
- `updatedAt`
- `topic`
- `signals`
- `insights`
- `decision`
- `evidence`
- `workbench`

### 4.2 证据门槛
一张有效侦察卡，至少满足：
- 1 条**需求证据**
- 1 条**痛点/客诉证据**
- 1 条**竞争或风险证据**

如果达不到，允许产卡，但必须：
- 降低 `confidence`
- 在 `reasonSummary` 里明确写“证据不足”
- `preliminaryDecision` 优先使用 `watch`

### 4.3 结论边界
V1 允许输出：
- `go-deeper`
- `watch`
- `drop`

但默认应保守：
- 证据一般 → `watch`
- 风险明显 / 红海明显 / 合规明显 → `drop`
- 只有当需求、痛点、切口三者都比较扎实时，才给 `go-deeper`

---

## 5. 信息源白名单

### 5.1 V1 固定白名单
1. Google / 普通网页
2. Reddit
3. 论坛 / 博客 / 长文文章
4. Amazon Listing / Reviews（能稳定读取时）

### 5.2 V1 暂缓源
- TikTok
- 小红书
- YouTube
- B站
- 抖音

### 5.3 设计原因
V1 的目标是稳定产卡，不是全网覆盖。
短视频和社媒平台的结构化抽取复杂度高、噪音大、稳定性差，不适合作为第一批硬接入源。

---

## 6. 侦察执行管线

V1 采用固定 6 步管线。

### Step 1：接收 Brief
读取 `scout-brief.json`，规范化输入。

### Step 2：收集需求证据
围绕关键词查找：
- 用户是否主动寻找解决方案
- 是否有真实问题描述
- 是否存在持续讨论

### Step 3：收集痛点证据
围绕评论、帖子、论坛内容提炼：
- 高频抱怨
- 使用失败原因
- 不满意点
- 期待改进点

### Step 4：收集竞争与风险证据
关注：
- 市场成熟度
- 是否明显红海
- 是否品牌垄断
- 是否存在合规 / 侵权 / 安全风险
- 是否可能广告成本过高

### Step 5：形成保守初判
输出：
- `demandSignal`
- `competitionSignal`
- `confidence`
- `preliminaryDecision`
- `reasonSummary`

### Step 6：产出 `scout-card.v1`
所有证据、判断与 workbench 初始字段统一落到结构化 JSON。

---

## 7. Prompt 执行模型

V1 不做自由对话式侦察，采用“双层 Prompt”模型。

### 7.1 Research Prompt
负责：
- 读取 brief
- 按白名单信息源检索
- 提取需求 / 痛点 / 风险 / 竞争证据
- 输出中间研究摘要

### 7.2 Card Prompt
负责：
- 将研究摘要转换成 `scout-card.v1`
- 严格按 schema 输出 JSON
- 不允许补写无法被证据支撑的结论

### 7.3 守则
- 证据不足时必须降置信度
- 不允许把“猜测”伪装成“证据”
- 不允许为了产卡而强行产出高结论

---

## 8. 角色边界

### 侦察虾负责
- 找证据
- 提炼痛点
- 做初步判断
- 输出 Scout Card

### 数据操盘虾负责
- 导入工作台
- 结构化沉淀
- 批量同步 Feishu
- 维护候选池与队列

### 决策军师虾负责
- 读取已有候选池 / 卡片 / 日报
- 做优先级排序
- 输出 go/no-go 与下一步行动建议

V1 必须守住边界：
> 侦察虾是前线侦察兵，不是最终总指挥。

---

## 9. 文件流形态

V1 执行形态采用：

- 输入：`scout-inputs/*.json`
- 输出：`scout-outputs/*.scout-card.json`

这样可以保证：
- 方便批量跑
- 方便回放
- 方便调 Prompt
- 方便导入工作台
- 方便后续接 cron / ACP / 子 Agent

---

## 10. 成功标准

侦察虾 V1 视为成功，需要满足：

1. 能稳定读取 `scout-brief.json`
2. 能稳定输出合法 `scout-card.v1`
3. 产出的卡能直接导入 `ecom-scout-dashboard`
4. 至少 3 个真实关键词样本跑通
5. 输出内容不是空话，确实带证据、痛点与风险
6. 在证据不足时会保守收敛，而不是胡乱强判

---

## 11. 一句话定义

> 选品侦察虾 V1 不是全能搜索系统，而是一台以固定白名单信息源为基础、按保守证据门槛稳定产出 `Scout Card` 的本地产卡引擎。
