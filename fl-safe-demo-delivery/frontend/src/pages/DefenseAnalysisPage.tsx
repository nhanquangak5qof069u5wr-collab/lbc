import { EChartCard } from "../components/EChartCard";
import { SystemSnapshot } from "../types";

interface DefenseAnalysisPageProps {
  snapshot: SystemSnapshot;
  runAction: (path: string, payload?: unknown) => Promise<unknown>;
}

export function DefenseAnalysisPage({ snapshot, runAction }: DefenseAnalysisPageProps) {
  const anomalyOption = {
    textStyle: { color: "#d7ebff" },
    grid: { left: 48, right: 18, top: 34, bottom: 42 },
    xAxis: {
      type: "category",
      data: snapshot.charts.anomaly.map((item) => item.name),
      axisLabel: { color: "#8eb3d4", rotate: 18 },
      axisLine: { lineStyle: { color: "#335a76" } }
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      axisLabel: { color: "#8eb3d4" },
      splitLine: { lineStyle: { color: "rgba(102, 158, 200, 0.12)" } }
    },
    series: [
      {
        type: "bar",
        data: snapshot.charts.anomaly.map((item) => ({
          value: item.value,
          itemStyle: {
            color: item.status === "isolated" ? "#7b8ba4" : item.status === "malicious" ? "#ff5c7a" : item.status === "suspicious" || item.status === "downweighted" ? "#ffd166" : "#45e0ff"
          }
        })),
        barWidth: 28,
        borderRadius: [12, 12, 0, 0]
      }
    ]
  };

  const reputationOption = {
    textStyle: { color: "#d7ebff" },
    tooltip: { trigger: "axis" },
    legend: {
      type: "scroll",
      top: 0,
      textStyle: { color: "#8eb3d4" }
    },
    grid: { left: 40, right: 18, top: 52, bottom: 28 },
    xAxis: {
      type: "category",
      data: Array.from({ length: Math.max(snapshot.current_round, 1) }, (_, index) => `R${index + 1}`),
      axisLabel: { color: "#8eb3d4" },
      axisLine: { lineStyle: { color: "#335a76" } }
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      axisLabel: { color: "#8eb3d4" },
      splitLine: { lineStyle: { color: "rgba(102, 158, 200, 0.12)" } }
    },
    series: snapshot.charts.reputation.map((series) => ({
      name: series.name,
      type: "line",
      smooth: true,
      data: series.values.map((point) => point.value),
      showSymbol: false
    }))
  };

  const labels = snapshot.charts.similarity_matrix.labels.map((label) => label.replace("client_", "C"));
  const heatmapData = snapshot.charts.similarity_matrix.values.flatMap((row, rowIndex) =>
    row.map((value, columnIndex) => [columnIndex, rowIndex, value])
  );

  const similarityOption = {
    textStyle: { color: "#d7ebff" },
    tooltip: { position: "top" },
    grid: { left: 70, right: 24, top: 22, bottom: 46 },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#8eb3d4" },
      splitArea: { show: true }
    },
    yAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#8eb3d4" },
      splitArea: { show: true }
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 0,
      textStyle: { color: "#8eb3d4" },
      inRange: {
        color: ["#ff5c7a", "#1f3145", "#66f4ff"]
      }
    },
    series: [
      {
        type: "heatmap",
        data: heatmapData,
        label: { show: true, color: "#d7ebff", formatter: ({ value }: { value: [number, number, number] }) => value[2].toFixed(2) }
      }
    ]
  };

  const weightOption = {
    textStyle: { color: "#d7ebff" },
    grid: { left: 48, right: 18, top: 34, bottom: 42 },
    xAxis: {
      type: "category",
      data: snapshot.charts.weights.map((item) => item.name),
      axisLabel: { color: "#8eb3d4", rotate: 18 },
      axisLine: { lineStyle: { color: "#335a76" } }
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#8eb3d4",
        formatter: (value: number) => `${Math.round(value * 100)}%`
      },
      splitLine: { lineStyle: { color: "rgba(102, 158, 200, 0.12)" } }
    },
    series: [
      {
        type: "bar",
        data: snapshot.charts.weights.map((item) => ({
          value: item.value,
          itemStyle: {
            color: item.status === "isolated" ? "#7b8ba4" : item.status === "malicious" ? "#ff5c7a" : item.status === "suspicious" || item.status === "downweighted" ? "#ffd166" : "#5bffa8"
          }
        })),
        barWidth: 28,
        borderRadius: [12, 12, 0, 0]
      }
    ]
  };

  const isolatedClients = snapshot.clients.filter((client) => client.is_isolated);

  return (
    <div className="page-grid">
      <section className="panel form-panel compact">
        <div className="panel-header">
          <div>
            <h3>防御控制</h3>
            <p>异常检测、信誉更新与鲁棒聚合可单独讲解。</p>
          </div>
        </div>
        <div className="button-row">
          <button
            className="action-button primary"
            onClick={() =>
              runAction("/api/defense/enable", {
                ...snapshot.defense,
                enabled: true,
                mode: "dynamic_reputation"
              })
            }
          >
            开启动态防御
          </button>
          <button className="action-button" onClick={() => runAction("/api/defense/disable")}>关闭防御</button>
        </div>
        <div className="info-block">
          <div><span>防御模式</span><strong>{snapshot.defense.mode}</strong></div>
          <div><span>异常阈值</span><strong>{snapshot.defense.anomaly_threshold.toFixed(2)}</strong></div>
          <div><span>隔离阈值</span><strong>{snapshot.defense.isolate_threshold.toFixed(2)}</strong></div>
          <div><span>信誉下限</span><strong>{snapshot.defense.reputation_floor.toFixed(2)}</strong></div>
        </div>
      </section>

      <EChartCard title="梯度异常分布" subtitle="异常分数越高，越可能成为可疑或恶意节点。" option={anomalyOption} />
      <EChartCard title="节点相似度热力图" subtitle="协同投毒时，恶意节点会形成高相似异常簇。" option={similarityOption} />
      <EChartCard title="动态信誉评分" subtitle="信誉分综合历史行为和当前异常程度。" option={reputationOption} />
      <EChartCard title="聚合权重分配" subtitle="降权与隔离会直接反映到服务端聚合权重。" option={weightOption} />

      <section className="panel list-panel">
        <div className="panel-header">
          <div>
            <h3>当前隔离节点</h3>
            <p>该列表适合在答辩时解释剔除机制。</p>
          </div>
        </div>
        {isolatedClients.length === 0 ? (
          <p className="empty-state">本轮尚未触发隔离，系统仍在观测风险节点。</p>
        ) : (
          <div className="tag-row">
            {isolatedClients.map((client) => (
              <span className="status-pill neutral" key={client.client_id}>
                {client.name} · 信誉 {Math.round(client.reputation_score * 100)}
              </span>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
