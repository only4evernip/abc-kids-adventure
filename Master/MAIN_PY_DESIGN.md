# MAIN_PY_DESIGN.md - Master

## 目标

定义 Master 的最小执行入口 `main.py` 应该怎么设计。

这不是正式代码实现，而是一个：
- 可落地
- 可逐步编码
- 可避免过度设计

的原型说明。

核心目标只有一句话：

## **给定结构化输入 JSON，调用 LLM 产出符合 `SCHEMA.json` 的决策 JSON，再渲染成日报与候选池。**

---

# 一、`main.py` 的职责边界

`main.py` 不应该什么都干。

## 它应该负责
1. 读取输入 JSON
2. 加载 Master 的核心规则文件
3. 调用 LLM
4. 校验输出 JSON
5. 触发渲染
6. 保存最终产物

## 它不应该负责
- 自己抓网页原始数据
- 自己定义业务规则
- 自己重写日报模板
- 自己替代人工复核
- 一上来就做盘中高频逻辑

也就是说：

### `main.py` 是调度入口
不是超级脚本。

---

# 二、推荐最小架构

## 推荐模块拆分

```text
Master/
├── main.py                  # 主入口
├── collector.py             # （后续）采集原始数据
├── builder.py               # 构造输入 JSON
├── judge.py                 # 调用 LLM，拿决策 JSON
├── validator.py             # 校验 Schema 与逻辑
├── renderer.py              # 渲染日报和候选池
└── examples/
```

当前阶段不一定要都实现，
但 `main.py` 应该按照这个职责划分来设计。

---

# 三、最小执行流程

## main.py 运行顺序

```text
读取输入 JSON
    ↓
读取 Prompt / Schema / Rules
    ↓
调用 judge（LLM）
    ↓
调用 validator 校验结果
    ↓
调用 renderer 生成日报 / 候选池
    ↓
保存 JSON 与 Markdown 产物
```

---

# 四、推荐输入与输出路径

## 输入
推荐默认输入：

- `examples/input-example.json`
- 或未来的 `data/daily-input.json`

## 输出
推荐默认输出目录：

- `out/decision.json`
- `out/daily-report.md`
- `out/candidate-pool.md`

---

# 五、main.py 的最小命令行设计

## 推荐命令

```bash
python main.py \
  --input examples/input-example.json \
  --out-dir out
```

## 可选参数

```bash
python main.py \
  --input data/daily-input.json \
  --out-dir out \
  --mode daily \
  --model glm-5
```

## 参数建议
- `--input`：输入 JSON 文件路径
- `--out-dir`：输出目录
- `--mode`：运行模式（先只支持 `daily`）
- `--model`：模型名（可选）
- `--dry-run`：只跑校验，不调用模型（后续可加）

---

# 六、核心函数设计

## 1. `load_input(path)`

### 职责
读取输入 JSON。

### 输入
- 文件路径

### 输出
- Python dict

### 检查点
- JSON 是否合法
- 顶层是否包含：
  - `market_snapshot`
  - `theme_snapshot`
  - `stock_snapshot`

---

## 2. `load_master_context()`

### 职责
加载 Master 运行所需核心文件。

### 建议加载
- `PROMPT.md`
- `SCHEMA.json`
- `SCORING.md`
- `TAGING_RULES.md`

### 注意
- `REPORT_TEMPLATE.md` 和 `CANDIDATE_TEMPLATE.md` 属于渲染层，
  不建议原样塞进主决策上下文。
- `SAMPLES.md` 和 `samples/` 可作为补充上下文按需喂给模型。

---

## 3. `build_llm_request(input_data, context)`

### 职责
把输入数据和规则上下文拼成一次 LLM 调用请求。

### 建议结构
- system: `PROMPT.md`
- user: 输入 JSON + 必要说明
- schema: `SCHEMA.json`

### 目标
明确告诉模型：
- 你是 Master
- 只输出 JSON
- 严格遵守 schema

---

## 4. `run_judge(request)`

### 职责
调用模型，得到决策结果。

### 输出
- 原始模型输出文本

