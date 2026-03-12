import { useEffect, useState, type CSSProperties } from "react";
import { WORKFLOW_STATUS_OPTIONS } from "../../lib/db";
import type { ProductRecord, WorkflowStatus } from "../../types/product";

interface Props {
  row?: ProductRecord;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, patch: { workflowStatus: WorkflowStatus; notes: string }) => void;
  onExportScoutSync?: (row: ProductRecord) => void;
}

function badgeStyle(bg: string, color = "#111"): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    lineHeight: 1.6,
    background: bg,
    color,
    marginRight: 6,
    marginBottom: 6,
    whiteSpace: "nowrap",
  };
}

function signalLabel(value: "high" | "medium-high" | "medium" | "low") {
  switch (value) {
    case "high":
      return "高";
    case "medium-high":
      return "中高";
    case "medium":
      return "中";
    default:
      return "低";
  }
}

function signalBadge(value: "high" | "medium-high" | "medium" | "low", kind: "demand" | "competition" | "confidence"): CSSProperties {
  const colorMap = {
    high: kind === "competition" ? ["#fff1f0", "#cf1322"] : ["#f6ffed", "#389e0d"],
    "medium-high": ["#fff7e6", "#d46b08"],
    medium: ["#fffbe6", "#ad6800"],
    low: ["#f5f5f5", "#666"],
  } as const;

  const [bg, color] = colorMap[value];
  return {
    ...badgeStyle(bg, color),
    marginBottom: 0,
  };
}

