# DATA.md - Master

## 目标

为 Master 提供一套可落地的数据层设计，让它从“会分析”走向“有数据可分析”。

Master 的核心不是囤积数据，而是把数据服务于三层联动：
1. Level 1：指数环境
2. Level 2：板块主线
3. Level 3：个股角色与买卖点

因此数据层必须围绕这三件事组织，而不是做成杂乱行情仓库。

---

# 一、数据分层设计

建议拆成 4 层：

## L1. 市场环境层
用于判断大势、流动性、赚钱效应、亏钱效应。

### 核心字段
- `trade_date`
- `sh_index_close`
- `sz_index_close`
- `cyb_index_close`
- `hs300_close`
- `zz500_close`
- `zz1000_close`
- `kc50_close`
- `market_turnover_total`
- `market_turnover_change`
- `up_count`
- `down_count`
- `limit_up_count`
- `limit_down_count`
- `blowup_count`
- `blowup_rate`
- `highest_board`
- `yesterday_limit_up_premium`
- `high_level_stock_drawdown_flag`
- `northbound_net_inflow`
- `market_environment_label`
- `emotion_cycle_label`

### 用途
- Level 1 评分
- 环境标签判断
- 风险警报触发

---

## L2. 板块与题材层
用于判断主线、轮动、周期位置、板块健康度。

### 核心字段
- `theme_name`
- `theme_type`（产业主线 / 情绪题材 / 政策题材 / 防御方向 / 超跌反弹）
- `theme_change_pct`
- `theme_turnover`
- `theme_turnover_change`
- `theme_turnover_ratio`（板块成交额占两市成交额比例）
- `theme_money_flow_ratio`（板块净流入 / 成交额，用于辅助判断拥挤与承接）
- `theme_limit_up_count`
- `theme_blowup_count`
- `theme_highest_board`
- `theme_leader_stock`
- `theme_leader_board_count`
- `theme_midcap_core_stock`
- `theme_core_stock_count`
- `theme_follow_count`
- `theme_health_status`
- `theme_stage_label`（启动 / 发酵 / 主升 / 强分歧 / 高位震荡 / 退潮 / 退潮反抽 / 一日游）
- `theme_is_main`
- `theme_is_secondary`
- `theme_retreat_flag`
- `theme_consensus_score`

### 用途
- Level 2 主线识别
- 主线 / 次主线 / 退潮方向判断
- 板块评分与排序

---

## L3. 个股层
用于识别个股角色、走势结构、买卖点与失效条件。

### 核心字段
- `symbol`
- `name`
- `close_price`
- `open_price`
- `high_price`
- `low_price`
- `pct_change`
- `turnover_amount`
- `turnover_rate`
- `volume_ratio`
- `circulating_market_cap`
- `total_market_cap`
- `board_count`（当前连板数）
- `days_since_last_limit_up`
- `is_recent_high_stock`
- `is_previous_cycle_core`
- `ma5`
- `ma10`
- `ma20`
- `ma60`
- `limit_up_flag`
- `limit_down_flag`
- `blowup_flag`
- `sealed_order_strength`
- `industry`
- `concept_tags`
- `main_theme_name`
- `stock_role_label`（总龙头 / 板块龙头 / 情绪龙头 / 趋势中军 / 核心补涨 / 跟风 / 杂毛 / 反抽股）
- `stock_stage_label`
- `matched_market_flag`
- `matched_theme_flag`
- `signal_type`
- `signal_score`
- `risk_warning`
- `invalid_condition`

### 用途
- Level 3 个股分析
- 角色识别
- 买卖点判断
- 候选池排序

---

## L4. 半结构化标签层
这是 Master 很关键的一层。

A 股很多最值钱的信息，不是纯行情字段，而是半结构化判断。

### 核心字段
- `theme_stage_manual_label`
- `emotion_cycle_manual_label`
- `stock_role_manual_label`
- `is_true_main_theme`
- `is_retreat_rebound`
- `is_fake_breakout`
- `is_high_risk_follow`
- `is_independent_trend_stock`
- `market_distortion_flag`
- `commentary`

### 用途
- 补足硬指标无法覆盖的主观判断
- 允许人工 / LLM 共同校正
- 给 Master 增加“懂 A 股语境”的能力

---

# 二、字段优先级

不是所有数据都要第一天接全。

## P0：MVP 必须有
这些字段没有，Master 基本跑不起来。

### 市场环境
- 两市成交额
- 上涨 / 下跌家数
- 涨停 / 跌停 / 炸板
- 连板高度
- 主要指数收盘价与均线位置

### 板块层
- 板块涨跌幅
- 板块成交额
- 板块涨停数
- 龙头股
- 中军股
- 板块阶段标签

### 个股层
- 个股 OHLCV
- 均线结构
- 涨停 / 炸板状态
- 所属题材
- 个股角色标签
- 当前信号类型

## P1：增强数据
- 北向资金
- 昨日涨停溢价率
- 封单强度
- 板块跟风数量
- 流通市值 / 总市值
- 连板数 / 距离上次涨停天数
- 板块成交额占比
- 退潮反抽标签
- 假突破标签

