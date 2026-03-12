import { useState, type CSSProperties } from "react";
import type { ImportErrorItem, ImportPhase } from "../../store/useScoutStore";

interface Props {
  importRunning: boolean;
  importProgress: number;
  currentBatchId?: string;
  importedAt?: string;
  phase: ImportPhase;
  rowCount: number;
  errorCount: number;
  lastMessage: string;
  errorItems: ImportErrorItem[];
  stats: {
    insertedCount: number;
    updatedCount: number;
    preservedManualStatusCount: number;
    preservedNotesCount: number;
  };
  onImportFile: (file?: File | null) => void;
  onImportSample: () => void;
  onImportScoutCardFile: (file?: File | null) => void;
  onImportSessionFile: (file?: File | null) => void;
  onExportSession: () => void;
  onClear: () => void;
  totalCount: number;
}

function phaseLabel(phase: ImportPhase) {
  switch (phase) {
    case "parsing":
      return "解析 CSV";
    case "validating":
      return "校验数据";
    case "saving":
      return "写入本地库";
    case "done":
      return "已完成";
    case "failed":
      return "失败";
    default:
      return "空闲";
  }
}

const STEPPER_PHASES: { key: Exclude<ImportPhase, "idle" | "failed">; label: string }[] = [
  { key: "parsing", label: "解析" },
  { key: "validating", label: "校验" },
  { key: "saving", label: "落库" },
  { key: "done", label: "完成" },
];

function getPhaseStepState(step: Exclude<ImportPhase, "idle" | "failed">, phase: ImportPhase) {
  if (phase === "failed") return "pending" as const;
  const activeIndex = STEPPER_PHASES.findIndex((item) => item.key === phase);
  const stepIndex = STEPPER_PHASES.findIndex((item) => item.key === step);

  if (phase === "idle") return "pending" as const;
  if (stepIndex < activeIndex) return "done" as const;
  if (stepIndex === activeIndex) return "active" as const;
  return "pending" as const;
}

function stepBadgeStyle(state: "done" | "active" | "pending"): CSSProperties {
  if (state === "done") {
    return {
      ...stepCircleBase,
      background: "#f6ffed",
      border: "1px solid #b7eb8f",
      color: "#389e0d",
    };
  }

  if (state === "active") {
    return {
      ...stepCircleBase,
      background: "#e6f4ff",
      border: "1px solid #91caff",
      color: "#0958d9",
    };
  }

  return {
    ...stepCircleBase,
    background: "#fafafa",
    border: "1px solid #d9d9d9",
    color: "#999",
  };
}

export function ImportSection(props: Props) {
  const {
    importRunning,
    importProgress,
    currentBatchId,
    importedAt,
    phase,
    rowCount,
    errorCount,
    lastMessage,
    errorItems,
    stats,
    onImportFile,
    onImportSample,
    onImportScoutCardFile,
    onImportSessionFile,
    onExportSession,
    onClear,
    totalCount,
  } = props;
  const [showErrors, setShowErrors] = useState(false);

  return (
    <>
      <section style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 24, flexWrap: "wrap" }}>
        <label style={actionLabel}>
          <span>选择 CSV 导入</span>
          <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => onImportFile(e.target.files?.[0])} />
        </label>

        <button onClick={onImportSample} style={actionButton}>导入内置样本</button>

        <label style={actionLabel}>
          <span>导入侦察卡 JSON</span>
          <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => onImportScoutCardFile(e.target.files?.[0])} />
        </label>

        <label style={actionLabel}>
          <span>导入 Session JSON</span>
          <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => onImportSessionFile(e.target.files?.[0])} />
        </label>

        <button onClick={onExportSession} style={actionButton}>导出 Session JSON</button>
        <button onClick={onClear} style={actionButton}>清空本地库</button>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>导入阶段</div>
          <div style={stepperRow}>
            {STEPPER_PHASES.map((item, index) => {
              const state = getPhaseStepState(item.key, phase);
              const isFailed = phase === "failed";

              return (
                <div key={item.key} style={stepItem}>
                  <div style={stepTopRow}>
                    <div style={isFailed ? failedStepStyle : stepBadgeStyle(state)}>
                      {isFailed ? "!" : state === "done" ? "✓" : index + 1}
                    </div>
                    {index < STEPPER_PHASES.length - 1 && (
                      <div
                        style={{
                          ...stepLine,
                          background: state === "done" ? "#b7eb8f" : "#e5e7eb",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: isFailed ? "#cf1322" : state === "active" ? "#0958d9" : "#666", marginTop: 8 }}>
                    {item.label}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: phase === "failed" ? "#cf1322" : "#555" }}>
            当前阶段：<strong>{phaseLabel(phase)}</strong>
          </div>
        </div>

        <div><strong>状态：</strong>{importRunning ? "导入中" : phaseLabel(phase)}</div>
        <div><strong>进度：</strong>{importProgress}%</div>
        <div><strong>最近消息：</strong>{lastMessage}</div>
        <div><strong>当前批次：</strong>{currentBatchId || "-"}</div>
        <div><strong>最近导入：</strong>{importedAt || "-"}</div>
        <div><strong>本轮成功：</strong>{rowCount}</div>
        <div><strong>本轮失败：</strong>{errorCount}</div>
        <div><strong>新增记录：</strong>{stats.insertedCount}</div>
        <div><strong>更新记录：</strong>{stats.updatedCount}</div>
        <div><strong>保留人工状态：</strong>{stats.preservedManualStatusCount}</div>
        <div><strong>保留备注：</strong>{stats.preservedNotesCount}</div>
        <div><strong>本地记录数：</strong>{totalCount}</div>

        {errorCount > 0 && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowErrors((value) => !value)} style={actionButton}>
              {showErrors ? "收起失败原因" : `查看失败原因（${errorItems.length} 条示例）`}
            </button>

            {showErrors && (
              <div style={{ marginTop: 12, border: "1px solid #f0f0f0", borderRadius: 10, background: "#fff", padding: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>导入失败摘要（最多展示 20 条）</div>
                {errorItems.length === 0 ? (
                  <div style={{ color: "#666" }}>本轮有失败，但暂未拿到可展示的失败明细。</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {errorItems.map((item) => (
                      <div key={`${item.rowNumber}-${item.field || "unknown"}-${item.reason}`} style={{ borderBottom: "1px solid #f5f5f5", paddingBottom: 10 }}>
                        <div><strong>第 {item.rowNumber} 行</strong>{item.field ? ` · 字段：${item.field}` : ""}</div>
                        <div style={{ color: "#333", marginTop: 4 }}>{item.reason}</div>
                        {item.valuePreview ? <div style={{ color: "#666", fontSize: 12, marginTop: 4 }}>原始值：{item.valuePreview || "-"}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </>
  );
}

const actionLabel: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #ddd",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
  background: "#fff",
};

const actionButton: CSSProperties = {
  border: "1px solid #ddd",
  background: "#fff",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
};

const stepperRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
  alignItems: "start",
};

const stepItem: CSSProperties = {
  minWidth: 0,
};

const stepTopRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
};

const stepCircleBase: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
};

const failedStepStyle: CSSProperties = {
  ...stepCircleBase,
  background: "#fff1f0",
  border: "1px solid #ffa39e",
  color: "#cf1322",
};

const stepLine: CSSProperties = {
  height: 2,
  flex: 1,
  marginLeft: 8,
  marginRight: 4,
  borderRadius: 999,
};
