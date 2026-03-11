# CSV 字段映射表（重构版）

基于现有样本文件：`候选品侦察池_US_CA.csv`

## 1. 当前原始字段（24列）

| 序号 | 原字段 | 归一化字段 | 类型 | 备注 |
|------|--------|------------|------|------|
| 1 | 调研日期 | researchDate | string | YYYY-MM-DD |
| 2 | 市场 | market | enum | 美国/加拿大/... |
| 3 | 平台站点 | platformSite | string | Amazon US / Amazon CA |
| 4 | 关键词 | keyword | string | 搜索词 |
| 5 | 细分方向 | nicheDirection | string | 当前可保留，后续建议收缩 |
| 6 | 产品方向 | productDirection | string | 主分析对象 |
| 7 | ASIN | asin | string | 可为空 |
| 8 | 产品标题 | title | string | 可为空 |
| 9 | 品牌 | brand | string | 可为空 |
| 10 | 产品链接 | productUrl | string | 可为空 |
| 11 | 当前价格 | currentPrice | number \| null | 需要 parse |
| 12 | 当前BSR | currentBsr | number \| null | v1 仅做弱辅助 |
| 13 | 当前评分 | currentRating | number \| null | 黄金区间判断 |
| 14 | 评论数 | reviewCount | number \| null | 壁垒强度 |
| 15 | 30天评论增长 | reviewGrowth30d | number \| null | 需求趋势 |
| 16 | 核心卖点 | coreSellingPoints | string | 后续建议切成数组 |
| 17 | 高频差评点 | topComplaintPoints | string | 后续建议切成数组 |
| 18 | 高频想要点 | desiredPoints | string | 后续建议切成数组 |
| 19 | 头部垄断程度 | headMonopoly | enum | 低/中/高/极高 |
| 20 | 竞争激烈度 | competitionLevel | enum | 低/中/高/极高 |
| 21 | 总体风险等级 | overallRisk | enum | 低/中/高/极高 |
| 22 | 初筛结论 | initialConclusion | string | 人工干预入口 |
| 23 | 下一步动作 | nextAction | string | 人工动作字段 |
| 24 | 结论摘要 | conclusionSummary | string | 人工摘要 |

---

## 2. 当前 CSV 能支持什么

### 已足够支持 v1
- 基础需求趋势：`reviewGrowth30d`
- 竞争壁垒：`reviewCount`
- 风险等级：`overallRisk`
- 竞争结构：`headMonopoly`、`competitionLevel`
- 黄金评分区间：`currentRating`
- VOC 文本展示：`topComplaintPoints`、`desiredPoints`
- 人工备注与动作：`initialConclusion`、`nextAction`

### 只能弱支持 / 暂时不可靠
- `currentBsr`

原因：当前没有 **大类目字段**，BSR 只能做弱辅助，不能重判。

---

## 3. 现在最该补的字段（优先级排序）

## P0：立刻补

| 字段 | 类型 | 原因 |
|------|------|------|
| bigCategory | string | 没有大类目，BSR 会严重失真 |
| sizeWeightBand | enum | 不知道体积重，就很难排除运费坑 |

建议 `sizeWeightBand` 枚举：
- 轻小件
- 标准件
- 大件
- 超大件

## P1：尽快补

| 字段 | 类型 | 原因 |
|------|------|------|
| estimatedUnitMargin | number | 没有单件利润，无法识别高需低利陷阱 |
| contributionMarginRate | number | 利润率是是否值得推进的硬门槛 |
| complianceRisk | enum | 不能只靠 overallRisk 一个总字段 |
| supplyChainFeasibility | enum | 不能只知道有痛点，还得知道能不能做 |

## P2：后续优化

| 字段 | 类型 | 原因 |
|------|------|------|
| avgCompetitorRating | number | 黄金区间要逐步从绝对值改成相对值 |
| returnRisk | enum | 高退货类目会直接吃掉利润 |
| seasonalityFlag | enum | 避免过期趋势误导 |

---

## 4. 现在最该改的字段设计

### 4.1 BSR 要降级
在补上 `bigCategory` 之前：
- BSR 不该做强判断
- 只能做辅助参考
- 在规则里必须降权

### 4.2 VOC 三个文本字段应尽快数组化
当前是：
- `coreSellingPoints: string`
- `topComplaintPoints: string`
- `desiredPoints: string`

后续建议在 worker 内切成：
- `string[]`

因为之后要支持：
- 词频统计
- VOC 分类
- 工程可解 / 文案可解 / 不可执行分类

### 4.3 nicheDirection 与 productDirection 易混淆
现在这两个字段都保留，但后续建议：
- 让 `productDirection` 成为主分析对象
- `nicheDirection` 只做补充标签

否则导入者很容易填乱。

---

## 5. 定性字段标准化

以下字段必须固定枚举，不允许自由文本：

### Level4 类字段
- 低
- 中
- 高
- 极高

适用：
- headMonopoly
- competitionLevel
- overallRisk
- complianceRisk（建议新增）

### 供应链可行性（建议新增）
- 可直接落地
- 可验证
- 存疑
- 不可落地

### 数据状态（系统派生）
- 正常
- 待补证
- 过期

---

## 6. 字段设计原则

1. **先保证规则能落地，不追求字段华丽**
2. **一票否决相关字段优先级高于图表字段**
3. **利润、体积、合规，优先级高于花哨文本分析**
4. **缺失字段不要偷偷当 0 分，应触发“待补证”**

---

## 7. 结论

当前这份 CSV 已经足够支持：
- Eligibility Gate v1
- RPS v1
- 基础标签系统
- 表格筛选与排序

但如果要走到真正能拍板的选品系统，下一步最该补：

1. `bigCategory`
2. `sizeWeightBand`
3. `estimatedUnitMargin`
4. `contributionMarginRate`
5. `supplyChainFeasibility`
