import { create } from "zustand";
import type { ProductRow, RpsResult } from "../types/product";

interface ImportMeta {
  importedAt?: string;
  rowCount: number;
  missingColumns: string[];
}

interface ScoutState {
  rawRows: ProductRow[];
  scoredRows: Array<ProductRow & { rps: RpsResult }>;
  filters: {
    market?: string;
    risk?: string;
    minScore?: number;
    maxScore?: number;
    keyword?: string;
  };
  selectedAsin?: string;
  importMeta: ImportMeta;
  notes: Record<string, string>;
  setRawRows: (rows: ProductRow[]) => void;
  setScoredRows: (rows: Array<ProductRow & { rps: RpsResult }>) => void;
  setFilters: (patch: Partial<ScoutState["filters"]>) => void;
  selectAsin: (asin?: string) => void;
  setNote: (id: string, note: string) => void;
}

export const useScoutStore = create<ScoutState>((set) => ({
  rawRows: [],
  scoredRows: [],
  filters: {},
  importMeta: {
    rowCount: 0,
    missingColumns: [],
  },
  notes: {},
  setRawRows: (rows) =>
    set(() => ({
      rawRows: rows,
      importMeta: {
        importedAt: new Date().toISOString(),
        rowCount: rows.length,
        missingColumns: [],
      },
    })),
  setScoredRows: (rows) => set(() => ({ scoredRows: rows })),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  selectAsin: (asin) => set(() => ({ selectedAsin: asin })),
  setNote: (id, note) => set((state) => ({ notes: { ...state.notes, [id]: note } })),
}));
