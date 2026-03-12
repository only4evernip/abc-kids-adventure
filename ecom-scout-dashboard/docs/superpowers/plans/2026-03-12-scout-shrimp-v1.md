# Scout Shrimp V1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stable brief-to-scout-card pipeline for the scouting shrimp using a file-based workflow and fixed source policy.

**Architecture:** Validate a `scout-brief.json`, run a deterministic research-to-card transformation pipeline, and emit `scout-card.v1` JSON that can be imported into the existing dashboard. Keep V1 file-driven and backend-first; no new UI surface in this phase.

**Tech Stack:** TypeScript, Node.js scripts, Vitest, existing Scout Card helpers, JSON file IO

---

## File Structure

### New files
- `docs/scout-shrimp-v1-spec.md`
- `docs/superpowers/plans/2026-03-12-scout-shrimp-v1.md`
- `scout-brief.example.json`
- `src/lib/scoutBrief.ts`
- `src/lib/scoutBrief.test.ts`
- `scripts/scoutGenerate.mjs`
- `scripts/scoutGenerate.test.mjs` or Vitest-backed equivalent if easier under existing setup
- `SCOUT_WORKFLOW.md`
- `SCOUT_CARD_SPEC.md`

### Existing files to modify
- `package.json`
- `README.md` (only if command surface needs documenting)

---

## Chunk 1: 输入契约与样例固化

### Task 1: 写 `scout-brief` 的 failing test
**Files:**
- Create: `src/lib/scoutBrief.test.ts`
- Create: `src/lib/scoutBrief.ts`

- [ ] **Step 1: Write the failing test**
  - 测试 `parseScoutBrief()` 能接受最小合法输入
  - 测试缺少 `keyword` 会抛错
  - 测试非法 `market` 会抛错
  - 测试未提供 `language` 时补 `en`

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm test -- src/lib/scoutBrief.test.ts`
  - Expected: FAIL，提示模块或函数不存在

- [ ] **Step 3: Write minimal implementation**
  - 在 `src/lib/scoutBrief.ts` 定义 `ScoutBrief`
  - 实现 `parseScoutBrief(input)`
  - 只做最小字段校验和默认值补齐

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npm test -- src/lib/scoutBrief.test.ts`
  - Expected: PASS

- [ ] **Step 5: Add example file**
  - Create `scout-brief.example.json`
  - 内容与 spec 一致，覆盖 `keyword / market / language / platformFocus / researchGoal / notes`

- [ ] **Step 6: Commit**
  ```bash
  git add src/lib/scoutBrief.ts src/lib/scoutBrief.test.ts scout-brief.example.json
  git commit -m "feat: add scout brief contract"
  ```

---

## Chunk 2: 侦察执行管线骨架

### Task 2: 为 research-to-card pipeline 写 failing test
**Files:**
- Create: `scripts/scoutGenerate.mjs`
- Modify: `src/lib/scoutCard.ts`
- Test: `src/lib/scoutCard.test.ts` or a dedicated new test

