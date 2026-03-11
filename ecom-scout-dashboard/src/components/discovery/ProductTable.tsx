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
      { accessorKey: "workflowStatus", header: "状态" },
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>发现矩阵</h2>
          <div style={{ color: "#666", fontSize: 13 }}>当前结果 {rows.length} 条，支持排序、虚拟滚动与点击查看详情。</div>
        </div>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
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
          <div ref={parentRef} style={{ height: 560, overflow: "auto", position: "relative" }}>
            <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
              {virtualRows.map((virtualRow) => {
                const row = tableRows[virtualRow.index];
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
                      background: selectedProductId === row.original.id ? "#f5f9ff" : "#fff",
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

const panelStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  minHeight: 200,
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
