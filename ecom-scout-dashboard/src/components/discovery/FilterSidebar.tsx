import type { CSSProperties } from "react";
import type { FilterState } from "../../store/useScoutStore";

interface Props {
  filters: FilterState;
  marketOptions: string[];
  statusOptions: string[];
  riskOptions: string[];
  setFilters: (patch: Partial<FilterState>) => void;
  resetFilters: () => void;
}

export function FilterSidebar({ filters, marketOptions, statusOptions, riskOptions, setFilters, resetFilters }: Props) {
  return (
    <aside style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>筛选器</h2>
      <div style={fieldBlock}>
        <label style={labelStyle}>关键词搜索</label>
        <input
          value={filters.keyword || ""}
          onChange={(e) => setFilters({ keyword: e.target.value })}
          placeholder="搜关键词 / 产品方向"
          style={inputStyle}
        />
        <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>输入后会延迟约 250ms 再触发筛选，避免大表卡顿。</div>
      </div>

      <div style={fieldBlock}>
        <label style={labelStyle}>市场</label>
        <select value={filters.market || ""} onChange={(e) => setFilters({ market: e.target.value || undefined })} style={inputStyle}>
          <option value="">全部</option>
          {marketOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div style={fieldBlock}>
        <label style={labelStyle}>状态</label>
        <select value={filters.workflowStatus || ""} onChange={(e) => setFilters({ workflowStatus: e.target.value || undefined })} style={inputStyle}>
          <option value="">全部</option>
          {statusOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div style={fieldBlock}>
        <label style={labelStyle}>风险</label>
        <select value={filters.risk || ""} onChange={(e) => setFilters({ risk: e.target.value || undefined })} style={inputStyle}>
          <option value="">全部</option>
          {riskOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div style={fieldBlock}>
        <label style={labelStyle}>最低 RPS</label>
        <input type="number" value={filters.minScore ?? ""} onChange={(e) => setFilters({ minScore: e.target.value ? Number(e.target.value) : undefined })} style={inputStyle} />
      </div>

      <div style={fieldBlock}>
        <label style={labelStyle}>最高 RPS</label>
        <input type="number" value={filters.maxScore ?? ""} onChange={(e) => setFilters({ maxScore: e.target.value ? Number(e.target.value) : undefined })} style={inputStyle} />
      </div>

      <div style={fieldBlock}>
        <label style={labelStyle}>专用工作流捷径</label>
        <div style={quickFilterList}>
          <label style={quickFilterItem}>
            <input type="checkbox" checked={Boolean(filters.manualOnly)} onChange={(e) => setFilters({ manualOnly: e.target.checked || undefined })} />
            <span>只看人工接管</span>
          </label>
          <label style={quickFilterItem}>
            <input type="checkbox" checked={Boolean(filters.changedOnly)} onChange={(e) => setFilters({ changedOnly: e.target.checked || undefined })} />
            <span>只看状态分叉</span>
          </label>
          <label style={quickFilterItem}>
            <input type="checkbox" checked={Boolean(filters.reviewPriorityOnly)} onChange={(e) => setFilters({ reviewPriorityOnly: e.target.checked || undefined })} />
            <span>只看高分待处理</span>
          </label>
        </div>
      </div>

      <button onClick={resetFilters} style={{ ...actionButton, width: "100%" }}>重置筛选</button>
    </aside>
  );
}

const panelStyle: CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  minHeight: 0,
  height: "100%",
  boxSizing: "border-box",
  alignSelf: "stretch",
};

const fieldBlock: CSSProperties = {
  marginBottom: 14,
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#555",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: "10px 12px",
  background: "#fff",
  boxSizing: "border-box",
};

const actionButton: CSSProperties = {
  border: "1px solid #ddd",
  background: "#fff",
  padding: "10px 14px",
  borderRadius: 10,
  cursor: "pointer",
};

const quickFilterList: CSSProperties = {
  display: "grid",
  gap: 8,
};

const quickFilterItem: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#333",
};
