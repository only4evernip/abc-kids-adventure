import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { db } from "./lib/db";
import { useScoutStore } from "./store/useScoutStore";
import type { ProductRecord } from "./types/product";
import type { ScoreWorkerOutput } from "./workers/score.worker";

const MAX_ROWS = 1000;

function batchId() {
  return `batch_${Date.now()}`;
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

export default function App() {
  const {
    filters,
    selectedProductId,
    detailDrawerOpen,
    importRunning,
    importProgress,
    importMeta,
    setFilters,
    resetFilters,
    selectProduct,
    setDetailDrawerOpen,
    setImportRunning,
    setImportProgress,
    setImportMeta,
  } = useScoutStore();

  const [lastMessage, setLastMessage] = useState<string>("还没导入 CSV");
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);

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
    selectProduct(undefined);
    setDetailDrawerOpen(false);
  };

  const loadedRows = useLiveQuery(
    () => db.products.orderBy("importedAt").reverse().limit(MAX_ROWS).toArray(),
    [],
    [] as ProductRecord[]
  );

  const filteredRows = useMemo(() => {
    return loadedRows.filter((row) => {
      if (filters.market && row.market !== filters.market) return false;
      if (filters.risk && row.overallRisk !== filters.risk) return false;
      if (filters.workflowStatus && row.workflowStatus !== filters.workflowStatus) return false;
      if (filters.keyword) {
        const q = filters.keyword.trim().toLowerCase();
        const haystack = `${row.keyword} ${row.productDirection} ${row.title || ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.minScore != null && row.rps.score.finalScore < filters.minScore) return false;
      if (filters.maxScore != null && row.rps.score.finalScore > filters.maxScore) return false;
      return true;
    });
  }, [loadedRows, filters]);

  const selectedRow = useMemo(
    () => loadedRows.find((row) => row.id === selectedProductId),
    [loadedRows, selectedProductId]
  );

  const marketOptions = useMemo(() => Array.from(new Set(loadedRows.map((row) => row.market))).sort(), [loadedRows]);
  const statusOptions = useMemo(() => Array.from(new Set(loadedRows.map((row) => row.workflowStatus))).sort(), [loadedRows]);
  const riskOptions = useMemo(
    () => Array.from(new Set(loadedRows.map((row) => row.overallRisk).filter(Boolean) as string[])).sort(),
    [loadedRows]
  );

  const columns = useMemo<ColumnDef<ProductRecord>[]>(
    () => [
      {
        accessorKey: "market",
        header: "市场",
      },
      {
        accessorKey: "keyword",
        header: "关键词",
        cell: ({ row }) => (
          <div>
            <div style={{ fontWeight: 600 }}>{row.original.keyword}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{row.original.platformSite}</div>
          </div>
        ),
      },
      {
        accessorKey: "productDirection",
        header: "产品方向",
        cell: ({ row }) => (
          <div>
            <div>{row.original.productDirection}</div>
            <div style={{ color: "#666", fontSize: 12 }}>{row.original.bigCategory || row.original.nicheDirection || "-"}</div>
          </div>
        ),
      },
      {
        id: "score",
        accessorFn: (row) => row.rps.score.finalScore,
        header: "RPS",
        cell: ({ getValue }) => <strong>{String(getValue())}</strong>,
      },
      {
        accessorKey: "workflowStatus",
        header: "状态",
      },
      {
        id: "risk",
        accessorFn: (row) => row.overallRisk || "-",
        header: "风险",
      },
      {
        id: "tags",
        accessorFn: (row) => row.rps.falsePositiveTags.join(" / "),
        header: "标签",
        cell: ({ row }) => (
          <div style={{ maxWidth: 260 }}>
            {row.original.rps.falsePositiveTags.length === 0 ? "-" : row.original.rps.falsePositiveTags.join(" / ")}
          </div>
        ),
      },
      {
        accessorKey: "importedAt",
        header: "导入时间",
        cell: ({ row }) => <span style={{ fontSize: 12, color: "#666" }}>{row.original.importedAt}</span>,
      },
    ],
    []
  );

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24, maxWidth: 1440, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>选品侦察台 v1（发现矩阵首屏）</h1>
      <p style={{ color: "#555", lineHeight: 1.7 }}>
        这版已经不是纯导入页了。现在能做：CSV 导入、Worker 打分、Dexie 入库、发现矩阵筛选、表格排序，以及右侧详情查看。
      </p>

      <section style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 24, flexWrap: "wrap" }}>
        <label style={actionLabel}>
          <span>选择 CSV 导入</span>
          <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => handleImport(e.target.files?.[0])} />
        </label>

        <button onClick={handleImportSample} style={actionButton}>导入内置样本</button>
        <button onClick={handleClear} style={actionButton}>清空本地库</button>
      </section>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #eee", borderRadius: 12, background: "#fafafa" }}>
        <div><strong>状态：</strong>{importRunning ? "导入中" : "空闲"}</div>
        <div><strong>进度：</strong>{importProgress}%</div>
        <div><strong>最近消息：</strong>{lastMessage}</div>
        <div><strong>当前批次：</strong>{importMeta.currentBatchId || "-"}</div>
        <div><strong>最近导入：</strong>{importMeta.importedAt || "-"}</div>
        <div><strong>最近载入上限：</strong>{MAX_ROWS} 条</div>
        <div><strong>当前筛选后记录数：</strong>{filteredRows.length}</div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: detailDrawerOpen ? "280px 1fr 360px" : "280px 1fr", gap: 16, marginTop: 24 }}>
        <aside style={panelStyle}>
          <h2 style={{ marginTop: 0 }}>筛选器</h2>
          <div style={fieldBlock}>
            <label style={labelStyle}>关键词搜索</label>
            <input
              value={filters.keyword || ""}
              onChange={(e) => setFilters({ keyword: e.target.value })}
              placeholder="搜关键词 / 产品方向"
              style={inputStyle}
            />
          </div>

          <div style={fieldBlock}>
            <label style={labelStyle}>市场</label>
            <select value={filters.market || ""} onChange={(e) => setFilters({ market: e.target.value || undefined })} style={inputStyle}>
              <option value="">全部</option>
              {marketOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div style={fieldBlock}>
            <label style={labelStyle}>状态</label>
            <select
              value={filters.workflowStatus || ""}
              onChange={(e) => setFilters({ workflowStatus: e.target.value || undefined })}
              style={inputStyle}
            >
              <option value="">全部</option>
              {statusOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div style={fieldBlock}>
            <label style={labelStyle}>风险</label>
            <select value={filters.risk || ""} onChange={(e) => setFilters({ risk: e.target.value || undefined })} style={inputStyle}>
              <option value="">全部</option>
              {riskOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div style={fieldBlock}>
            <label style={labelStyle}>最低 RPS</label>
            <input
              type="number"
              value={filters.minScore ?? ""}
              onChange={(e) => setFilters({ minScore: e.target.value ? Number(e.target.value) : undefined })}
              style={inputStyle}
            />
          </div>

          <div style={fieldBlock}>
            <label style={labelStyle}>最高 RPS</label>
            <input
              type="number"
              value={filters.maxScore ?? ""}
              onChange={(e) => setFilters({ maxScore: e.target.value ? Number(e.target.value) : undefined })}
              style={inputStyle}
            />
          </div>

          <button onClick={resetFilters} style={{ ...actionButton, width: "100%" }}>重置筛选</button>
        </aside>

        <section style={panelStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>发现矩阵</h2>
              <div style={{ color: "#666", fontSize: 13 }}>当前显示最近 {MAX_ROWS} 条中的 {filteredRows.length} 条，支持排序和筛选。</div>
            </div>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead style={{ background: "#f7f7f7" }}>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} style={th} onClick={header.column.getToggleSortingHandler()}>
                        <span style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}>
                          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td style={td} colSpan={columns.length}>没有符合条件的数据。</td>
                  </tr>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => {
                        selectProduct(row.original.id);
                        setDetailDrawerOpen(true);
                      }}
                      style={{ cursor: "pointer", background: selectedProductId === row.original.id ? "#f5f9ff" : "#fff" }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} style={td}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {detailDrawerOpen && (
          <aside style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ marginTop: 0, marginBottom: 8 }}>右侧详情</h2>
              <button onClick={() => setDetailDrawerOpen(false)} style={smallButton}>关闭</button>
            </div>

            {!selectedRow ? (
              <div style={{ color: "#666" }}>先在表格里点一行。</div>
            ) : (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedRow.productDirection}</div>
                  <div style={{ color: "#666", marginTop: 4 }}>{selectedRow.keyword}</div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <span style={badgeStyle("#eef6ff")}>RPS {selectedRow.rps.score.finalScore}</span>
                  <span style={badgeStyle("#f5f5f5")}>{selectedRow.workflowStatus}</span>
                  {selectedRow.overallRisk && <span style={badgeStyle("#fff3e6")}>风险 {selectedRow.overallRisk}</span>}
                </div>

                <div style={detailBlock}>
                  <strong>Eligibility Gate</strong>
                  <div>{selectedRow.rps.eligibility.eligible ? "通过" : "拒绝"}</div>
                  {selectedRow.rps.eligibility.reasons.length > 0 && (
                    <ul style={ulStyle}>
                      {selectedRow.rps.eligibility.reasons.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>

                <div style={detailBlock}>
                  <strong>评分拆解</strong>
                  <ul style={ulStyle}>
                    <li>30天评论增长：{selectedRow.rps.score.reviewGrowthScore}</li>
                    <li>BSR：{selectedRow.rps.score.bsrScore}</li>
                    <li>反垄断：{selectedRow.rps.score.antiMonopolyScore}</li>
                    <li>竞争容易度：{selectedRow.rps.score.competitionEaseScore}</li>
                    <li>评分窗口：{selectedRow.rps.score.ratingWindowScore}</li>
                    <li>评论基数：{selectedRow.rps.score.reviewBaseScore}</li>
                    <li>固定风险扣分：-{selectedRow.rps.score.riskPenalty}</li>
                    <li>人工修正：{selectedRow.rps.score.manualOverride >= 0 ? "+" : ""}{selectedRow.rps.score.manualOverride}</li>
                  </ul>
                </div>

                <div style={detailBlock}>
                  <strong>数据质量</strong>
                  <ul style={ulStyle}>
                    <li>缺失核心字段数：{selectedRow.rps.dataQuality.missingCoreFieldCount}</li>
                    <li>是否待补证：{selectedRow.rps.dataQuality.needsMoreEvidence ? "是" : "否"}</li>
                    <li>是否过期：{selectedRow.rps.dataQuality.isStale ? "是" : "否"}</li>
                    <li>距调研日期：{selectedRow.rps.dataQuality.ageDays} 天</li>
                  </ul>
                </div>

                <div style={detailBlock}>
                  <strong>VOC</strong>
                  <div><span style={labelSmall}>核心卖点：</span>{selectedRow.coreSellingPoints || "-"}</div>
                  <div style={{ marginTop: 8 }}><span style={labelSmall}>高频差评点：</span>{selectedRow.topComplaintPoints || "-"}</div>
                  <div style={{ marginTop: 8 }}><span style={labelSmall}>高频想要点：</span>{selectedRow.desiredPoints || "-"}</div>
                </div>

                <div style={detailBlock}>
                  <strong>系统标签</strong>
                  <div>
                    {selectedRow.rps.falsePositiveTags.length === 0
                      ? "-"
                      : selectedRow.rps.falsePositiveTags.map((tag) => <span key={tag} style={badgeStyle("#fff7e6")}>{tag}</span>)}
                  </div>
                </div>

                <div style={detailBlock}>
                  <strong>当前建议动作</strong>
                  <div>{selectedRow.nextAction || selectedRow.rps.suggestedStatus}</div>
                  <div style={{ color: "#666", marginTop: 8 }}>{selectedRow.conclusionSummary || "-"}</div>
                </div>
              </div>
            )}
          </aside>
        )}
      </section>
    </main>
  );
}

type CellStyle = CSSProperties;

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

const smallButton: CSSProperties = {
  border: "1px solid #ddd",
  background: "#fff",
  padding: "6px 10px",
  borderRadius: 10,
  cursor: "pointer",
};

const panelStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  minHeight: 200,
};

const fieldBlock: CSSProperties = {
  marginBottom: 14,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#555",
  marginBottom: 6,
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

const th: CellStyle = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const td: CellStyle = {
  padding: "12px 10px",
  borderBottom: "1px solid #f0f0f0",
  verticalAlign: "top",
};
