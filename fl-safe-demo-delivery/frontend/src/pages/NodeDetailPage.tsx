import { EChartCard } from "../components/EChartCard";
import { SystemSnapshot } from "../types";

interface NodeDetailPageProps {
  snapshot: SystemSnapshot;
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
}

export function NodeDetailPage({ snapshot, selectedClientId, onSelectClient }: NodeDetailPageProps) {
  const client = snapshot.clients.find((item) => item.client_id === selectedClientId) ?? snapshot.clients[0];
  if (!client) {
    return null;
  }
  const reputationSeries = snapshot.charts.reputation.find((series) => series.client_id === client.client_id)?.values ?? [];
  const history = reputationSeries.map((item) => item.value);
  const anomalyHistory = snapshot.charts.accuracy.map((_, index) => {
    const flag = client.history_flags[index];
    return flag?.includes("isolated") ? 0.92 : flag?.includes("suspicious") || flag?.includes("downweighted") ? 0.66 : 0.28;
  });

  const option = {
    textStyle: { color: "#d7ebff" },
    tooltip: { trigger: "axis" },
    legend: { top: 0, textStyle: { color: "#8eb3d4" } },
    grid: { left: 40, right: 18, top: 48, bottom: 28 },
    xAxis: {
      type: "category",
      data: history.map((_, index) => `R${index + 1}`),
      axisLabel: { color: "#8eb3d4" }
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
        name: "信誉分",
        type: "line",
        smooth: true,
        data: history,
        lineStyle: { color: "#5bffa8", width: 2 }
      },
      {
        name: "历史风险强度",
        type: "line",
        smooth: true,
        data: anomalyHistory,
        lineStyle: { color: "#ff6d88", width: 2 }
      }
    ]
  };

  return (
    <div className="page-grid two-column">
      <section className="panel form-panel">
        <div className="panel-header">
          <div>
            <h3>节点详情</h3>
            <p>可用于讲解单个机构在不同轮次下的信誉演化。</p>
          </div>
        </div>
        <label>
          <span>选择节点</span>
          <select value={client.client_id} onChange={(event) => onSelectClient(event.target.value)}>
            {snapshot.clients.map((item) => (
              <option key={item.client_id} value={item.client_id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <div className="info-block">
          <div><span>节点角色</span><strong>{client.role}</strong></div>
          <div><span>节点状态</span><strong>{client.status}</strong></div>
          <div><span>本地数据量</span><strong>{client.local_data_size}</strong></div>
          <div><span>梯度范数</span><strong>{client.gradient_norm.toFixed(3)}</strong></div>
          <div><span>异常分数</span><strong>{client.anomaly_score.toFixed(3)}</strong></div>
          <div><span>信誉分</span><strong>{client.reputation_score.toFixed(3)}</strong></div>
          <div><span>聚合权重</span><strong>{(client.current_weight * 100).toFixed(2)}%</strong></div>
          <div><span>是否隔离</span><strong>{client.is_isolated ? "是" : "否"}</strong></div>
        </div>

        <div className="tag-row">
          {client.history_flags.length === 0 ? (
            <span className="status-pill success">历史状态稳定</span>
          ) : (
            client.history_flags.map((flag) => (
              <span className="status-pill neutral" key={flag}>
                {flag}
              </span>
            ))
          )}
        </div>
      </section>

      <EChartCard title={`${client.name} 历史信誉轨迹`} subtitle="绿色为信誉变化，红线用于提示历史风险水平。" option={option} />
    </div>
  );
}
