import type { CSSProperties } from "react";

interface Props {
  importRunning: boolean;
  importProgress: number;
  currentBatchId?: string;
  importedAt?: string;
  rowCount: number;
  errorCount: number;
  lastMessage: string;
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
    onImportFile,
    onImportSample,
    onImportSessionFile,
    onExportSession,
    onClear,
    totalCount,
  } = props;

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