## P2：后续优化
- 分钟级大单净流入
- 监管关注 / 异动公告标签
- 题材热度 NLP 分析
- 舆情拥挤度
- 板块成交额占比
- 多日连续性评分

---

# 三、数据来源建议

## 1. 指数与基础行情
可选来源：
- AkShare
- Tushare
- 东方财富网页公开数据
- 同花顺网页公开数据

### 建议用途
- 指数价格与均线
- 个股 OHLCV
- 成交额与换手率
- 板块涨跌幅

---

## 2. 涨停 / 跌停 / 炸板 / 连板数据
这是 A 股情绪层的核心数据。

可选来源：
- 东方财富行情页
- 同花顺热榜 / 涨停复盘页
- 财联社 / 开盘啦 / 可替代网页源（如有接入）

### 建议用途
- 情绪周期识别
- 龙头高度判断
- 赚钱效应 / 亏钱效应判断

---

## 3. 板块与题材数据
可选来源：
- 东方财富板块页
- 同花顺概念板块页
- 财联社主题库（若有）
- 自定义题材映射表

### 建议用途
- 主线识别
- 板块周期判断
- 龙头 / 中军 / 跟风结构梳理

---

## 4. 北向资金与风格数据
可选来源：
- 东方财富北向资金页面
- 各类财经终端公开数据

### 建议用途
- 权重风格辅助判断
- 机构风险偏好辅助判断

---

## 5. 半结构化标签来源
建议来源：
- 规则引擎自动生成
- LLM 根据当日结构总结生成
- 人工校正

### 重要约束
半结构化标签不能只靠语感生成，必须尽可能绑定触发条件。

例如：
- `is_retreat_rebound = true`：前主线已进入退潮，且当日反弹未伴随中军强化、梯队重建、成交额放大
- `is_fake_breakout = true`：价格突破前高，但成交量/封板质量/板块跟随不足
- `is_high_risk_follow = true`：龙头已明显分歧或断板，而后排跟风股才出现脉冲涨停

### 典型标签
- 当前是主升还是退潮
- 当前板块是否为真主线
- 某票是龙头还是杂毛
- 某次上涨是真突破还是反抽

---

# 四、更新频率建议

## 日线级（P0 最先做）
适合 MVP：
- 收盘后更新一次
- 盘前生成次日分析

### 适用字段
- 指数收盘
- 成交额
- 涨跌停统计
- 板块涨跌幅
- 个股日线结构
- 主线与情绪周期标签

## 盘中级（P1 / P2 再做）
适合后续增强：
- 10:00
- 11:30
- 14:00
- 收盘后

### 适用字段
- 龙头炸板
- 封单强度变化
- 分时强弱
- 盘中大单净流入
- 主线强弱变化

---

# 五、建议的数据对象结构

建议至少组织成 3 个核心对象：

## 1. `market_snapshot`
存市场环境快照。

```json
{
  "trade_date": "2026-03-10",
  "market_turnover_total": 10350,
  "limit_up_count": 58,
  "limit_down_count": 4,
  "highest_board": 6,
  "environment_label": "进攻",
  "emotion_cycle_label": "主升"
}
```

## 2. `theme_snapshot`
存题材板块结构。

```json
{
  "theme_name": "AI算力",
  "theme_stage_label": "主升",
  "theme_leader_stock": "XX科技",
  "theme_midcap_core_stock": "XX通信",
  "theme_health_status": "健康",
  "theme_is_main": true
}
```

## 3. `stock_snapshot`
存个股结构化判断。

```json
{
  "symbol": "000001",
  "name": "示例科技",
  "stock_role_label": "趋势中军",
  "matched_market_flag": true,
  "matched_theme_flag": true,
  "signal_type": "回踩确认",
  "signal_score": 82,
  "action": "可择机建仓"
}
```

---

# 六、MVP 数据管线建议

建议分 4 步，不要一上来搞太重。

## Step 1：抓市场环境
- 指数
- 成交额
- 涨跌停
- 炸板率
- 上下家数

## Step 2：抓板块层
- 板块涨跌幅
- 板块成交额
- 板块涨停数
- 龙头 / 中军初步识别

## Step 3：抓个股层
- 候选股 OHLCV
- 均线结构
- 是否涨停 / 炸板
- 所属题材

## Step 4：打标签
- 主线标签
- 周期标签
- 个股角色标签
- 反抽 / 假突破 / 杂毛标签

---

# 七、最关键的现实提醒

Master 不可能只靠纯硬数据跑得很像人。

因为 A 股最值钱的判断往往是这些：
- 这是不是退潮反抽？
- 这是不是新主线启动？
- 这票到底是龙头还是杂毛？
- 这个板块是主升还是高潮尾声？

这些很多都不是单一字段能解决的。

所以 Master 的最佳数据架构一定是：

## **硬数据 + 规则引擎 + 半结构化标签 + 人工/LLM校正**

而不是迷信“只要数据够多就会自动变聪明”。

---

# 八、下一步建议

数据层完成后，建议继续补：
1. `ROADMAP.md`：版本规划
2. `WORKFLOW.md`：日常运行流程
3. `samples/`：真实案例
4. 后续再考虑抓取脚本或数据库结构
