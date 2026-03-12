# SCOUT_CARD_TO_FEISHU.md

Scout Card 到 Feishu Bitable 的第一版字段映射。

目标：

> 让选品侦察虾输出的结构化机会卡，可以稳定落到飞书多维表，而不是重新变回散乱文本。

---

## 1. 设计原则

1. **先做稳定映射，不做花哨自动化**
2. **保留事实与判断分层**
3. **优先可读、可筛选、可更新**
4. **第一版以单表单记录写入为主**

---

## 2. 推荐 Bitable 字段（v1）

| Feishu 字段名 | 类型建议 | 来源字段 | 说明 |
|---|---|---|---|
| Card ID | Text | `cardId` | 作为外部唯一标识，后续更新用 |
| 关键词 | Text | `topic.keyword` | 原始侦察关键词 |
| 产品方向 | Text | `topic.productDirection` | 归纳后的产品方向 |
| 市场 | SingleSelect / Text | `topic.market` | 如 US / CA |
| 平台焦点 | Text | `topic.platformFocus[]` | 多平台先拼成文本 |
| 语言 | Text | `topic.language` | 默认 en |
| 需求信号 | SingleSelect | `signals.demandSignal` | high / medium-high / medium / low |
| 竞争信号 | SingleSelect | `signals.competitionSignal` | high / medium-high / medium / low |
| 置信度 | SingleSelect | `signals.confidence` | high / medium / low |
| 用户痛点 | Text | `insights.painPoints[]` | 先拼为多行文本 |
| 风险提示 | Text | `insights.risks[]` | 先拼为多行文本 |
| 微创新机会 | Text | `insights.opportunities[]` | 先拼为多行文本 |
| 初步判断 | SingleSelect | `decision.preliminaryDecision` | go-deeper / watch / drop |
| 下一步 | Text | `decision.nextStep` | 下一动作 |
| 结论摘要 | Text | `decision.reasonSummary` | 一句话判断 |
| 工作流状态 | SingleSelect | `workbench.workflowStatus` | 待评估 / 观察池 / ... |
| 本地备注 | Text | `workbench.notes` | 侦察卡附带备注 |
| 标签 | Text | `workbench.tags[]` | 先拼为文本；后续可升多选 |
| 证据链接 | Text | `evidence[]` | 先拼成多行「来源 | 标题 | URL」 |
| 证据摘要 | Text | `evidence[]` | 先拼成多行摘要 |
| 创建时间 | DateTime / Text | `createdAt` | 侦察卡创建时间 |
| 更新时间 | DateTime / Text | `updatedAt` | 侦察卡更新时间 |
| Schema 版本 | Text | `schemaVersion` | 当前 schema 标识 |

---

## 3. 第一版不建议拆成单独子表的内容

这些字段以后可以升级成子表 / 关联表，但 v1 不建议先做：

- `evidence[]`
- `painPoints[]`
- `risks[]`
- `opportunities[]`

原因：
- 第一版先追求可写入、可查看、可筛选
- 不要一开始就把飞书结构做得太重

---

## 4. 更新策略

### Canonical Key
使用：
- `Card ID`

### 策略
- 如果 Feishu 中已存在相同 `Card ID`：执行 update
- 如果不存在：执行 create

### 不建议用作唯一键的字段
- 关键词
- 产品方向
- 市场

因为这些组合未来可能重复或多次侦察。

---

## 5. 推荐的字段值转换

### `demandSignal` / `competitionSignal` / `confidence`
保持英文枚举即可：
- `high`
- `medium-high`
- `medium`
- `low`

后续如果要更适配中文视图，再在飞书侧做映射。

### `painPoints` / `risks` / `opportunities`
建议先转成多行文本：

```text
- 佩戴不舒服
- 下巴疼
- 调节不稳
```

### `evidenceLinks`
建议先转成：

```text
Wirecutter | I Tried 6 Anti-Snoring Devices. The Smart Nora Worked Best. | https://...
Well Trained Mind | Mouth guard recs for snoring | https://...
```

### `evidenceSummary`
建议转成：

```text
Wirecutter: 赛道成熟，用户在舒适度和有效性之间权衡明显
Well Trained Mind: 用户会主动寻找口腔装置推荐，说明需求真实且迫切
```

---

## 6. v1 写入策略建议

### 最小版本
- 侦察虾输出 `Scout Card JSON`
- 本地 helper 转成 `FeishuScoutCardRecord`
- 数据操盘虾拿 `Card ID` 查询飞书
- 存在则 update，不存在则 create

### 这版先不做
- 批量 diff 合并
- evidence 子表联动
- 多表联动
- 富文本证据卡片

---

## 7. 建议的下一步

1. 先确定目标 Bitable 表结构
2. 用本地 helper 产出标准 record payload
3. 拿真实 Bitable URL 做一次最小 create / update 验证

---

## 8. 一句话

> 第一版 Feishu 映射的核心不是“映射得多复杂”，而是“侦察卡能稳定落表、可更新、可筛选、可继续给决策军师虾读取”。
