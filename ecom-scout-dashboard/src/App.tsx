export default function App() {
  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>选品侦察台 v1（重构版）</h1>
      <p style={{ color: "#555", lineHeight: 1.7 }}>
        这版不追求花哨图表，先把最值钱的主链路定死：CSV 导入、规则判案、Dexie 入库、高性能表格、右侧详情抽屉。
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>现在已固定</h2>
        <ul>
          <li>Eligibility Gate（先判能不能做）</li>
          <li>RPS v1（线性打分 + 固定风险扣分）</li>
          <li>数据过期 / 待补证 / 过热拥挤标签</li>
          <li>Dexie 主仓 + Zustand 仅存 UI 状态</li>
          <li>Worker 直接入库骨架</li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>下一步最自然</h2>
        <ol>
          <li>把 PapaParse + Zod 接到真实 CSV</li>
          <li>让 Worker 真跑导入 + bulkPut</li>
          <li>做第一版 TanStack Table + useLiveQuery</li>
        </ol>
      </section>
    </main>
  );
}
