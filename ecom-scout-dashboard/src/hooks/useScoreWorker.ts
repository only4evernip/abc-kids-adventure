import { useEffect, useRef, useState } from "react";
import { useScoutStore } from "../store/useScoutStore";
import type { ScoreWorkerOutput } from "../workers/score.worker";

function batchId() {
  return `batch_${Date.now()}`;
}

export function useScoreWorker() {
  const workerRef = useRef<Worker | null>(null);
  const [lastMessage, setLastMessage] = useState<string>("还没导入 CSV");

  const setImportRunning = useScoutStore((s) => s.setImportRunning);
  const setImportProgress = useScoutStore((s) => s.setImportProgress);
  const setImportMeta = useScoutStore((s) => s.setImportMeta);

  useEffect(() => {
    const worker = new Worker(new URL("../workers/score.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;

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
          errorItems: data.errorItems,
          stats: data.stats,
        });
        setLastMessage(`导入完成：成功 ${data.count} 条，失败 ${data.errorCount} 条`);
        return;
      }

      if (data.type === "error") {
        setImportRunning(false);
        setLastMessage(`导入失败：${data.message}`);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [setImportMeta, setImportProgress, setImportRunning]);

  const importFile = async (file: File, label?: string) => {
    const id = batchId();
    setImportRunning(true);
    setImportProgress(0);
    setImportMeta({
      currentBatchId: id,
      importedAt: new Date().toISOString(),
      rowCount: 0,
      errorCount: 0,
      errorItems: [],
      stats: { insertedCount: 0, updatedCount: 0, preservedManualStatusCount: 0, preservedNotesCount: 0 },
    });
    setLastMessage(`开始导入：${label || file.name}`);
    workerRef.current?.postMessage({ batchId: id, file });
  };

  const importSample = async () => {
    const res = await fetch("/samples/candidate-pool-us-ca.csv");
    const blob = await res.blob();
    const file = new File([blob], "candidate-pool-us-ca.csv", { type: "text/csv" });
    await importFile(file, "内置样本 candidate-pool-us-ca.csv");
  };

  return {
    lastMessage,
    setLastMessage,
    importFile,
    importSample,
  };
}
