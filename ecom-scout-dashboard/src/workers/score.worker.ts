// 这里只放骨架，后续接 PapaParse + Zod + RPS 评分。
// 目的：避免大 CSV 解析和打分卡住 React 主线程。

import { calculateRps } from "../domain/rps";
import type { ProductRow } from "../types/product";

export interface ScoreWorkerInput {
  rows: ProductRow[];
}

export interface ScoreWorkerOutput {
  rows: Array<ProductRow & { rps: ReturnType<typeof calculateRps> }>;
}

self.onmessage = (event: MessageEvent<ScoreWorkerInput>) => {
  const rows = event.data.rows || [];
  const scored = rows.map((row) => ({
    ...row,
    rps: calculateRps(row),
  }));

  const payload: ScoreWorkerOutput = { rows: scored };
  self.postMessage(payload);
};
