import { useMemo, type CSSProperties } from "react";
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

export function ProductTable({ rows, selectedProductId, sorting, setSorting, onSelect }: Props) {
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

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>发现矩阵</h2>
          <div style={{ color: "#666", fontSize: 13 }}>当前结果 {rows.length} 条，支持排序与点击查看详情。</div>
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
                  onClick={() => onSelect(row.original.id)}
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
  borderBottom: "1px solid #eee",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const td: CSSProperties = {
  padding: "12px 10px",
  borderBottom: "1px solid #f0f0f0",
  verticalAlign: "top",
};
