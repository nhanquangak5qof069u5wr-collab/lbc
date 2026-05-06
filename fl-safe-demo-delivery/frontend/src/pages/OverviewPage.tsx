import { EChartCard } from "../components/EChartCard";
import { MetricCard } from "../components/MetricCard";
import { NodeTopology } from "../components/NodeTopology";
import { SystemSnapshot } from "../types";

interface OverviewPageProps {
  snapshot: SystemSnapshot;
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
}

export function OverviewPage({ snapshot, selectedClientId, onSelectClient }: OverviewPageProps) {
  const latest = snapshot.latest_round;
  const maliciousCount = snapshot.clients.filter((client) => client.role === "malicious").length;
  const normalCount = snapshot.clients.filter((client) => client.role === "normal").length;
  const isolatedCount = snapshot.clients.filter((client) => client.is_isolated).length;

  const accuracyOption = {
    textStyle: { color: "#d7ebff" },
    tooltip: { trigger: "axis" },
    grid: { left: 40, right: 18, top: 34, bottom: 28 },
    xAxis: {
      type: "category",
      data: snapshot.charts.accuracy.map((item) => `R${item.round}`),
      axisLabel: { color: "#8eb3d4" },
      axisLine: { lineStyle: { color: "#335a76" } }
    },
    yAxis: {
      type: "value",
      min: 0,
      max: 1,
      axisLabel: {
        color: "#8eb3d4",
        formatter: (value: number) => `${Math.round(value * 100)}%`
      },
      splitLine: { lineStyle: { color: "rgba(102, 158, 200, 0.12)" } }
    },
    series: [
      {
        name: "当前策略",
        type: "line",
        smooth: true,
        data: snapshot.charts.accuracy.map((item) => item.actual),
        lineStyle: { color: "#66e5ff", width: 3 },
        areaStyle: { color: "rgba(102, 229, 255, 0.16)" }
      }
    ]
  };

  return (
    <div className="page-grid">
      <div className="metrics-grid">
        <MetricCard label="当前轮次" value={`R${snapshot.current_round}`} hint={snapshot.running ? "自动运行中" : "手动控制中"} />
        <MetricCard label="全局准确率" value={latest ? `${(latest.global_accuracy * 100).toFixed(1)}%` : "--"} accent="green" />
        <MetricCard label="全局损失" value={latest ? latest.global_loss.toFixed(3) : "--"} accent="amber" />
        <MetricCard label="后门成功率" value={latest ? `${(latest.backdoor_success_rate * 100).toFixed(1)}%` : "--"} accent="red" />
        <MetricCard label="恶意节点数" value={`${maliciousCount}`} accent="red" hint={`正常节点 ${normalCount}`} />
        <MetricCard label="隔离节点数" value={`${isolatedCount}`} accent="amber" hint={`攻击模式 ${snapshot.attack.attack_type}`} />
      </div>

      <NodeTopology
        clients={snapshot.clients}
        selectedClientId={selectedClientId}
        onSelectClient={onSelectClient}
      />

      <EChartCard
        title="全局精度走势"
        subtitle="首页突出当前策略下的模型恢复效果。"
        option={accuracyOption}
      />

      <section className="panel event-panel">
        <div className="panel-header">
          <div>
            <h3>实时事件流</h3>
            <p>用于比赛现场讲解系统状态变化。</p>
          </div>
        </div>
        <div className="event-list">
          {snapshot.recent_events.map((event) => (
            <article className={`event-item event-${event.event_type}`} key={`${event.created_at}-${event.message}`}>
              <div className="event-meta">
                <span>{event.event_type}</span>
                <time>{new Date(event.created_at).toLocaleTimeString("zh-CN", { hour12: false })}</time>
              </div>
              <p>{event.message}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
