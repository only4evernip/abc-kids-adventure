# PIPELINE.md - Master

## 目标

把 Master 的整套运行链路串起来，说明：
- 输入从哪里来
- 中间如何处理
- LLM 在哪一层工作
- 输出如何校验
- 报告如何渲染

这份文件的作用，是把 `DATA.md`、`PROMPT.md`、`SCHEMA.json`、`RUNBOOK.md`、`REPORT_TEMPLATE.md`、`CANDIDATE_TEMPLATE.md` 连接成一条完整流水线。

---

# 一、Master 总体管线

Master 的推荐管线是：

## Pipeline Overview

```text
市场数据 / 板块数据 / 个股数据
        ↓
字段清洗与结构化
        ↓
输入 JSON（market_snapshot / theme_snapshot / stock_snapshot）
        ↓
LLM 决策层（PROMPT.md + SCHEMA.json）
        ↓
输出 JSON 校验
        ↓
逻辑校验 / 降级修正
        ↓
渲染层（日报 / 候选池 / 简报）
        ↓
最终交付
```

---

# 二、管线分层说明

## Layer 1：原始数据输入层

### 输入来源
- 指数行情
- 两市成交额
- 涨停 / 跌停 / 炸板 / 连板数据
- 板块涨跌幅 / 成交额 / 龙头 / 中军
- 候选池个股行情数据

### 目标
把分散的原始数据统一成结构化字段。

### 关键原则
- 原始网页文本不直接送给 LLM
- 先抽字段，再做判断

---

## Layer 2：结构化数据层

### 对应文档
- `DATA.md`

### 输出对象
- `market_snapshot`
- `theme_snapshot[]`
- `stock_snapshot[]`

### 目标
把市场环境、板块主线、个股候选统一成可喂给模型的 JSON 输入。

### 关键原则
- 缺关键字段时，不强行补脑
- 缺失字段可以为空，但不能伪造

---

## Layer 3：规则与标签层

### 对应文档
- `SCORING.md`
- `TAGING_RULES.md`

### 目标
在调用 LLM 前，先把规则体系和标签边界固定下来。

### 这一层负责什么
- 定义什么叫进攻 / 混沌 / 防守
- 定义什么叫主线 / 退潮 / 反抽
- 定义什么叫龙头 / 中军 / 跟风 / 杂毛
- 定义降级逻辑和危险标签

### 关键原则
这一层是 LLM 的护栏，不是展示材料。

---

## Layer 4：LLM 决策层

### 对应文档
- `PROMPT.md`
- `SCHEMA.json`

### 输入
- 结构化 JSON
- Prompt 规则
- Schema 输出契约

### 输出
- 严格合法 JSON
- 包含 reasoning 字段
- 包含市场、板块、个股三级结论

### 关键原则
- LLM 只负责决策
- LLM 不负责最终 Markdown 排版
- LLM 必须按 Level 1 → Level 2 → Level 3 顺序输出逻辑

---

## Layer 5：校验层

### 目标
拦截两类错误：
1. 格式错误
2. 逻辑错误

### 5.1 Schema 校验
检查：
- 是否是合法 JSON
- 是否符合 `SCHEMA.json`
- 必填字段是否缺失
- 枚举值是否合法

### 5.2 逻辑校验
检查：
- `environment_label` 与 `market_score` 是否明显冲突
- `allow_level_2` 是否与环境结论冲突
- 板块若为退潮，个股是否仍被高评级推荐
- 跟风 / 杂毛是否混进重点池
- reasoning 与 action 是否矛盾

### 关键原则
格式合法 ≠ 逻辑正确。
这一步不能省。

---

## Layer 6：渲染层

### 对应文档
- `REPORT_TEMPLATE.md`
- `CANDIDATE_TEMPLATE.md`

### 输入
- 已校验通过的 JSON

### 输出
- 日报 Markdown
- 候选池 Markdown
- 极简摘要
- 后续可扩展为消息卡片 / 表格 / 前端页面

### 关键原则
- 渲染层只负责展示
- 不重新发明判断逻辑
- 不在这一层偷偷改结论