export function DetailDrawer({ row, open, onClose, onSave, onExportScoutSync }: Props) {
  const [status, setStatus] = useState<WorkflowStatus>("待评估");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (row) {
      setStatus(row.workflowStatus);
      setNotes(row.notes || "");
    }
  }, [row]);

  if (!open) return null;

  const statusChanged = row ? row.workflowStatus !== row.rps.suggestedStatus : false;
  const isManual = row?.workflowStatusSource === "manual";
  const isScoutCard = Boolean(row?.scoutMeta);

  return (
    <aside style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>右侧详情</h2>
        <button onClick={onClose} style={smallButton}>关闭</button>
      </div>

      {!row ? (
        <div style={{ color: "#666" }}>先在表格里点一行。</div>
      ) : (
        <div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{row.productDirection}</div>
              {isScoutCard ? <span style={badgeStyle("#fff7e6", "#ad6800")}>💡 侦察引入</span> : null}
            </div>
            <div style={{ color: "#666", marginTop: 4 }}>{row.keyword}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={badgeStyle("#eef6ff")}>RPS {row.rps.score.finalScore}</span>
            <span style={badgeStyle(isManual ? "#fff1f0" : "#f5f5f5")}>{row.workflowStatus}</span>
            <span style={badgeStyle("#f6ffed", "#135200")}>系统建议 {row.rps.suggestedStatus}</span>
            <span style={badgeStyle(isManual ? "#fff7e6" : "#f0f5ff", isManual ? "#ad6800" : "#1d39c4")}>{isManual ? "人工接管" : "系统跟随"}</span>
            {statusChanged && <span style={badgeStyle("#fffbe6", "#ad6800")}>当前状态 ≠ 系统建议</span>}
            {row.overallRisk && <span style={badgeStyle("#fff3e6")}>风险 {row.overallRisk}</span>}
          </div>

          <div style={detailBlock}>
            <strong>状态控制</strong>
            <div style={{ marginTop: 8, color: "#666", fontSize: 13, lineHeight: 1.6 }}>
              <div>当前工作流状态：<strong style={{ color: "#111" }}>{row.workflowStatus}</strong></div>
              <div>系统建议状态：<strong style={{ color: "#111" }}>{row.rps.suggestedStatus}</strong></div>
              <div>状态来源：<strong style={{ color: "#111" }}>{isManual ? "人工接管" : "系统自动跟随"}</strong></div>
              {row.workflowStatusUpdatedAt && <div>最近状态更新时间：<strong style={{ color: "#111" }}>{row.workflowStatusUpdatedAt}</strong></div>}
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value as WorkflowStatus)} style={inputStyle}>
              {WORKFLOW_STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
              保存后会把该记录标记为“人工接管”，后续导入不会再覆盖当前状态。
            </div>
          </div>

          {isScoutCard && row.scoutMeta ? (
            <div style={detailBlock}>
              <strong>侦察洞察（Scout Insights）</strong>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <span style={labelSmall}>需求信号：</span>
                    <span style={signalBadge(row.scoutMeta.demandSignal, "demand")}>{signalLabel(row.scoutMeta.demandSignal)}</span>
                  </div>
                  <div>
                    <span style={labelSmall}>竞争信号：</span>
                    <span style={signalBadge(row.scoutMeta.competitionSignal, "competition")}>{signalLabel(row.scoutMeta.competitionSignal)}</span>
                  </div>
                  <div>
                    <span style={labelSmall}>结论置信度：</span>
                    <span style={signalBadge(row.scoutMeta.confidence, "confidence")}>{signalLabel(row.scoutMeta.confidence)}</span>
                  </div>
                  <div>
                    <span style={labelSmall}>初步判断：</span>
                    <strong>{row.scoutMeta.preliminaryDecision}</strong>
                  </div>
                  <div style={{ color: "#444" }}>{row.scoutMeta.reasonSummary}</div>
                </div>

                <div>
                  <div style={labelSmall}>用户痛点</div>
                  <ul style={ulStyle}>
                    {row.scoutMeta.painPoints.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>

                {row.scoutMeta.opportunities.length > 0 && (
                  <div>
                    <div style={labelSmall}>微创新机会</div>
                    <ul style={ulStyle}>
                      {row.scoutMeta.opportunities.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                )}

                <div>
                  <div style={labelSmall}>风险提示</div>
                  <ul style={ulStyle}>
                    {row.scoutMeta.risks.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>

                <div>
                  <div style={labelSmall}>证据链接</div>
                  <ul style={ulStyle}>
                    {row.scoutMeta.evidence.map((item) => (
                      <li key={`${item.source}-${item.url}`}>
                        <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "#1677ff", textDecoration: "none" }}>
                          {item.source} · {item.title}
                        </a>
                        <div style={{ color: "#666", fontSize: 12 }}>{item.summary}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div style={detailBlock}>
            <strong>本地备注</strong>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} placeholder="这里写本地判断、供应链线索、人工备注..." />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button onClick={() => onSave(row.id, { workflowStatus: status, notes })} style={smallButton}>保存状态与备注</button>
              {isScoutCard && onExportScoutSync ? (
                <button onClick={() => onExportScoutSync({ ...row, notes, workflowStatus: status })} style={smallButton}>导出飞书同步 JSON</button>
              ) : null}
            </div>
          </div>

          <div style={detailBlock}>
            <strong>Eligibility Gate</strong>
            <div>{row.rps.eligibility.eligible ? "通过" : "拒绝"}</div>
            {row.rps.eligibility.reasons.length > 0 && (
              <ul style={ulStyle}>
                {row.rps.eligibility.reasons.map((item) => <li key={item}>{item}</li>)}
              </ul>
            )}
          </div>

          <div style={detailBlock}>
            <strong>评分拆解</strong>
            <ul style={ulStyle}>
              <li>30天评论增长：{row.rps.score.reviewGrowthScore}</li>
              <li>BSR：{row.rps.score.bsrScore}</li>
              <li>反垄断：{row.rps.score.antiMonopolyScore}</li>
              <li>竞争容易度：{row.rps.score.competitionEaseScore}</li>
              <li>评分窗口：{row.rps.score.ratingWindowScore}</li>
              <li>评论基数：{row.rps.score.reviewBaseScore}</li>
              <li>固定风险扣分：-{row.rps.score.riskPenalty}</li>
              <li>人工修正：{row.rps.score.manualOverride >= 0 ? "+" : ""}{row.rps.score.manualOverride}</li>
            </ul>
          </div>

          <div style={detailBlock}>
            <strong>数据质量</strong>
            <ul style={ulStyle}>
              <li>缺失核心字段数：{row.rps.dataQuality.missingCoreFieldCount}</li>
              <li>是否待补证：{row.rps.dataQuality.needsMoreEvidence ? "是" : "否"}</li>
              <li>是否过期：{row.rps.dataQuality.isStale ? "是" : "否"}</li>
              <li>距调研日期：{row.rps.dataQuality.ageDays} 天</li>
            </ul>
          </div>

          <div style={detailBlock}>
            <strong>VOC</strong>
            <div><span style={labelSmall}>核心卖点：</span>{row.coreSellingPoints || "-"}</div>
            <div style={{ marginTop: 8 }}><span style={labelSmall}>高频差评点：</span>{row.topComplaintPoints || "-"}</div>
            <div style={{ marginTop: 8 }}><span style={labelSmall}>高频想要点：</span>{row.desiredPoints || "-"}</div>
          </div>

          <div style={detailBlock}>
            <strong>系统标签</strong>
            <div>
              {row.rps.falsePositiveTags.length === 0
                ? "-"
                : row.rps.falsePositiveTags.map((tag) => <span key={tag} style={badgeStyle("#fff7e6")}>{tag}</span>)}
            </div>
          </div>

          <div style={detailBlock}>
            <strong>当前建议动作</strong>
            <div>{row.nextAction || row.rps.suggestedStatus}</div>
            <div style={{ color: "#666", marginTop: 8 }}>{row.conclusionSummary || "-"}</div>
          </div>
        </div>
      )}
    </aside>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  minHeight: 0,
  height: "100%",
  boxSizing: "border-box",
  overflow: "auto",
  alignSelf: "stretch",
};

const smallButton: CSSProperties = {
  border: "1px solid #ddd",
  background: "#fff",
  padding: "6px 10px",
  borderRadius: 10,
  cursor: "pointer",
};

const detailBlock: CSSProperties = {
  borderTop: "1px solid #f0f0f0",
  paddingTop: 12,
  marginTop: 12,
  lineHeight: 1.7,
};

const ulStyle: CSSProperties = {
  margin: "8px 0 0 18px",
  padding: 0,
};

const labelSmall: CSSProperties = {
  fontSize: 13,
  color: "#666",
  fontWeight: 600,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#fff",
  boxSizing: "border-box",
  marginTop: 8,
};
