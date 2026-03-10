# Master

Master 是一套面向 **A 股市场** 的三层联动交易分析 Agent 规格包与最小可跑原型。

它的核心思路不是“猜明天涨跌”，而是：

1. **先判断环境**
2. **再识别主线**
3. **最后筛选个股**

一句话：

> **环境定仓位，主线定方向，周期定买卖。**

---

## 当前运行模式

Master 当前已切到 **指数优先模式**：
- **保留市场层与板块层判断**
- **暂停个股筛选与候选池生成**
- 输出结构仍保留 `stock_analysis`，但当前可为空数组，避免主流程与 schema 断裂

也就是说，现阶段重点是：
> **先把环境判断、主线识别、情绪强弱做稳，再考虑恢复个股层。**

### 当前默认日常命令

```bash
cd /Users/axiao/.openclaw/workspace

python3 Master/main.py \
  --source live-akshare \
  --out-dir Master/out-daily \
  --fallback-example-output-on-fail
```

### 当前默认输出口径
用户当前默认只看 `daily-report.md` 里的 5 句：
1. 今天环境判断
2. 今天主线识别
3. 今天最有效信号
4. 今天最大风险
5. 明天最该盯的点

### Day 2 之后的文件节奏
- `Master/out-daily/`：永远放**最新**结果（覆盖）
- `Master/out-daily/current-review.md`：永远放**当前最新复盘草稿**
- `Master/reviews/day1-review.md` ~ `day5-review.md`：放 **3–5 天观察期存档**

### 当前策略层已吸收的现实经验
基于“麻利低波组合”和“麻利安心稳健”的对照，当前本地配置层已做三条修正：
- 真防守优先使用 **政策性金融债 / 短债 / 货基**，而不是把高股息当现金替代
- 权益防守优先使用 **红利低波 / 价值** 风格
- H股核心与H股卫星默认更克制，除非趋势确认，否则不轻易高配

---

# 这是什么

Master 当前包含两部分：

## 1. 文档规格包
用于定义：
- Agent 定位
- Prompt 规则
- Schema 输出
- 评分系统
- 标签规则
- 数据层设计
- 工作流与管线
- 日报与候选池模板
- 样例与示例

## 2. 最小可跑原型
当前已有：
- `main.py`
- `judge.py`
- `validator.py`
- `renderer.py`

它已经可以完成一条最小链路：

```text
输入 JSON → 调 LLM / 使用示例输出 → 校验 → 渲染日报 / 候选池
```

---

# 它不是什么

Master 不是：
- 自动交易系统
- 高频量化终端
- 盘中秒级策略引擎
- “必涨黑马”推荐器
- 无脑追涨工具

它当前最适合做的是：

> **日线级、结构化、风控优先的 A 股决策辅助系统**

---

# 项目结构

```text
Master/
├── AGENT.md                    # Agent 身份与三层逻辑
├── PROMPT.md                   # LLM 决策规则
├── SCHEMA.json                 # 决策层输出契约
├── SCORING.md                  # 三层评分规则
├── TAGING_RULES.md             # 标签判定规则
├── DATA.md                     # 数据层设计
├── WORKFLOW.md                 # 日常运行流程
├── RUNBOOK.md                  # 操作手册
├── PIPELINE.md                 # 总体管线说明
├── ROADMAP.md                  # 版本路线
├── REPORT_TEMPLATE.md          # 日报模板（渲染层）
├── CANDIDATE_TEMPLATE.md       # 候选池模板（渲染层）
├── MAIN_PY_DESIGN.md           # main.py 原型设计说明
├── main.py                     # 最小可跑入口
├── judge.py                    # 模型调用层
├── validator.py                # 校验层
├── renderer.py                 # 渲染层
├── SAMPLES.md                  # 样例总纲
├── samples/                    # 样例案例卡
└── examples/                   # 输入输出与成品示例
```

---

# 核心运行逻辑

Master 的默认分析顺序固定为：

## Level 1：市场环境
判断：
- 进攻 / 试错 / 混沌 / 防守
- 当前能不能做
- 当前适合什么打法

## Level 2：板块主线
判断：
- 当前主线 / 次主线 / 退潮方向
- 板块所处阶段
- 龙头 / 中军 / 后排结构

## Level 3：个股角色与信号
判断：
- 龙头 / 中军 / 补涨 / 跟风 / 杂毛 / 反抽股
- 当前买点 / 风险点 / 动作建议

核心原则：

> **上层约束下层。**
> 环境不允许时，个股再强也不能乱给高评级。

---

# 环境要求

## Python
建议 Python 3.10+

## 当前依赖
当前原型没有引入第三方重依赖，默认只用标准库。

如果后面要增强：
- 可考虑 `jsonschema`
- 可考虑更正式的模板引擎
- 可考虑 requests/httpx

---

# 快速开始

