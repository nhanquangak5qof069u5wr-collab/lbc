import { useEffect, useMemo, useState } from "react";
import { AttackControlPage } from "./pages/AttackControlPage";
import { DefenseAnalysisPage } from "./pages/DefenseAnalysisPage";
import { NodeDetailPage } from "./pages/NodeDetailPage";
import { OverviewPage } from "./pages/OverviewPage";
import { ReportPage } from "./pages/ReportPage";
import { ResultsComparisonPage } from "./pages/ResultsComparisonPage";
import { useLiveSystemState } from "./hooks/useLiveSystemState";

type ViewKey = "overview" | "attack" | "defense" | "results" | "detail" | "report";

const navItems: Array<{ key: ViewKey; label: string; hint: string }> = [
  { key: "overview", label: "系统总览", hint: "节点态势与全局指标" },
  { key: "attack", label: "攻击控制", hint: "现场切换攻击模式" },
  { key: "defense", label: "防御分析", hint: "异常检测与信誉评估" },
  { key: "results", label: "结果对比", hint: "防御前后差异展示" },
  { key: "detail", label: "节点详情", hint: "单节点状态剖析" },
  { key: "report", label: "实验报告", hint: "导出结果摘要" }
];

function App() {
  const { snapshot, loading, error, actions } = useLiveSystemState();
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedClientId && snapshot?.clients.length) {
      setSelectedClientId(snapshot.clients[0].client_id);
    }
  }, [selectedClientId, snapshot]);

  const headerStatus = useMemo(() => {
    if (!snapshot) return "正在加载";
    if (snapshot.running) return "自动运行";
    return "待命";
  }, [snapshot]);

  if (loading && !snapshot) {
    return <div className="app-shell loading-shell">系统初始化中，请稍候...</div>;
  }

  if (!snapshot) {
    return <div className="app-shell loading-shell">无法加载系统状态：{error}</div>;
  }

  const openClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveView("detail");
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-chip">FLSafeGuard</span>
          <h1>联邦学习安全攻防展示系统</h1>
          <p>医疗联邦学习场景 · 攻防演示版</p>
        </div>
        <nav className="nav-stack">
          {navItems.map((item) => (
            <button
              key={item.key}
              className={`nav-button ${activeView === item.key ? "active" : ""}`}
              onClick={() => setActiveView(item.key)}
            >
              <strong>{item.label}</strong>
              <span>{item.hint}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar panel">
          <div>
            <h2>{navItems.find((item) => item.key === activeView)?.label}</h2>
            <p>
              当前轮次 R{snapshot.current_round} · 攻击 {snapshot.attack.attack_type} · 防御{" "}
              {snapshot.defense.enabled ? snapshot.defense.mode : "none"}
            </p>
          </div>
          <div className="topbar-status">
            <span className={`status-pill ${snapshot.running ? "success" : "neutral"}`}>{headerStatus}</span>
            <span className={`status-pill ${snapshot.attack.enabled ? "danger" : "neutral"}`}>
              {snapshot.attack.enabled ? "攻击开启" : "攻击关闭"}
            </span>
            <span className={`status-pill ${snapshot.defense.enabled ? "success" : "danger"}`}>
              {snapshot.defense.enabled ? "防御开启" : "防御关闭"}
            </span>
          </div>
        </header>

        {error ? <div className="toast-banner">{error}</div> : null}

        {activeView === "overview" ? (
          <OverviewPage snapshot={snapshot} selectedClientId={selectedClientId} onSelectClient={openClient} />
        ) : null}
        {activeView === "attack" ? (
          <AttackControlPage snapshot={snapshot} runAction={actions.run} />
        ) : null}
        {activeView === "defense" ? (
          <DefenseAnalysisPage snapshot={snapshot} runAction={actions.run} />
        ) : null}
        {activeView === "results" ? <ResultsComparisonPage snapshot={snapshot} /> : null}
        {activeView === "detail" ? (
          <NodeDetailPage snapshot={snapshot} selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} />
        ) : null}
        {activeView === "report" ? <ReportPage snapshot={snapshot} onExport={actions.downloadReport} /> : null}
      </main>
    </div>
  );
}

export default App;
