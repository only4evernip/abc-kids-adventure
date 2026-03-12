import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { SortingState } from "@tanstack/react-table";
import { db, exportSessionPayload, importSessionPayload, updateProductRecord } from "./lib/db";
import { queryProducts } from "./lib/productQuery";
import { parseScoutCard, scoutCardToProductRecord, type ScoutCard } from "./lib/scoutCard";
import { scoutCardToFeishuRecord } from "./lib/scoutCardFeishu";
import { useScoutStore } from "./store/useScoutStore";
import type { ProductRecord, WorkflowStatus } from "./types/product";
import { useScoreWorker } from "./hooks/useScoreWorker";
import { useDebouncedValue } from "./hooks/useDebouncedValue";
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

function productRecordToScoutCard(row: ProductRecord): ScoutCard | null {
  if (!row.scoutMeta) return null;

  return {
    schemaVersion: "scout-card.v1" as const,
    cardId: row.scoutMeta.cardId,
    createdAt: row.researchDate ? `${row.researchDate}T00:00:00+08:00` : row.importedAt,
    updatedAt: row.workflowStatusUpdatedAt || row.importedAt,
    topic: {
      keyword: row.keyword,
      productDirection: row.productDirection,
      market: row.market,
      platformFocus: row.platformSite ? [row.platformSite] : [],
      language: "en",
    },
    signals: {
      demandSignal: row.scoutMeta.demandSignal,
      competitionSignal: row.scoutMeta.competitionSignal,
      confidence: row.scoutMeta.confidence,
    },
    insights: {
      painPoints: row.scoutMeta.painPoints,
      risks: row.scoutMeta.risks,
      opportunities: row.scoutMeta.opportunities,
    },
    decision: {
      preliminaryDecision: row.scoutMeta.preliminaryDecision,
      nextStep: row.nextAction,
      reasonSummary: row.scoutMeta.reasonSummary,
    },
    evidence: row.scoutMeta.evidence,
    workbench: {
      workflowStatus: row.workflowStatus,
      notes: row.notes || "",
      tags: row.scoutMeta.tags,
    },
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
    setImportMeta,
    setImportProgress,
  } = useScoutStore();

  const { lastMessage, setLastMessage, importFile, importSample } = useScoreWorker();
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const debouncedKeyword = useDebouncedValue(filters.keyword, 250);
  const queryFilters = useMemo(() => ({ ...filters, keyword: debouncedKeyword }), [filters, debouncedKeyword]);

  const filteredRows = useLiveQuery(
    () => queryProducts(queryFilters),
    [
      queryFilters.market,
      queryFilters.risk,
      queryFilters.minScore,
      queryFilters.maxScore,
      queryFilters.keyword,
      queryFilters.workflowStatus,
      queryFilters.manualOnly,
      queryFilters.changedOnly,
      queryFilters.reviewPriorityOnly,
    ],
    [] as ProductRecord[]
  );

  const totalCount = useLiveQuery(() => db.products.count(), [], 0);
  const queueCount = useLiveQuery(
    () =>
      db.products
        .toArray()
        .then((rows) =>
          rows.filter((row) => {
            const systemHighScore = row.workflowStatusSource === "system" && row.rps.score.finalScore >= 80;
            const freshScout = Boolean(row.scoutMeta) && row.workflowStatusSource !== "manual" && ["待评估", "观察池"].includes(row.workflowStatus);
            return systemHighScore || freshScout;
          }).length
        ),
    [],
    0
  );

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

  const selectedRowIndex = useMemo(
    () => filteredRows.findIndex((row) => row.id === selectedProductId),
    [filteredRows, selectedProductId]
  );

  const showSaveAndNext = Boolean(filters.queueOnly && selectedRow);
  const isLastQueueItem = showSaveAndNext && selectedRowIndex >= 0 && selectedRowIndex === filteredRows.length - 1;

  useEffect(() => {
    if (selectedProductId && !selectedRow) {
      selectProduct(undefined);
      setDetailDrawerOpen(false);
    }
  }, [selectedProductId, selectedRow, selectProduct, setDetailDrawerOpen]);

  const handleClear = async () => {
    await db.products.clear();
    setImportMeta({
      currentBatchId: undefined,
      importedAt: undefined,
      phase: "idle",
      rowCount: 0,
      errorCount: 0,
      errorItems: [],
      stats: { insertedCount: 0, updatedCount: 0, preservedManualStatusCount: 0, preservedNotesCount: 0 },
    });
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

  const handleImportScoutCardFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text);
    const card = parseScoutCard(payload);
    const record = scoutCardToProductRecord(card);
    await db.products.put(record);
    setImportMeta({
      currentBatchId: "scout-card-import",
      importedAt: new Date().toISOString(),
      phase: "done",
      rowCount: 1,
      errorCount: 0,
      errorItems: [],
      stats: { insertedCount: 1, updatedCount: 0, preservedManualStatusCount: 0, preservedNotesCount: 0 },
    });
    setLastMessage(`已导入侦察卡：${card.topic.productDirection}`);
  };

  const handleImportSessionFile = async (file?: File | null) => {
    if (!file) return;
    const text = await file.text();
    const payload = JSON.parse(text);
    const count = await importSessionPayload(payload);
    setImportMeta({
      currentBatchId: "session-import",
      importedAt: new Date().toISOString(),
      phase: "done",
      rowCount: count,
      errorCount: 0,
      errorItems: [],
      stats: { insertedCount: count, updatedCount: 0, preservedManualStatusCount: 0, preservedNotesCount: 0 },
    });
    setLastMessage(`已导入 Session：${count} 条记录`);
  };

  const handleSaveDetail = async (id: string, patch: { workflowStatus: WorkflowStatus; notes: string }) => {
    await updateProductRecord(id, patch);
    setLastMessage(`已保存：${patch.workflowStatus}${patch.notes ? " + 备注" : ""}`);
  };

  const handleSaveAndNext = async (id: string, patch: { workflowStatus: WorkflowStatus; notes: string }) => {
    const currentIndex = filteredRows.findIndex((row) => row.id === id);
    const nextCandidate = currentIndex >= 0 ? filteredRows[currentIndex + 1] : undefined;

    await updateProductRecord(id, patch);

    if (nextCandidate) {
      selectProduct(nextCandidate.id);
      setDetailDrawerOpen(true);
      setLastMessage(`已保存，继续处理下一条：${nextCandidate.productDirection}`);
      return;
    }

    selectProduct(undefined);
    setDetailDrawerOpen(false);
    setLastMessage("🎉 今日待处理队列已清空！");
  };

  const handleExportScoutSync = (row: ProductRecord) => {
    const card = productRecordToScoutCard(row);
    if (!card) {
      setLastMessage("当前记录不是侦察卡，无法导出飞书同步 JSON");
      return;
    }
    const payload = scoutCardToFeishuRecord(card);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadJson(`sync_${row.scoutMeta?.cardId || row.id}_${stamp}.json`, payload);
    setLastMessage(`已导出飞书同步 JSON：${row.productDirection}`);
  };

  const handleExportScoutBatch = (rows: ProductRecord[]) => {
    const cards = rows
      .map((row) => ({ row, card: productRecordToScoutCard(row) }))
      .filter((item): item is { row: ProductRecord; card: ScoutCard } => Boolean(item.card));

    if (cards.length === 0) {
      setLastMessage("当前列表没有可导出的侦察卡记录");
      return;
    }

    const payload = cards.map(({ card }) => scoutCardToFeishuRecord(card));
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadJson(`sync_scout_batch_${stamp}.json`, payload);
    setLastMessage(`已批量导出飞书同步 JSON：${cards.length} 条`);
  };

  return (
    <main
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 24,
        maxWidth: 1440,
        margin: "0 auto",
        minHeight: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <h1 style={{ marginBottom: 12 }}>选品侦察台 v1（发现矩阵首屏）</h1>
      <p style={{ color: "#555", lineHeight: 1.7 }}>
        这版已经不是纯导入页了。现在能做：CSV 导入、Worker 打分、Dexie 入库、发现矩阵筛选、表格排序、虚拟滚动，以及右侧详情修改。
      </p>

      <ImportSection
        importRunning={importRunning}
        importProgress={importProgress}
        currentBatchId={importMeta.currentBatchId}
        importedAt={importMeta.importedAt}
        phase={importMeta.phase}
        rowCount={importMeta.rowCount}
        errorCount={importMeta.errorCount}
        lastMessage={lastMessage}
        errorItems={importMeta.errorItems}
        stats={importMeta.stats}
        onImportFile={(file) => {
          if (file) void importFile(file);
        }}
        onImportSample={() => {
          void importSample();
        }}
        onImportScoutCardFile={(file) => {
          void handleImportScoutCardFile(file);
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

      <section
        style={{
          display: "grid",
          gridTemplateColumns: detailDrawerOpen ? "280px minmax(0, 1fr) 360px" : "280px minmax(0, 1fr)",
          gap: 16,
          marginTop: 24,
          flex: 1,
          minHeight: 0,
          alignItems: "stretch",
        }}
      >
        <FilterSidebar
          filters={filters}
          marketOptions={marketOptions}
          statusOptions={statusOptions}
          riskOptions={riskOptions}
          queueCount={queueCount}
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
          onExportScoutBatch={handleExportScoutBatch}
        />

        <DetailDrawer
          row={selectedRow}
          open={detailDrawerOpen}
          onClose={() => setDetailDrawerOpen(false)}
          onSave={handleSaveDetail}
          onSaveAndNext={handleSaveAndNext}
          showSaveAndNext={showSaveAndNext}
          isLastQueueItem={Boolean(isLastQueueItem)}
          onExportScoutSync={handleExportScoutSync}
        />
      </section>
    </main>
  );
}