### 注意
这一步不要直接信任输出。
后面必须进 validator。

---

## 5. `validate_schema(result)`

### 职责
校验输出是否符合 `SCHEMA.json`。

### 检查内容
- 是否是合法 JSON
- 字段是否缺失
- 枚举值是否合法
- reasoning 字段是否存在

### 失败处理
- 直接报错
- 或触发一次重试（后续可加）

---

## 6. `validate_logic(result, input_data)`

### 职责
做业务逻辑校验。

### 重点检查
- 环境若为“防守”，是否仍大面积推荐积极进攻
- 板块若为“退潮反抽”，是否还有大量高评级个股
- 杂毛 / 跟风是否混进重点池
- reasoning 与 action 是否冲突

### 失败处理
- 标记告警
- 输出 review flag
- 必要时降级结论

---

## 7. `render_report(result)`

### 职责
把合法 JSON 渲染成日报 Markdown。

### 模板来源
- `REPORT_TEMPLATE.md`

### 输出
- `daily-report.md`

---

## 8. `render_candidate_pool(result)`

### 职责
把合法 JSON 渲染成候选池 Markdown。

### 模板来源
- `CANDIDATE_TEMPLATE.md`

### 输出
- `candidate-pool.md`

---

# 七、main.py 伪代码

```python
from pathlib import Path
import json


def load_input(path):
    return json.loads(Path(path).read_text())


def load_text(path):
    return Path(path).read_text()


def load_master_context(base_dir):
    return {
        "prompt": load_text(base_dir / "PROMPT.md"),
        "schema": json.loads(load_text(base_dir / "SCHEMA.json")),
        "scoring": load_text(base_dir / "SCORING.md"),
        "tagging": load_text(base_dir / "TAGING_RULES.md"),
    }


def build_llm_request(input_data, context, model=None):
    return {
        "model": model or "default",
        "system": context["prompt"],
        "schema": context["schema"],
        "input": input_data,
        "supporting_rules": {
            "scoring": context["scoring"],
            "tagging": context["tagging"],
        }
    }


def run_judge(request):
    # 这里后续替换成真实模型调用
    raise NotImplementedError


def validate_schema(result, schema):
    # 后续接 jsonschema
    return True


def validate_logic(result, input_data):
    # 后续补业务规则
    return []


def render_report(result):
    # 后续实现模板渲染
    return "# report\n"


def render_candidate_pool(result):
    # 后续实现模板渲染
    return "# candidates\n"


def main(input_path, out_dir, model=None):
    base_dir = Path(__file__).resolve().parent
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    input_data = load_input(input_path)
    context = load_master_context(base_dir)
    request = build_llm_request(input_data, context, model=model)

    result = run_judge(request)

    validate_schema(result, context["schema"])
    logic_warnings = validate_logic(result, input_data)

    (out_dir / "decision.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    (out_dir / "logic-warnings.json").write_text(json.dumps(logic_warnings, ensure_ascii=False, indent=2))
    (out_dir / "daily-report.md").write_text(render_report(result))
    (out_dir / "candidate-pool.md").write_text(render_candidate_pool(result))
```

---

# 八、第一版实现建议

## v0.1 先做到这 4 件事
1. 能读 `input-example.json`
2. 能调用模型拿 JSON
3. 能校验 schema
4. 能输出 `decision.json`

## v0.2 再补
1. `daily-report.md`
2. `candidate-pool.md`
3. `logic-warnings.json`

## v0.3 再补
1. 样例回放
2. 重试机制
3. review flag
4. 人工复核接口

---

# 九、当前不要过度设计的地方

现在先别急着做：
- 多模型路由
- 盘中事件总线
- 自动消息发送
- 数据库存档
- 回测框架
- 仓位管理引擎

先让 `main.py` 做到：

## **单次输入 → 单次判断 → 单次输出，稳定不漂。**

这比什么都重要。

---

# 十、一句话总结

`main.py` 的原型目标不是炫技，而是：

## **把 Master 现有的规则文档，串成一个最小可执行的判断入口。**