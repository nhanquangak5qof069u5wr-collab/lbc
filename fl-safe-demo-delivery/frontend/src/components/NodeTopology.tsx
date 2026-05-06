import { ClientSnapshot } from "../types";

interface NodeTopologyProps {
  clients: ClientSnapshot[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
}

function statusClass(status: string) {
  if (status === "isolated") return "isolated";
  if (status === "malicious") return "malicious";
  if (status === "suspicious" || status === "downweighted") return "suspicious";
  if (status === "training" || status === "uploading") return "training";
  return "normal";
}

export function NodeTopology({ clients, selectedClientId, onSelectClient }: NodeTopologyProps) {
  return (
    <section className="panel topology-panel">
      <div className="panel-header">
        <div>
          <h3>节点拓扑与聚合器</h3>
          <p>点击任意客户端可直接切换到节点详情页。</p>
        </div>
      </div>
      <div className="topology-stage">
        <div className="aggregator-core">
          <div className="aggregator-pulse" />
          <div className="aggregator-label">
            <strong>Federated Aggregator</strong>
            <span>中央聚合器</span>
          </div>
        </div>
        {clients.map((client, index) => {
          const angle = (Math.PI * 2 * index) / clients.length - Math.PI / 2;
          const radius = 220;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          return (
            <button
              key={client.client_id}
              className={`client-node ${statusClass(client.status)} ${selectedClientId === client.client_id ? "selected" : ""}`}
              style={{ transform: `translate(${x}px, ${y}px)` }}
              onClick={() => onSelectClient(client.client_id)}
            >
              <span className="client-node-name">{client.name}</span>
              <span className="client-node-status">{client.status}</span>
              <span className="client-node-rep">信誉 {Math.round(client.reputation_score * 100)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
