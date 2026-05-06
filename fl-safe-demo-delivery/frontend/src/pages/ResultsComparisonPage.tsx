import { EChartCard } from "../components/EChartCard";
import { MetricCard } from "../components/MetricCard";
import { SystemSnapshot } from "../types";

interface ResultsComparisonPageProps {
  snapshot: SystemSnapshot;
}

export function ResultsComparisonPage({ snapshot }: ResultsComparisonPageProps) {
  const accuracyOption = {
    textStyle: { color: "#d7ebff" },
    tooltip: { trigger: "axis" },
    legend: { top: 0, textStyle: { color: "#8eb3d4" } },
    grid: { left: 40, right: 18, top: 48, bottom: 28 },
    xAxis: {
      type: "category",
      data: snapshot.charts.accuracy.map((item) => `R${item.round}`),
      axisLabel: { color: "#8eb3d4" }
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
        name: "无防御",
        type: "line",
        smooth: true,
        data: snapshot.charts.accuracy.map((item) => item.no_defense),
        lineStyle: { color: "#ff6d88", width: 2 }
      },
      {
        name: "动态防御",
        type: "line",
        smooth: true,
        data: snapshot.charts.accuracy.map((item) => item.protected),
        lineStyle: { color: "#5bffa8", width: 2 }
      }
    ]
  };

  const lossOption = {
    ...accuracyOption,
    yAxis: {
      type: "value",
      axisLabel: { color: "#8eb3d4" },
      splitLine: { lineStyle: { color: "rgba(102, 158, 200, 0.12)" } }
    },
    series: [
      {
        name: "无防御",
        type: "line",
        smooth: true,
        data: snapshot.charts.loss.map((item) => item.no_defense),
        lineStyle: { color: "#ff6d88", width: 2 }
      },
      {
        name: "动态防御",
        type: "line",
        smooth: true,
        data: snapshot.charts.loss.map((item) => item.protected),
        lineStyle: { color: "#5bffa8", width: 2 }
      }
    ]
  };

  const backdoorOption = {
    ...accuracyOption,
    series: [
      {
        name: "无防御",
        type: "line",
        smooth: true,
        data: snapshot.charts.backdoor_success.map((item) => item.no_defense),
        lineStyle: { color: "#ff6d88", width: 2 }
      },
      {
        name: "动态防御",
        type: "line",
        smooth: true,
        data: snapshot.charts.backdoor_success.map((item) => item.protected),
        lineStyle: { color: "#5bffa8", width: 2 }
      }
    ]
  };

  const latest = snapshot.latest_round;
  const latestProtectedAcc = latest ? latest.protected_accuracy : 0;
  const latestBaselineAcc = latest ? latest.no_defense_accuracy : 0;
  const accGap = latestProtectedAcc - latestBaselineAcc;

  return (
    <div className="page-grid">
      <div className="metrics-grid">
        <MetricCard label="防御前准确率" value={latest ? `${(latest.no_defense_accuracy * 100).toFixed(1)}%` : "--"} accent="red" />
        <MetricCard label="防御后准确率" value={latest ? `${(latest.protected_accuracy * 100).toFixed(1)}%` : "--"} accent="green" />
        <MetricCard label="准确率提升" value={`${(accGap * 100).toFixed(1)}%`} accent="cyan" />
        <MetricCard label="识别恶意节点" value={latest ? `${latest.detected_malicious}` : "--"} accent="amber" />
      </div>

      <EChartCard title="准确率对比" subtitle="比赛结论页核心图：有无防御差异一眼可见。" option={accuracyOption} />
      <EChartCard title="损失曲线对比" subtitle="防御后损失回落，说明全局模型逐步恢复稳定。" option={lossOption} />
      <EChartCard title="后门成功率对比" subtitle="后门攻击场景下，防御策略应明显压制成功率。" option={backdoorOption} />

      <section className="panel summary-grid">
        <div className="compare-card accent-success">
          <span>结论 1</span>
          <strong>动态信誉加权能在投毒场景下保住主要精度曲线。</strong>
        </div>
        <div className="compare-card accent-danger">
          <span>结论 2</span>
          <strong>无防御时恶意更新更容易持续污染全局模型。</strong>
        </div>
        <div className="compare-card accent-cyan">
          <span>结论 3</span>
          <strong>相似度分析与异常检测结合后，更适合展示“识别 + 抑制”闭环。</strong>
        </div>
      </section>
    </div>
  );
}
