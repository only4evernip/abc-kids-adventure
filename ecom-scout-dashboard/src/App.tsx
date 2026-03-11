import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./lib/db";
import { useScoutStore } from "./store/useScoutStore";
import type { ScoreWorkerOutput } from "./workers/score.worker";

function batchId() {
  return `batch_${Date.now()}`;
}

export default function App() {
  const {
    importRunning,
    importProgress,
    importMeta,
    setImportRunning,
    setImportProgress,
    setImportMeta,
  } = useScoutStore();

  const [lastMessage, setLastMessage] = useState<string>("还没导入 CSV");

  const worker = useMemo(
    () => new Worker(new URL("./workers/score.worker.ts", import.meta.url), { type: "module" }),
    []
  );

  useEffect(() => {
    worker.onmessage = (event: MessageEvent<ScoreWorkerOutput>) => {
      const data = event.data;

      if (data.type === "progress") {
        const progress = data.total > 0 ? Math.round((data.processed / data.total) * 100) : 0;
        setImportProgress(progress);
        setLastMessage(`处理中：${data.processed}/${data.total}，已写入 ${data.saved}，错误 ${data.errors}`);
        return;
      }

      if (data.type === "done") {
        setImportRunning(false);
        setImportProgress(100);
        setImportMeta({
          currentBatchId: data.batchId,
          importedAt: new Date().toISOString(),
          rowCount: data.count,
          errorCount: data.errorCount,
        });
        setLastMessage(`导入完成：成功 ${data.count} 条，失败 ${data.errorCount} 条`);
        return;
      }

      if (data.type === "error") {
        setImportRunning(false);
        setLastMessage(`导入失败：${data.message}`);
      }
    };

    return () => worker.terminate();
  }, [worker, setImportMeta, setImportProgress, setImportRunning]);

  const startImport = async (csvText: string, sourceLabel: string) => {
    const id = batchId();
    setImportRunning(true);
    setImportProgress(0);
    setImportMeta({ currentBatchId: id, importedAt: new Date().toISOString(), rowCount: 0, errorCount: 0 });
    setLastMessage(`开始导入：${sourceLabel}`);
    worker.postMessage({ batchId: id, csvText });
  };

  const handleImport = async (file?: File | null) => {
    if (!file) return;
    const csvText = await file.text();
    await startImport(csvText, file.name);
  };

  const handleImportSample = async () => {
    const res = await fetch("/samples/candidate-pool-us-ca.csv");
    const csvText = await res.text();
    await startImport(csvText, "内置样本 candidate-pool-us-ca.csv");
  };

  const handleClear = async () => {
    await db.products.clear();
    setImportMeta({ currentBatchId: undefined, importedAt: undefined, rowCount: 0, errorCount: 0 });
    setImportProgress(0);
    setLastMessage("已清空本地产品库");
  };

  const totalCount = useLiveQuery(() => db.products.count(), [], 0);
  const latestRows = useLiveQuery(() => db.products.orderBy("importedAt").reverse().limit(12).toArray(), [], []);

  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24, maxWidth: 1180, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>选品侦察台 v1（真实 CSV 导入闭环）</h1>
      <p style={{ color: "#555", lineHeight: 1.7 }}>
        这版先不追求花哨图表，重点验证：CSV 导入、Worker 打分、Dexie 入库、结果可查询。
      </p>

      <section style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 24, flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "1px solid #ddd",
            padding: "10px 14px",
            borderRadius: 10,
            cursor: "pointer",
            background: "#fff",
          }}
        >
          <span>选择 CSV 导入</span>
          <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => handleImport(e.target.files?.[0])} />
        </label>

        <button
          onClick={handleImportSample}
          style={{ border: "1px solid #ddd", background: "#fff", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
        >
          导入内置样本
        </button>

        <button
          onClick={handleClear}
          style={{ border: "1px solid #ddd", background: "#fff", padding: "10px 14px", borderRadius: 10, cursor: "pointer" }}
        >
          清空本地库
        </button>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
        <div><strong>状态：</strong>{importRunning ? "导入中" : "空闲"}</div>
        <div><strong>进度：</strong>{importProgress}%</div>
        <div><strong>最近消息：</strong>{lastMessage}</div>
        <div><strong>当前批次：</strong>{importMeta.currentBatchId || "-"}</div>
        <div><strong>最近导入：</strong>{importMeta.importedAt || "-"}</div>
        <div><strong>本地记录数：</strong>{totalCount}</div>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>最近 12 条记录</h2>
        <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead style={{ background: "#f7f7f7" }}>
              <tr>
                <th style={th}>市场</th>
                <th style={th}>关键词</th>
                <th style={th}>产品方向</th>
                <th style={th}>RPS</th>
                <th style={th}>状态</th>
                <th style={th}>标签</th>
                <th style={th}>导入时间</th>
              </tr>
            </thead>
            <tbody>
              {latestRows.length === 0 ? (
                <tr>
                  <td style={td} colSpan={7}>还没有数据，先导入一份 CSV。</td>
                </tr>
              ) : (
                latestRows.map((row) => (
                  <tr key={row.id}>
                    <td style={td}>{row.market}</td>
                    <td style={td}>{row.keyword}</td>
                    <td style={td}>{row.productDirection}</td>
                    <td style={td}>{row.rps.score.finalScore}</td>
                    <td style={td}>{row.workflowStatus}</td>
                    <td style={td}>{row.rps.falsePositiveTags.join(" / ") || "-"}</td>
                    <td style={td}>{row.importedAt}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

type CellStyle = CSSProperties;

const th: CellStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
};

const td: CellStyle = {
  padding: "12px 10px",
  borderBottom: "1px solid #f0f0f0",
  verticalAlign: "top",
};
