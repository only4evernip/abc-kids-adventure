# DATA.md - st-reversal-radar 数据层设计

## 目标

为 `st-reversal-radar` 提供可落地的数据层蓝图，让 Agent 能从“会分析”进化到“有数据可分析”。

本文件聚焦：
1. 字段设计
2. 数据分层
3. 数据源建议
4. 日常运行流程
5. MVP 采集范围

---

## 一、数据分层

建议把数据拆成四层：

### L1. 股票池基础层
用于确定研究对象是谁。

字段：
- `symbol`：股票代码
- `name`：股票简称
- `st_type`：ST / *ST
- `st_reason`：被 ST 原因
- `industry`：所属行业
- `list_status`：上市状态
- `market`：沪深主板 / 创业板等

用途：
- 生成 ST/*ST 股票池
- 标记股票基础身份

---

### L2. 风险体检层
用于做死亡过滤器。

字段：
- `close_price`
- `price_20d_low`
- `price_60d_low`
- `face_value_delist_risk`
- `audit_opinion`
- `revenue_latest`
- `revenue_ttm`
- `deducted_profit_latest`
- `deducted_profit_ttm`
- `net_assets`
- `asset_liability_ratio`
- `capital_occupation_flag`
- `guarantee_violation_flag`
- `major_litigation_flag`
- `admin_penalty_flag`
- `investigation_flag`
- `debt_default_flag`
- `liquidity_risk_flag`

用途：
- 一票否决
- 生存安全分计算

---

### L3. 事件催化层
用于识别真实反转逻辑。

字段：
- `event_reorg_notice`
- `event_prereorg_notice`
- `event_court_accept`
- `event_investor_recruitment`
- `event_investor_confirmed`
- `event_state_owned_entry`
- `event_controller_change`
- `event_asset_injection`
- `event_asset_sale`
- `event_debt_restructuring`
- `event_debt_waiver`
- `event_profit_forecast_improve`
- `event_audit_issue_resolve`
- `event_hat_removal_signal`
- `event_regulatory_negative`
- `event_summary_6m`
- `event_timeline`

用途：
- 判断主逻辑
- 评估反转确定性
- 识别未来 1-6 个月催化剂

---

### L4. 赔率与时机层
用于判断“值不值得现在埋伏”。

字段：
- `market_cap_total`
- `market_cap_float`
- `drawdown_from_high`
- `avg_turnover_20d`
- `avg_amount_20d`
- `shareholder_count_change`
- `top10_holder_change`
- `major_holder_change`
- `pledge_ratio`
- `freeze_ratio`
- `price_position_20d`
- `price_position_60d`
- `price_position_120d`
- `stage_label`：萌芽 / 强化 / 兑现 / 衰退
- `next_key_dates`
- `theme_resonance`

用途：
- 赔率弹性分
- 时间窗口分
- 阶段判断

---

## 二、核心字段优先级

不是所有字段都必须第一天就接。

### P0：MVP 必须有
没有这些，Agent 几乎无法做出像样判断。

- 股票代码 / 名称
- ST/*ST 类型
- 被 ST 原因
- 当前价格
- 总市值 / 流通市值
- 最近年度营收
- 最近年度扣非净利润
- 最近一期净资产
- 审计意见
- 是否资金占用 / 违规担保
- 最近 6 个月关键公告摘要
- 是否预重整 / 重整
- 是否法院受理
- 是否招募 / 确定投资人
- 是否实控人变更 / 国资入主
- 最近 20/60 日价格位置

### P1：第二阶段增强
- 股东人数变化
- 前十大股东变化
- 大股东增减持
- 质押 / 冻结比例
- 债务和解 / 豁免细节
- 历史高点回撤幅度
- 主题共振标签

### P2：后续优化
- 公告情绪分类
- 历史案例相似度
- 量价结构特征
- 多周期事件跟踪打分
- 回测标签

---

## 三、数据源建议

## 1. 基础行情与财务
可选：
- AkShare
- Tushare
- Wind（如果有）
- 东方财富 / 同花顺网页公开信息（备选）

建议用途：
- 股票池
- 行情
- 财务指标
- 市值与流动性字段

---

## 2. 公告与事件
这是核心层，优先级最高。

建议来源：
- 巨潮资讯网
- 交易所公告
- 全国企业破产重整案件信息网
- 上市公司公告页面

重点抓取：
- 年报 / 业绩预告
- 审计意见
- 预重整 / 重整申请 / 法院受理
- 投资人招募 / 确认
- 实控人变更
- 债务和解 / 豁免 / 债转股
- 立案调查 / 行政处罚

---

## 3. 筹码与股东
可选：
- 东方财富 F10
- 同花顺 F10
- Wind / iFinD
- 公告披露

重点抓取：
- 股东人数变化
- 前十大流通股东变化
- 大股东质押 / 冻结 / 增减持

---

## 四、建议的数据结构

如果后面要接脚本或数据库，建议至少按这三个对象组织：

### 1. stock_master
基础股票表

```json
{
  "symbol": "000xxx",
  "name": "某ST",
  "st_type": "*ST",
  "st_reason": "财务类",
  "industry": "化工"
}
```

### 2. stock_snapshot
某一时间点的体检快照

```json
{
  "symbol": "000xxx",
  "date": "2026-03-09",
  "close_price": 2.31,
  "market_cap_total": 18.6,
  "market_cap_float": 12.2,
  "audit_opinion": "保留意见",
  "revenue_latest": 4.8,
  "deducted_profit_latest": -1.2,
  "capital_occupation_flag": false,
  "guarantee_violation_flag": true
}
```

### 3. stock_events
事件流表

```json
{
  "symbol": "000xxx",
  "event_date": "2026-02-28",
  "event_type": "court_accept",
  "title": "法院决定受理预重整",
  "summary": "公司收到法院决定书，进入预重整程序",
  "source": "cninfo"
}
```

---

## 五、Agent 的最小数据工作流

### Daily 流程
每天跑一次即可，不需要高频。

#### Step 1：更新 ST 股票池
- 拉取当日 ST / *ST 名单
- 同步基础身份字段

#### Step 2：更新风险快照
- 更新价格、市值、营收、利润、净资产、审计意见
- 打面值风险、流动性风险标记

#### Step 3：抓最近公告
- 抓最近 1-3 天公告
- 抽取与重整、摘帽、处罚、审计、债务相关事件

#### Step 4：重跑筛选
- 先做一票否决
- 再做反转逻辑识别
- 再给出候选池排序

#### Step 5：输出日报
- 拉黑新增名单
- 候选新增名单
- 逻辑强化名单
- 逻辑证伪名单

---

## 六、每周深度复盘工作流

每周做一次深度复盘，而不是只看日更。

输出：
- Top 10 可研究池变化
- 哪些票从观察升级到试错
- 哪些票从试错降级到回避
- 哪些票出现新的关键催化剂
- 哪些票出现新的红旗

这部分比日常扫描更接近真正决策。

---

## 七、MVP 建议

第一阶段只做最少的数据闭环：

### 必做
- ST 股票池
- 基础行情
- 核心财务
- 审计意见
- 最近 6 个月关键公告
- 预重整 / 重整 / 投资人 / 国资 / 实控人变更相关标签

### 暂缓
- 高频量价因子
- 复杂情绪分析
- 深度回测
- 盘中监控

原因很简单：
ST 的核心 alpha 不在分时，而在事件。

---

## 八、推荐的 v1 文件组织

建议这个 Agent 目录后续至少包含：

```text
st-reversal-radar/
├── AGENT.md           # Agent 身份与工作流
├── DATA.md            # 数据层设计
├── PROMPT.md          # 系统提示词（后续）
├── SCHEMA.json        # 数据字段结构（后续）
├── reports/           # 输出日报/周报
└── samples/           # 样例股票分析
```

---

## 九、下一步最适合做什么

如果继续推进，最值得立刻补的是：

1. `PROMPT.md`：让 Agent 说话和分析更稳定
2. `SCHEMA.json`：把字段结构正式化
3. `samples/`：做 2-3 个真实 ST 股票案例

优先级建议：
**PROMPT > SCHEMA > samples**
