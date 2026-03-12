import { useMemo, useRef, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import type { ProductRecord } from "../../types/product";

interface Props {
  rows: ProductRecord[];
  selectedProductId?: string;
  sorting: SortingState;
  setSorting: (updater: SortingState) => void;
  onSelect: (id: string) => void;
}

const GRID_TEMPLATE = "110px minmax(240px,1.3fr) minmax(220px,1.1fr) 90px 110px 90px minmax(180px,1fr) 180px";
const ROW_HEIGHT = 74;

export function ProductTable({ rows, selectedProductId, sorting, setSorting, onSelect }: Props) {
  const parentRef = useRef<HTMLDivElement | null>(null);

  const columns = useMemo<ColumnDef<ProductRecord>[]>(
    () => [
      { accessorKey: "market", header: "市场" },
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
        cell: ({ row }) => {
          const isManual = row.original.workflowStatusSource === "manual";
          const statusChanged = row.original.workflowStatus !== row.original.rps.suggestedStatus;

          return (
            <div>
              <div style={{ fontWeight: 600 }}>{row.original.workflowStatus}</div>
              <div style={{ color: statusChanged ? "#ad6800" : "#666", fontSize: 12 }}>
                {isManual ? "人工" : "系统"} · 建议 {row.original.rps.suggestedStatus}
              </div>
            </div>
          );
        },
      },
      { id: "risk", accessorFn: (row) => row.overallRisk || "-", header: "风险" },
      {
        id: "tags",
        accessorFn: (row) => row.rps.falsePositiveTags.join(" / "),
        header: "标签",
        cell: ({ row }) => <div style={{ maxWidth: 260 }}>{row.original.rps.falsePositiveTags.length === 0 ? "-" : row.original.rps.falsePositiveTags.join(" / ")}</div>,
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
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      setSorting(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableRows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>发现矩阵</h2>
          <div style={{ color: "#666", fontSize: 13 }}>当前结果 {rows.length} 条，支持排序、虚拟滚动与点击查看详情。</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12, color: "#555" }}>
          <span style={legendBadge("#f0f5ff", "#2f54eb")}>人工接管</span>
          <span style={legendBadge("#fffbe6", "#faad14")}>状态分叉</span>
          <span style={legendBadge("#f6ffed", "#52c41a")}>高分待处理</span>
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: GRID_TEMPLATE, background: "#f7f7f7", borderBottom: "1px solid #eee" }}>
          {table.getHeaderGroups().map((headerGroup) =>
            headerGroup.headers.map((header) => (
              <div key={header.id} style={th} onClick={header.column.getToggleSortingHandler()}>
                <span style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                </span>
              </div>
            ))
          )}
        </div>

        {tableRows.length === 0 ? (
          <div style={{ padding: 16, color: "#666" }}>没有符合条件的数据。</div>
        ) : (
          <div ref={parentRef} style={{ flex: 1, minHeight: 0, overflow: "auto", position: "relative" }}>
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {virtualRows.map((virtualRow) => {
                const row = tableRows[virtualRow.index];
                const isManual = row.original.workflowStatusSource === "manual";
                const isChanged = row.original.workflowStatus !== row.original.rps.suggestedStatus;
                const isReviewPriority = row.original.rps.score.finalScore >= 80 && ["待评估", "观察池", "待补证"].includes(row.original.workflowStatus);
                const isSelected = selectedProductId === row.original.id;

                let background = "#fff";
                let boxShadow = "inset 0 0 0 0 transparent";

                if (isReviewPriority) {
                  background = "#f6ffed";
                  boxShadow = "inset 4px 0 0 #52c41a";
                }
                if (isChanged) {
                  background = "#fffbe6";
                  boxShadow = "inset 4px 0 0 #faad14";
                }
                if (isManual) {
                  background = "#f0f5ff";
                  boxShadow = "inset 4px 0 0 #2f54eb";
                }
                if (isSelected) {
                  background = "#e6f4ff";
                  boxShadow = "inset 4px 0 0 #1677ff";
                }

                return (
                  <div
                    key={row.id}
                    onClick={() => onSelect(row.original.id)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "grid",
                      gridTemplateColumns: GRID_TEMPLATE,
                      cursor: "pointer",
                      background,
                      boxShadow,
                      borderBottom: "1px solid #f0f0f0",
                      minHeight: ROW_HEIGHT,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <div key={cell.id} style={td}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function legendBadge(background: string, color: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 8px",
    borderRadius: 999,
    background,
    color: "#333",
    boxShadow: `inset 3px 0 0 ${color}`,
  };
}

const panelStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  minHeight: 0,
  height: "100%",
  display: "flex",
  flexDirection: "column",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  whiteSpace: "nowrap",
  userSelect: "none",
  fontWeight: 600,
};

const td: CSSProperties = {
  padding: "12px 10px",
  verticalAlign: "top",
  overflow: "hidden",
};
