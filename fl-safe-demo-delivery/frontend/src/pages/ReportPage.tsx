import { MetricCard } from "../components/MetricCard";
import { SystemSnapshot } from "../types";

interface ReportPageProps {
  snapshot: SystemSnapshot;
  onExport: () => Promise<void>;
}

export function ReportPage({ snapshot, onExport }: ReportPageProps) {
  const report = snapshot.report;

  return (
    <div className="page-grid two-column">
      <div className="metrics-grid">
        <MetricCard label="实验编号" value={report.experiment_id ?? "EXP-000"} />
        <MetricCard label="攻击类型" value={report.attack_type ?? "none"} accent="red" />
        <MetricCard label="识别节点数" value={`${report.identified_nodes ?? 0}`} accent="amber" />
        <MetricCard label="隔离节点数" value={`${report.isolated_clients?.length ?? 0}`} accent="green" />
      </div>

      <section className="panel report-panel">
        <div className="panel-header">
          <div>
            <h3>实验报告摘要</h3>
            <p>适合直接截图或导出为 Markdown 作为比赛材料。</p>
          </div>
          <button className="action-button primary" onClick={onExport}>导出 Markdown</button>
        </div>
        <div className="report-summary">
          <p>{report.summary || "等待训练开始后自动生成报告摘要。"}</p>
          <div className="info-block">
            <div><span>防御前准确率</span><strong>{((report.accuracy_before ?? 0) * 100).toFixed(1)}%</strong></div>
            <div><span>防御后准确率</span><strong>{((report.accuracy_after ?? 0) * 100).toFixed(1)}%</strong></div>
            <div><span>防御前后门成功率</span><strong>{((report.backdoor_before ?? 0) * 100).toFixed(1)}%</strong></div>
            <div><span>防御后后门成功率</span><strong>{((report.backdoor_after ?? 0) * 100).toFixed(1)}%</strong></div>
          </div>
          <div className="tag-row">
            {(report.isolated_clients ?? []).map((clientId) => (
              <span className="status-pill neutral" key={clientId}>
                {clientId}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