- [ ] **Step 1: Write the failing test**
  - 测试给一个合法 `ScoutBrief` 和最小研究摘要时，能产出合法 `scout-card.v1`
  - 测试证据不足时，`confidence` 降级且 `preliminaryDecision` 为 `watch`

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm test`
  - Expected: FAIL，缺少 generator 或行为不匹配

- [ ] **Step 3: Write minimal implementation**
  - 实现一个最小 `buildScoutCardFromResearch()`
  - 暂时不接真实联网，只接结构化 research summary 输入
  - 明确 demand / competition / confidence / decision 的最小收敛规则

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npm test`
  - Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add scripts/scoutGenerate.mjs src/lib/scoutCard.ts src/lib/scoutCard.test.ts
  git commit -m "feat: add scout card generation pipeline skeleton"
  ```

---

## Chunk 3: 白名单信息源策略与中间研究摘要

### Task 3: 固化 research summary 结构
**Files:**
- Create: `SCOUT_WORKFLOW.md`
- Create or Modify: `scripts/scoutGenerate.mjs`
- Create: `src/lib/scoutResearch.ts`
- Create: `src/lib/scoutResearch.test.ts`

- [ ] **Step 1: Write the failing test**
  - 测试 `normalizeResearchSummary()` 必须要求至少三类证据：需求 / 痛点 / 竞争或风险
  - 测试来源不在白名单时会被过滤或标记

- [ ] **Step 2: Run test to verify it fails**
  - Run: `npm test -- src/lib/scoutResearch.test.ts`
  - Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
  - 定义 research summary 中间结构
  - 固定白名单源：Google / 普通网页 / Reddit / 论坛 / Amazon
  - 最小实现证据门槛校验

- [ ] **Step 4: Run test to verify it passes**
  - Run: `npm test -- src/lib/scoutResearch.test.ts`
  - Expected: PASS

- [ ] **Step 5: Write workflow doc**
  - `SCOUT_WORKFLOW.md` 写清 6 步执行管线

- [ ] **Step 6: Commit**
  ```bash
  git add SCOUT_WORKFLOW.md src/lib/scoutResearch.ts src/lib/scoutResearch.test.ts scripts/scoutGenerate.mjs
  git commit -m "feat: enforce scout research source policy"
  ```

---

## Chunk 4: 文件流 CLI 化

### Task 4: 打通 `brief.json -> scout-card.json` 文件流
**Files:**
- Modify: `scripts/scoutGenerate.mjs`
- Modify: `package.json`
- Test: lightweight script verification

- [ ] **Step 1: Write the failing verification case**
  - 准备一个最小输入 brief 文件
  - 运行 CLI，预期输出到指定 JSON 文件
  - 初始应失败（脚本未支持完整参数）

- [ ] **Step 2: Run to verify it fails**
  - Run: `node scripts/scoutGenerate.mjs --file ./scout-brief.example.json --out /tmp/out.json`
  - Expected: FAIL 或参数不完整

- [ ] **Step 3: Write minimal implementation**
  - 支持 `--file` 输入
  - 支持 `--out` 输出
  - 从 brief 读取 → research summary（先 stub / mock-safe）→ scout card
  - 写出标准 JSON

- [ ] **Step 4: Run to verify it passes**
  - Run: `node scripts/scoutGenerate.mjs --file ./scout-brief.example.json --out /tmp/out.json`
  - Expected: 生成合法 `scout-card.v1`

- [ ] **Step 5: Add npm script**
  - 在 `package.json` 增加如 `scout:generate`

- [ ] **Step 6: Commit**
  ```bash
  git add scripts/scoutGenerate.mjs package.json
  git commit -m "feat: add scout brief to card file pipeline"
  ```

---

## Chunk 5: 契约文档化与收尾验证

### Task 5: 固化规范文档并做端到端验证
**Files:**
- Create: `SCOUT_CARD_SPEC.md`
- Modify: `README.md` (if needed)
- Verify: generated scout card imports into dashboard

- [ ] **Step 1: Write spec doc**
  - 把 `scout-card.v1` 的证据门槛、初判边界、保守策略写进 `SCOUT_CARD_SPEC.md`

- [ ] **Step 2: Run full verification**
  - Run: `npm test && npm run build`
  - Expected: 全绿

- [ ] **Step 3: Generate one real sample card**
  - Run: `npm run scout:generate -- --file ./scout-brief.example.json --out /tmp/scout-card.json`
  - Verify: 输出合法 JSON

- [ ] **Step 4: Validate import path**
  - 将 `/tmp/scout-card.json` 导入当前工作台，确认可展示

- [ ] **Step 5: Commit**
  ```bash
  git add SCOUT_CARD_SPEC.md README.md docs/scout-shrimp-v1-spec.md docs/superpowers/plans/2026-03-12-scout-shrimp-v1.md
  git commit -m "docs: define scout shrimp v1 pipeline"
  ```

---

## Execution Notes

- V1 不引入前端新入口
- V1 不接复杂视频平台源
- V1 不直接自动写 Feishu
- 每个 chunk 结束都必须重新跑测试和 build
- 若研究生成逻辑出现不稳定，先在 research summary 层打桩，不要让随机联网行为污染契约开发

---

Plan complete and saved to `docs/superpowers/plans/2026-03-12-scout-shrimp-v1.md`. Ready to execute?
