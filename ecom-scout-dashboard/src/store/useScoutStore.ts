import { create } from "zustand";

interface FilterState {
  market?: string;
  risk?: string;
  minScore?: number;
  maxScore?: number;
  keyword?: string;
  workflowStatus?: string;
}

interface ImportMeta {
  importedAt?: string;
  rowCount: number;
  errorCount: number;
  currentBatchId?: string;
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
  },
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  resetFilters: () => set(() => ({ filters: {} })),
  selectProduct: (id) => set(() => ({ selectedProductId: id })),
  setDetailDrawerOpen: (open) => set(() => ({ detailDrawerOpen: open })),
  setImportRunning: (running) => set(() => ({ importRunning: running })),
  setImportProgress: (progress) => set(() => ({ importProgress: progress })),
  setImportMeta: (meta) => set((state) => ({ importMeta: { ...state.importMeta, ...meta } })),
}));