---

# 三、最小可运行管线（MVP）

当前最推荐的最小流程：

## MVP Pipeline

### Step 1
人工或脚本收集当日市场数据

### Step 2
整理成输入 JSON

### Step 3
用 `PROMPT.md` + `SCHEMA.json` 调用模型

### Step 4
做 Schema 校验 + 逻辑校验

### Step 5
渲染出：
- 日报
- 候选池

### Step 6
人工快速复核主线与危险标签

---

# 四、推荐文件在管线中的位置

| 文件 | 管线位置 | 作用 |
|---|---|---|
| `DATA.md` | 结构化输入层 | 定义喂给系统的数据字段 |
| `SCORING.md` | 规则层 | 定义评分逻辑与降级规则 |
| `TAGING_RULES.md` | 标签层 | 固定最容易漂移的标签边界 |
| `PROMPT.md` | LLM 决策层 | 限制模型的分析顺序和输出方式 |
| `SCHEMA.json` | LLM 输出契约 | 强制结构化 JSON 结果 |
| `RUNBOOK.md` | 运维层 | 告诉人怎么跑、怎么排错 |
| `REPORT_TEMPLATE.md` | 渲染层 | 日报展示模板 |
| `CANDIDATE_TEMPLATE.md` | 渲染层 | 候选池展示模板 |
| `SAMPLES.md` / `samples/` | 校准层 | 防止模型输出漂移 |
| `examples/` | 示例层 | 固定最终成品样式 |

---

# 五、输入 JSON 建议结构

## 推荐顶层结构

```json
{
  "market_snapshot": {},
  "theme_snapshot": [],
  "stock_snapshot": []
}
```

### market_snapshot
负责喂：
- 环境判断
- 情绪周期
- 风险级别

### theme_snapshot
负责喂：
- 主线识别
- 板块阶段
- 龙头 / 中军 / 跟风结构

### stock_snapshot
负责喂：
- 个股角色
- 买卖点类型
- 风险提示
- 候选池排序

---

# 六、输出 JSON 建议结构

Master 决策层输出必须遵守：

```json
{
  "market_overview": {},
  "sector_analysis": [],
  "stock_analysis": []
}
```

### market_overview
最终市场环境结论

### sector_analysis
最终板块层判断

### stock_analysis
最终个股层判断

---

# 七、推荐的错误处理策略

## 错误类型 1：输入缺字段

### 表现
- 无法判断中军
- 无法区分主升和反抽
- 无法区分龙头和跟风

### 处理
- 降级输出
- 明确写“证据不足”
- 不强行给高评级

---

## 错误类型 2：输出 JSON 非法

### 处理
- 直接打回重试
- 不进入渲染层

---

## 错误类型 3：输出逻辑冲突

### 例子
- 环境防守，但动作却是“积极进攻”
- 板块退潮，但后排跟风被列为重点跟踪

### 处理
- 启动逻辑校验器
- 触发自动降级或人工复核

---

# 八、推荐的最小脚本职责划分

如果后面开始实现脚本，建议至少拆成这 4 块：

## 1. `collector`
负责采集原始数据

## 2. `builder`
负责把原始数据转成输入 JSON

## 3. `judge`
负责调用 LLM，获取符合 `SCHEMA.json` 的决策 JSON

## 4. `renderer`
负责把 JSON 渲染成日报 / 候选池 / 摘要

### 关键原则
不要让一个脚本同时负责：
- 抓数据
- 做判断
- 写日报
- 发消息

这样后面很难调试。

---

# 九、当前阶段不要做的事

在 Master 还处于 v1 / v1.1 时，不建议：
- 直接上盘中秒级分析
- 让 LLM 直接看大量原始网页文本
- 同时输出 JSON 和超长 Markdown
- 一开始就加仓位管理和自动交易
- 在没有稳定日线产出的前提下上复杂回测

---

# 十、一句话总结

Master 的正确管线应该是：

## **先把市场喂成结构化输入，再让模型做受限决策，再把结构化结果渲染成可读输出。**

如果跳过中间任意一层，系统都会变得不稳定。