# SCOUT_WORKFLOW.md

选品侦察虾 V1 采用固定 6 步管线，目标不是“搜得越多越好”，而是**稳定产出可导入工作台的 Scout Card**。

## 1. 读取 Brief
- 输入：`scout-brief.json`
- 校验：`keyword / market / language / platformFocus / researchGoal / notes`
- 补默认值：`language=en`、`platformFocus=[]`

## 2. 收集需求证据
关注：
- 用户是否主动寻找解决方案
- 是否存在稳定讨论
- 是否是持续痛点，不是短期假热度

优先来源：
- Google / 普通网页
- Reddit
- 论坛 / 博客 / 长文

## 3. 收集痛点证据
关注：
- 高频抱怨
- 佩戴 / 使用 / 安装失败原因
- 用户明确表达的不满意点

优先来源：
- Amazon Reviews
- Reddit 评论区
- 论坛讨论

## 4. 收集竞争与风险证据
关注：
- 类目是否成熟
- 是否明显红海
- 是否品牌垄断
- 是否有合规 / 侵权 / 安全风险
- 是否广告成本可能失控

## 5. 形成保守初判
必须坚持：
- 证据充足才允许高置信度
- 缺失痛点或风险证据时，必须降级
- 证据不足时，`preliminaryDecision` 锁定为 `watch`

## 6. 输出 Scout Card
最终输出：
- `scout-card.v1`
- 可直接导入 `ecom-scout-dashboard`
- 可继续进入队列、判单、同步 Feishu

## V1 白名单来源
允许：
- Google / 普通网页
- Reddit
- 论坛 / 博客 / 长文
- Amazon

暂不允许：
- TikTok
- 小红书
- YouTube
- B站

## 一句话
> V1 的重点不是“全网无死角侦察”，而是“按固定来源和固定门槛，稳定产出可信的侦察卡”。
