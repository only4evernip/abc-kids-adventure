import { create } from "zustand";

export interface FilterState {
  market?: string;
  risk?: string;
  minScore?: number;
  maxScore?: number;
  keyword?: string;
  workflowStatus?: string;
}

export type ImportPhase = "idle" | "parsing" | "validating" | "saving" | "done" | "failed";

export interface ImportErrorItem {
  rowNumber: number;
  reason: string;
  field?: string;
  valuePreview?: string;
}

interface ImportStats {
  insertedCount: number;
  updatedCount: number;
  preservedManualStatusCount: number;
  preservedNotesCount: number;
}

interface ImportMeta {
  importedAt?: string;
  rowCount: number;
  errorCount: number;
  currentBatchId?: string;
  phase: ImportPhase;
  errorItems: ImportErrorItem[];
  stats: ImportStats;
}

interface ScoutState {
  filters: FilterState;
  selectedProductId?: string;
  detailDrawerOpen: boolean;
  importRunning: boolean;
  importProgress: number;
  importMeta: ImportMeta;
  setFilters: (patch: Partial<FilterState>) => void;
  resetFilters: () => void;
  selectProduct: (id?: string) => void;
  setDetailDrawerOpen: (open: boolean) => void;
  setImportRunning: (running: boolean) => void;
  setImportProgress: (progress: number) => void;
  setImportMeta: (meta: Partial<ImportMeta>) => void;
}

export const useScoutStore = create<ScoutState>((set) => ({
  filters: {},
  selectedProductId: undefined,
  detailDrawerOpen: false,
  importRunning: false,
  importProgress: 0,
  importMeta: {
    rowCount: 0,
    errorCount: 0,
    currentBatchId: undefined,
    importedAt: undefined,
    phase: "idle",
    errorItems: [],
    stats: {
      insertedCount: 0,
      updatedCount: 0,
      preservedManualStatusCount: 0,
      preservedNotesCount: 0,
    },
  },
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set(() => ({ filters: {} })),
  selectProduct: (id) => set(() => ({ selectedProductId: id })),
  setDetailDrawerOpen: (open) => set(() => ({ detailDrawerOpen: open })),
  setImportRunning: (running) => set(() => ({ importRunning: running })),
  setImportProgress: (progress) => set(() => ({ importProgress: progress })),
  setImportMeta: (meta) => set((state) => ({ importMeta: { ...state.importMeta, ...meta } })),
}));
