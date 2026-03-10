# RUNBOOK.md - Master

## 目标

说明 Master 这套系统应该如何实际使用、如何运行、如何排查问题。

这份文件不负责再解释理念，
它只回答：

1. 这套东西怎么喂数据
2. 这套东西怎么出结果
3. 结果怎么渲染
4. 出问题时先查哪里

---

# 一、Master 的使用定位

Master 目前是一个 **A 股三层联动决策引擎规格包**。

它不是：
- 自动交易系统
- 高频盘中程序
- 可直接运行的量化终端

它当前最适合的使用方式是：

## 使用方式 A：LLM 驱动的半自动分析系统
输入结构化市场数据 → 让 LLM 输出合法 JSON → 下游渲染为日报 / 候选池

## 使用方式 B：人工 + LLM 协同系统
人工先整理关键市场数据 → LLM 做三层判断 → 人工复核主线和危险标签

当前最推荐：
**先做方式 A 的日线版。**

---

# 二、推荐运行链路

Master 的最小运行链路建议如下：

## Step 1：准备输入数据
准备三类输入：

### 1. 市场环境数据
- 指数
- 两市成交额
- 上下家数
- 涨停 / 跌停 / 炸板
- 连板高度
- 北向资金（可选）

### 2. 板块题材数据
- 板块涨跌幅
- 板块成交额
- 板块龙头
- 板块中军
- 板块跟风数量
- 板块阶段标签（若有）

### 3. 个股候选池数据
- 候选股 OHLCV
- 均线结构
- 所属题材
- 流通市值 / 连板数 / 封单强度（若有）

---

## Step 2：整理为结构化输入
建议把输入整理成 JSON，对应 `DATA.md` 里的字段。

### 建议输入对象
- `market_snapshot`
- `theme_snapshot[]`
- `stock_snapshot[]`

不要直接把网页文本一股脑塞给模型。

---

## Step 3：调用 LLM
调用方式：
- System Prompt 使用 `PROMPT.md`
- 输出契约使用 `SCHEMA.json`
- 评分逻辑参考 `SCORING.md`
- 标签判定参考 `TAGING_RULES.md`
- 校准样例参考 `SAMPLES.md` 与 `samples/`

### 关键原则
LLM 在这一层：
**只负责决策 JSON 输出，不负责最终 Markdown 排版。**

---

## Step 4：校验输出
LLM 输出后，先做两步检查：

### 检查 1：Schema 校验
- 是否为合法 JSON
- 是否满足 `SCHEMA.json`
- 必填字段是否缺失

### 检查 2：逻辑校验
重点检查：
- `environment_label` 是否与 `market_score` 大致匹配
- `allow_level_2` 与环境标签是否冲突
- 板块若为“退潮反抽”，个股是否还被高评级推荐
- 跟风 / 杂毛是否混进“重点跟踪”

---

## Step 5：渲染输出
校验无误后，再由下游渲染：

### 渲染目标 A：日报
使用：
- `REPORT_TEMPLATE.md`

### 渲染目标 B：候选池
使用：
- `CANDIDATE_TEMPLATE.md`

### 渲染原则
- 决策层 = JSON
- 展示层 = Markdown / 表格 / 消息卡片

不要反过来让 LLM 直接生成最终报告。

---

# 三、推荐的日常运行节奏

## 当前默认：3–5 天实盘观察模式（指数模式）

Master 现在默认不做个股筛选，进入 **指数 / 主线 / 情绪** 观察模式。

### 每日运行时间
- **收盘后 15:30 - 18:00** 跑一次主流程
- 暂不要求盘中频繁刷新

### 固定运行命令
在工作区执行：

```bash
cd /Users/axiao/.openclaw/workspace

python3 Master/main.py \
  --source live-akshare \
  --out-dir Master/out-daily \
  --fallback-example-output-on-fail
```

### 命令含义
- `--source live-akshare`：用真实 A 股数据采集
- `--out-dir Master/out-daily`：每天固定覆盖同一个最新输出目录
- `--fallback-example-output-on-fail`：当前已改成**优先走本地规则 fallback**，不是优先走示例输出

### 每日产物
固定看这 4 个文件：
- `Master/out-daily/decision.json`
- `Master/out-daily/logic-warnings.json`
- `Master/out-daily/daily-report.md`
- `Master/out-daily/candidate-pool.md`

### 用户只看什么
当前阶段，用户只需要看 `daily-report.md` 里的 **当日复盘判断 5 句**：
1. 今天环境判断
2. 今天主线识别
3. 今天最有效信号
4. 今天最大风险
5. 明天最该盯的点

### 当前阶段不看什么
- 不看个股候选池
- 不看模拟买卖点
- 不把 `candidate-pool.md` 当股票池使用

