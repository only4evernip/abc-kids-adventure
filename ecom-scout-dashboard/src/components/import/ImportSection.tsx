import { useState, type CSSProperties } from "react";
import type { ImportErrorItem } from "../../store/useScoutStore";

interface Props {
  importRunning: boolean;
  importProgress: number;
  currentBatchId?: string;
  importedAt?: string;
  rowCount: number;
  errorCount: number;
  lastMessage: string;
  errorItems: ImportErrorItem[];
  onImportFile: (file?: File | null) => void;
  onImportSample: () => void;
  onImportSessionFile: (file?: File | null) => void;
  onExportSession: () => void;
  onClear: () => void;
  totalCount: number;
}

export function ImportSection(props: Props) {
  const {
    importRunning,
    importProgress,
    currentBatchId,
    importedAt,
    rowCount,
    errorCount,
    lastMessage,
    errorItems,
    onImportFile,
    onImportSample,
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
          <span>导入 Session JSON</span>
          <input type="file" accept=".json,application/json" style={{ display: "none" }} onChange={(e) => onImportSessionFile(e.target.files?.[0])} />
        </label>

        <button onClick={onExportSession} style={actionButton}>导出 Session JSON</button>
        <button onClick={onClear} style={actionButton}>清空本地库</button>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
        <div><strong>状态：</strong>{importRunning ? "导入中" : "空闲"}</div>
        <div><strong>进度：</strong>{importProgress}%</div>
        <div><strong>最近消息：</strong>{lastMessage}</div>
        <div><strong>当前批次：</strong>{currentBatchId || "-"}</div>
        <div><strong>最近导入：</strong>{importedAt || "-"}</div>
        <div><strong>本轮成功：</strong>{rowCount}</div>
        <div><strong>本轮失败：</strong>{errorCount}</div>
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