## 方式 1：示例模式（推荐先跑这个）

这会跳过真实模型调用，直接用示例输出走完整链路。

```bash
python3 Master/main.py \
  --use-example-output \
  --input Master/examples/input-example.json \
  --out-dir Master/out-demo
```

运行后会生成：
- `Master/out-demo/decision.json`
- `Master/out-demo/logic-warnings.json`
- `Master/out-demo/daily-report.md`
- `Master/out-demo/candidate-pool.md`

---

## 方式 2：真实模型模式

### 先配置环境变量

```bash
export OPENAI_API_KEY="你的API_KEY"
export OPENAI_BASE_URL="你的OpenAI兼容接口地址"
```

> `OPENAI_BASE_URL` 可选。不填时默认：`https://api.openai.com/v1`

### 然后运行

```bash
python3 Master/main.py \
  --input Master/examples/input-example.json \
  --out-dir Master/out-real \
  --model gpt-4o-mini
```

---

# 当前 CLI 参数

```bash
python3 Master/main.py --help
```

支持：
- `--input`：输入 JSON 文件路径
- `--out-dir`：输出目录
- `--model`：模型名称
- `--use-example-output`：跳过真实调用，直接使用示例输出

---

# 输入格式

输入必须是 JSON，且顶层至少包含：

```json
{
  "market_snapshot": {},
  "theme_snapshot": [],
  "stock_snapshot": []
}
```

参考示例：
- `examples/input-example.json`

更多字段定义参考：
- `DATA.md`

---

# 输出格式

决策层的标准输出是：

```json
{
  "market_overview": {},
  "sector_analysis": [],
  "stock_analysis": []
}
```

参考：
- `SCHEMA.json`
- `examples/output-example.json`

重要：

## 决策层只输出 JSON
日报和候选池属于渲染层，不属于模型主输出层。

---

# 输出产物说明

运行成功后，默认会生成：

## 1. `decision.json`
结构化决策结果。

## 2. `logic-warnings.json`
基础逻辑校验告警。

## 3. `daily-report.md`
渲染后的日报。

## 4. `candidate-pool.md`
渲染后的候选池。

---

# 关键文件怎么用

## 如果你想改 Agent 脑子
看：
- `PROMPT.md`
- `SCORING.md`
- `TAGING_RULES.md`

## 如果你想改输出结构
看：
- `SCHEMA.json`

## 如果你想改输入字段
看：
- `DATA.md`

## 如果你想改展示样式
看：
- `REPORT_TEMPLATE.md`
- `CANDIDATE_TEMPLATE.md`
- `renderer.py`

## 如果你想看完整链路
看：
- `PIPELINE.md`
- `RUNBOOK.md`
- `WORKFLOW.md`

---

# 当前已实现模块

## 已完成
- 文档规格包
- 最小 `main.py`
- `judge.py`
- `validator.py`
- `renderer.py`
- 输入输出样例
- 日报与候选池渲染

## 尚未完成
- 严格 `jsonschema` 校验
- 自动重试
- 更复杂的业务逻辑纠偏
- 数据抓取器（collector）
- builder 模块
- 正式模板系统
- 盘中增强逻辑
- 仓位管理模块

---

# 推荐开发顺序

如果你要继续往下做，建议按这个顺序：

1. `README.md`（已完成）
2. 更严格的 schema 校验
3. `builder.py`
4. `collector.py`
5. 渲染增强
6. 真实日线数据接入
7. 盘中快照
8. 仓位管理

---

# 调试建议

## 如果模型输出乱
优先检查：
- `PROMPT.md`
- `SCHEMA.json`
- `TAGING_RULES.md`

## 如果主线判断漂
优先检查：
- `DATA.md` 是否缺字段
- `SCORING.md` 是否太主观
- 输入里是否缺中军/成交额/高度信息

## 如果个股老被误判成核心
优先检查：
- `circulating_market_cap`
- `board_count`
- `days_since_last_limit_up`
- 退潮标签是否触发

---

# 示例文件

## 输入示例
- `examples/input-example.json`

## 输出示例
- `examples/output-example.json`

## 成品示例
- `examples/daily-report-example.md`
- `examples/candidate-pool-example.md`

## 样例案例
- `samples/attack-phase.md`
- `samples/chaos-phase.md`
- `samples/retreat-phase.md`
- `samples/roles-leader-midcap-follower-trash.md`

---

# 当前最重要的原则

Master 最重要的不是“给更多票”，而是：

- 少犯错
- 少把垃圾票写成机会
- 少在退潮期兴奋
- 少在混沌期乱开火

一句话总结：

> **先过滤错误，再寻找机会。**

---

# License / Usage

当前是内部原型与设计包，用于继续精修、接模型、做最小实现。

如果后面要对外发布，再单独补：
- License
- Versioning
- Changelog