### 连续观察目标
连续跑 **3–5 个交易日**，重点观察：
- 环境判断是否稳定
- 主线识别是否漂移
- 板块排序是否符合市场直觉
- 本地 fallback 是否过于保守或过于激进

## 模式 1：收盘后主流程（推荐）
这是当前最适合 Master 的方式。

### 运行时间
- 收盘后 15:30 - 18:00

### 产出
- 当日市场环境判断
- 当前主线 / 次主线 / 退潮方向
- 指数模式观察清单
- 风险提示
- 次日观察重点

---

## 模式 2：盘前摘要

### 运行时间
- 次日开盘前

### 产出
- 今日一句话策略
- 今日适合打法
- 今日严禁打法
- Top 3 重点盯盘对象

---

## 模式 3：盘中增强（后续）
当前不建议优先做。

后续可增加：
- 龙头炸板监控
- 中军失速监控
- 退潮扩散监控
- 新主线穿越监控

---

# 四、推荐输入格式示例

## 市场环境输入示例
```json
{
  "trade_date": "2026-03-10",
  "market_turnover_total": 8650,
  "up_count": 2890,
  "down_count": 2130,
  "limit_up_count": 46,
  "limit_down_count": 7,
  "blowup_rate": 0.28,
  "highest_board": 5,
  "northbound_net_inflow": 12.4
}
```

## 板块输入示例
```json
[
  {
    "theme_name": "AI算力",
    "theme_turnover_ratio": 0.11,
    "theme_limit_up_count": 9,
    "theme_highest_board": 4,
    "theme_leader_stock": "XX科技",
    "theme_midcap_core_stock": "XX通信"
  }
]
```

## 个股输入示例
```json
[
  {
    "symbol": "000001",
    "name": "XX科技",
    "circulating_market_cap": 186,
    "board_count": 4,
    "days_since_last_limit_up": 0,
    "main_theme_name": "AI算力"
  }
]
```

---

# 五、推荐输出格式示例

Master 的标准产物应该长这样：

## 决策层输出
- 合法 JSON
- 符合 `SCHEMA.json`
- 包含 reasoning 字段

## 展示层输出
- 日报 Markdown
- 候选池 Markdown
- 可选：表格 / 卡片 / 消息摘要

---

# 六、最常见问题与排查方式

## 问题 1：模型输出很散，不稳定

### 典型表现
- 今天同样数据说“进攻”，明天说“混沌”
- 同一只票一天叫龙头，一天叫跟风

### 先查
1. `PROMPT.md` 是否明确要求只输出 JSON
2. `SCHEMA.json` 是否有 reasoning 字段
3. `TAGING_RULES.md` 是否已注入或被参考
4. 输入数据是否缺了关键字段（如流通市值、连板数）

---

## 问题 2：模型总把后排跟风写成机会

### 先查
1. 个股输入里是否有 `board_count`
2. 是否有 `circulating_market_cap`
3. 板块是否其实已经进入退潮 / 强分歧
4. `TAGING_RULES.md` 中的角色规则有没有真正被执行

---

## 问题 3：模型把退潮反抽当二波

### 先查
1. 板块输入里是否有 `theme_turnover_ratio`
2. 中军是否真的强化
3. 龙头是否恢复带动性
4. 是否把“熟悉的老龙头反弹”误认为主线回归

---

## 问题 4：输出 JSON 合法，但动作很奇怪

### 先查
1. `SCORING.md` 是否和 `DATA.md` 字段匹配
2. 是否存在上层结论没有成功压制下层
3. 是否存在 reasoning 与 action 明显冲突

---

# 七、运行时的强制复核问题

每次产出结果前，必须复核这 5 个问题：

1. 当前环境真的允许推荐出手吗？
2. 当前主线真的是主线，而不是脉冲热点吗？
3. 这只票真的是核心，而不是后排或杂毛吗？
4. 这是不是退潮中的反抽诱多？
5. 结论和理由是否一致？

如果其中任意一个问题答不清，必须降级结论。

---

# 八、当前最推荐的落地方式

如果今天就要让 Master 跑起来，我建议最小版本这样做：

## 最小版 Master 流程
1. 人工整理市场、板块、个股数据为 JSON
2. 把 JSON + `PROMPT.md` + `SCHEMA.json` 喂给 LLM
3. 校验返回 JSON
4. 用脚本把 JSON 渲染成日报和候选池

## 暂时不要做的事
- 不要直接让模型读一堆网页原文
- 不要直接让模型手写长日报
- 不要上来就做盘中秒级监控
- 不要过早碰仓位管理和高频模块

---

# 九、一句话总结

Master 的正确用法是：

## **把它当作一个严格吃结构化输入、严格吐结构化决策的 A 股判断引擎，而不是一个自由发挥的股评机器人。**