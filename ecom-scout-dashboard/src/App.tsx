import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { SortingState } from "@tanstack/react-table";
import { db, exportSessionPayload, importSessionPayload, updateProductRecord } from "./lib/db";
import { queryProducts } from "./lib/productQuery";
import { useScoutStore } from "./store/useScoutStore";
import type { ProductRecord, WorkflowStatus } from "./types/product";
import { useScoreWorker } from "./hooks/useScoreWorker";
import { ImportSection } from "./components/import/ImportSection";
import { FilterSidebar } from "./components/discovery/FilterSidebar";
import { ProductTable } from "./components/discovery/ProductTable";
import { DetailDrawer } from "./components/detail/DetailDrawer";

function downloadJson(filename: string, content: unknown) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
    setImportMeta,
    setImportProgress,
  } = useScoutStore();

  const { lastMessage, setLastMessage, importFile, importSample } = useScoreWorker();
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);

  const filteredRows = useLiveQuery(
    () => queryProducts(filters),
    [filters.market, filters.risk, filters.minScore, filters.maxScore, filters.keyword, filters.workflowStatus],
    [] as ProductRecord[]
  );

  const totalCount = useLiveQuery(() => db.products.count(), [], 0);

  const marketOptions = useLiveQuery(async () => {
    const keys = await db.products.orderBy("market").uniqueKeys();
    return keys.map(String).filter(Boolean).sort();
  }, [], [] as string[]);

  const statusOptions = useLiveQuery(async () => {
    const keys = await db.products.orderBy("workflowStatus").uniqueKeys();
    return keys.map(String).filter(Boolean).sort();
  }, [], [] as string[]);

  const riskOptions = useLiveQuery(async () => {
    const keys = await db.products.orderBy("overallRisk").uniqueKeys();
    return keys.map(String).filter(Boolean).sort();
  }, [], [] as string[]);

  const selectedRow = useMemo(
    () => filteredRows.find((row) => row.id === selectedProductId),
    [filteredRows, selectedProductId]
  );

  useEffect(() => {
    if (selectedProductId && !selectedRow) {
      selectProduct(undefined);
      setDetailDrawerOpen(false);
    }
  }, [selectedProductId, selectedRow, selectProduct, setDetailDrawerOpen]);

  const handleClear = async () => {
    await db.products.clear();
    setImportMeta({ currentBatchId: undefined, importedAt: undefined, rowCount: 0, errorCount: 0 });
    setImportProgress(0);
    selectProduct(undefined);
    setDetailDrawerOpen(false);
    setLastMessage("已清空本地产品库");
  };

  const handleExportSession = async () => {
    const payload = await exportSessionPayload();
    const stamp = payload.exportedAt.replace(/[:.]/g, "-");
    downloadJson(`ecom-scout-session-${stamp}.json`, payload);
    setLastMessage(`已导出 Session：${payload.products.length} 条记录`);
  };

  const handleImportSessionFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text);
    const count = await importSessionPayload(payload);
    setImportMeta({ currentBatchId: "session-import", importedAt: new Date().toISOString(), rowCount: count, errorCount: 0 });
    setLastMessage(`已导入 Session：${count} 条记录`);
  };

  const handleSaveDetail = async (id: string, patch: { workflowStatus: WorkflowStatus; notes: string }) => {
    await updateProductRecord(id, patch);
    setLastMessage(`已保存：${patch.workflowStatus}${patch.notes ? " + 备注" : ""}`);
  };

  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24, maxWidth: 1440, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>选品侦察台 v1（发现矩阵首屏）</h1>
      <p style={{ color: "#555", lineHeight: 1.7 }}>
        这版已经不是纯导入页了。现在能做：CSV 导入、Worker 打分、Dexie 入库、发现矩阵筛选、表格排序、虚拟滚动，以及右侧详情修改。
      </p>

      <ImportSection
        importRunning={importRunning}
        importProgress={importProgress}
        currentBatchId={importMeta.currentBatchId}
        importedAt={importMeta.importedAt}
        rowCount={importMeta.rowCount}
        errorCount={importMeta.errorCount}
        lastMessage={lastMessage}
        onImportFile={(file) => {
          if (file) void importFile(file);
        }}
        onImportSample={() => {
          void importSample();
        }}
        onImportSessionFile={(file) => {
          void handleImportSessionFile(file);
        }}
        onExportSession={() => {
          void handleExportSession();
        }}
        onClear={() => {
          void handleClear();
        }}
        totalCount={totalCount}
      />

      <section style={{ display: "grid", gridTemplateColumns: detailDrawerOpen ? "280px 1fr 360px" : "280px 1fr", gap: 16, marginTop: 24 }}>
        <FilterSidebar
          filters={filters}
          marketOptions={marketOptions}
          statusOptions={statusOptions}
          riskOptions={riskOptions}
          setFilters={setFilters}
          resetFilters={resetFilters}
        />

        <ProductTable
          rows={filteredRows}
          selectedProductId={selectedProductId}
          sorting={sorting}
          setSorting={setSorting}
          onSelect={(id) => {
            selectProduct(id);
            setDetailDrawerOpen(true);
          }}
        />

        <DetailDrawer row={selectedRow} open={detailDrawerOpen} onClose={() => setDetailDrawerOpen(false)} onSave={handleSaveDetail} />
      </section>
    </main>
  );
}
