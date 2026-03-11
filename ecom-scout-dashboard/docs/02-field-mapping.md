# CSV 字段映射表

基于现有样本文件：`候选品侦察池_US_CA.csv`

## 1. 当前原始字段（24列）

| 序号 | 原字段 | 归一化字段 | 类型 | 备注 |
|------|--------|------------|------|------|
| 1 | 调研日期 | researchDate | string | YYYY-MM-DD |
| 2 | 市场 | market | enum | 美国/加拿大/... |
| 3 | 平台站点 | platformSite | string | Amazon US / Amazon CA |
| 4 | 关键词 | keyword | string | 搜索词 |
| 5 | 细分方向 | nicheDirection | string | 如：核心交易词 |
| 6 | 产品方向 | productDirection | string | 如：止鼾口腔装置 |
| 7 | ASIN | asin | string | 可为空 |
| 8 | 产品标题 | title | string | 可为空 |
| 9 | 品牌 | brand | string | 可为空 |
| 10 | 产品链接 | productUrl | string | 可为空 |
| 11 | 当前价格 | currentPrice | number \| null | 需要 trim + parse |
| 12 | 当前BSR | currentBsr | number \| null | 需要 trim + parse |
| 13 | 当前评分 | currentRating | number \| null | 需要 trim + parse |
| 14 | 评论数 | reviewCount | number \| null | 需要 trim + parse |
| 15 | 30天评论增长 | reviewGrowth30d | number \| null | 需要 trim + parse |
| 16 | 核心卖点 | coreSellingPoints | string | 文本 |
| 17 | 高频差评点 | topComplaintPoints | string | 文本 |
| 18 | 高频想要点 | desiredPoints | string | 文本 |
| 19 | 头部垄断程度 | headMonopoly | enum | 低/中/高/极高 |
| 20 | 竞争激烈度 | competitionLevel | enum | 低/中/高/极高 |
| 21 | 总体风险等级 | overallRisk | enum | 低/中/高/极高 |
| 22 | 初筛结论 | initialConclusion | string | 人工字段 |
| 23 | 下一步动作 | nextAction | string | 人工字段 |
| 24 | 结论摘要 | conclusionSummary | string | 人工摘要 |

---

## 2. 当前 CSV 已能支持的能力

### 已支持
- 需求趋势评分：`reviewGrowth30d`
- 市场体量评分：`currentBsr`
- 竞争壁垒评分：`reviewCount`
- 风险乘数：`overallRisk`
- 垄断/竞争评分：`headMonopoly`、`competitionLevel`
- 黄金区间评分：`currentRating`
- 文本洞察：`topComplaintPoints`、`desiredPoints`
- 人工干预：`initialConclusion`、`nextAction`

### 还不够
当前 CSV **缺少 6 个关键字段**，所以只能做到 RPS v1，做不到完整 Eligibility Gate。

---

## 3. 建议补充字段（v2 必补）

| 建议字段 | 类型 | 为什么必须补 |
|----------|------|-------------|
| estimatedUnitMargin | number | 单件利润额，不然无法识别“高需低利陷阱” |
| contributionMarginRate | number | 毛利率，比单纯价格阈值更靠谱 |
| complianceRisk | enum | 合规/认证风险，不能只看总体风险 |
| supplyChainFeasibility | enum | 供应链能不能做出破局点 |
| sizeWeightRisk | enum | 体积重/FBA 物流风险 |
| returnRisk | enum | 易退货类目会直接吃掉利润 |

---

## 4. 未来建议派生字段

系统不一定要求 CSV 原始提供，可以在导入后派生：

| 派生字段 | 来源 | 用途 |
|----------|------|------|
| eligibilityStatus | 规则计算 | pass / review / reject |
| rejectionReasonTags | 规则计算 | 一票否决原因 |
| rpsScore | 规则计算 | 最终优先级分 |
| rpsLevel | 规则计算 | strong / watch / hold / reject |
| opportunityScore | 规则计算 | 机会分子项 |
| confidenceMultiplier | 缺失字段统计 | 置信度折损 |
| overheatingPenalty | 规则计算 | 过热惩罚 |
| falsePositiveTags | 规则计算 | 高需低利 / 创新空间锁死 等 |

---

## 5. 定性字段标准化

以下字段必须统一标准值，不允许自由发挥：

### 头部垄断程度 / 竞争激烈度 / 总体风险等级
允许值：
- 低
- 中
- 高
- 极高

### supplyChainFeasibility（建议新增）
允许值：
- 可直接落地
- 可验证
- 存疑
- 不可落地

### sizeWeightRisk（建议新增）
允许值：
- 低
- 中
- 高
- 极高

---

## 6. 字段设计原则

1. **所有评分维度尽量同向**：越高越好
2. **定性字段先标准化，再打分**
3. **空值不能偷偷当 0 分**，要进入置信度折损
4. **人工字段保留，但必须留痕**

---

## 7. 结论

当前这份 CSV 已经足够支持：
- RPS v1
- 机会分层
- 基础流转
- VOC 页面

但如果要做到真正能拍板的系统，下一步必须补：
- 利润字段
- 合规字段
- 供应链字段
