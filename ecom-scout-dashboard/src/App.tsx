export default function App() {
  return (
    <main style={{ fontFamily: "Inter, system-ui, sans-serif", padding: 24, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>选品侦察台 v1 骨架</h1>
      <p style={{ color: "#555", lineHeight: 1.7 }}>
        这个壳子现在不追求花哨页面，先把最值钱的东西固定：字段映射、Eligibility Gate、RPS 规则、状态机和本地评分流水线。
      </p>

      <section style={{ marginTop: 24 }}>
        <h2>当前已固化</h2>
        <ul>
          <li>CSV 字段字典</li>
          <li>RPS 规则表 v1</li>
          <li>状态流转规则</li>
          <li>Zustand store 骨架</li>
          <li>Worker 评分骨架</li>
        </ul>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2>下一步最自然</h2>
        <ol>
          <li>接 PapaParse + Zod，把真实 CSV 导进来</li>
          <li>把 calculateRps 挂到 worker</li>
          <li>做发现矩阵页（筛选 + 表格 + RPS 标签）</li>
        </ol>
      </section>
    </main>
  );
}
