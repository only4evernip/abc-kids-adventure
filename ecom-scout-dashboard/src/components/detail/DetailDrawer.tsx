import { useEffect, useState, type CSSProperties } from "react";
import { WORKFLOW_STATUS_OPTIONS } from "../../lib/db";
import type { ProductRecord, WorkflowStatus } from "../../types/product";

interface Props {
  row?: ProductRecord;
  open: boolean;
  onClose: () => void;
  onSave: (id: string, patch: { workflowStatus: WorkflowStatus; notes: string }) => void;
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

export function DetailDrawer({ row, open, onClose, onSave }: Props) {
  const [status, setStatus] = useState<WorkflowStatus>("待评估");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (row) {
      setStatus(row.workflowStatus);
      setNotes(row.notes || "");
    }
  }, [row]);

  if (!open) return null;

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
            <div style={{ fontWeight: 700, fontSize: 18 }}>{row.productDirection}</div>
            <div style={{ color: "#666", marginTop: 4 }}>{row.keyword}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={badgeStyle("#eef6ff")}>RPS {row.rps.score.finalScore}</span>
            <span style={badgeStyle("#f5f5f5")}>{row.workflowStatus}</span>
            {row.overallRisk && <span style={badgeStyle("#fff3e6")}>风险 {row.overallRisk}</span>}
          </div>

          <div style={detailBlock}>
            <strong>状态修改</strong>
            <select value={status} onChange={(e) => setStatus(e.target.value as WorkflowStatus)} style={inputStyle}>
              {WORKFLOW_STATUS_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div style={detailBlock}>
            <strong>本地备注</strong>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical" }} placeholder="这里写本地判断、供应链线索、人工备注..." />
            <button onClick={() => onSave(row.id, { workflowStatus: status, notes })} style={{ ...smallButton, marginTop: 10 }}>保存状态与备注</button>
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
  minHeight: 200,
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
