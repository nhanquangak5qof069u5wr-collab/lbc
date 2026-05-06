import { useEffect, useState } from "react";
import { SystemSnapshot } from "../types";

interface AttackControlPageProps {
  snapshot: SystemSnapshot;
  runAction: (path: string, payload?: unknown) => Promise<unknown>;
}

export function AttackControlPage({ snapshot, runAction }: AttackControlPageProps) {
  const [attackType, setAttackType] = useState<"label_flipping" | "backdoor" | "multi_node_poisoning">(
    snapshot.attack.attack_type === "none" ? "label_flipping" : snapshot.attack.attack_type
  );
  const [numMalicious, setNumMalicious] = useState(snapshot.attack.num_malicious);
  const [intensity, setIntensity] = useState(snapshot.attack.intensity);
  const [targetLabel, setTargetLabel] = useState(snapshot.attack.target_label);
  const [triggerRatio, setTriggerRatio] = useState(snapshot.attack.trigger_ratio);

  useEffect(() => {
    setAttackType(snapshot.attack.attack_type === "none" ? "label_flipping" : snapshot.attack.attack_type);
    setNumMalicious(snapshot.attack.num_malicious);
    setIntensity(snapshot.attack.intensity);
    setTargetLabel(snapshot.attack.target_label);
    setTriggerRatio(snapshot.attack.trigger_ratio);
  }, [snapshot.attack]);

  const payload = {
    attack_type: attackType,
    num_malicious: numMalicious,
    intensity,
    target_label: targetLabel,
    source_label: 1,
    trigger_ratio: triggerRatio
  };

  const pathMap = {
    label_flipping: "/api/attack/label-flipping",
    backdoor: "/api/attack/backdoor",
    multi_node_poisoning: "/api/attack/multi-node-poisoning"
  } as const;

  const maliciousClients = snapshot.clients.filter((client) => client.role === "malicious");

  return (
    <div className="page-grid two-column">
      <section className="panel form-panel">
        <div className="panel-header">
          <div>
            <h3>训练控制</h3>
            <p>现场演示建议先正常训练，再手动切入攻击与防御。</p>
          </div>
        </div>
        <div className="button-row">
          <button className="action-button primary" onClick={() => runAction("/api/control/start")}>开始训练</button>
          <button className="action-button" onClick={() => runAction("/api/control/pause")}>暂停训练</button>
          <button className="action-button" onClick={() => runAction("/api/control/next-round")}>手动下一轮</button>
          <button className="action-button danger" onClick={() => runAction("/api/control/reset")}>重置实验</button>
        </div>

        <div className="panel-header inline-gap">
          <div>
            <h3>攻击模式切换</h3>
            <p>支持标签翻转、后门攻击和多节点协同投毒。</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            <span>攻击类型</span>
            <select value={attackType} onChange={(event) => setAttackType(event.target.value as typeof attackType)}>
              <option value="label_flipping">标签翻转</option>
              <option value="backdoor">后门攻击</option>
              <option value="multi_node_poisoning">协同投毒</option>
            </select>
          </label>
          <label>
            <span>恶意节点数</span>
            <input type="range" min="1" max="4" step="1" value={numMalicious} onChange={(event) => setNumMalicious(Number(event.target.value))} />
            <strong>{numMalicious}</strong>
          </label>
          <label>
            <span>攻击强度</span>
            <input type="range" min="0.1" max="1" step="0.05" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
            <strong>{intensity.toFixed(2)}</strong>
          </label>
          <label>
            <span>目标标签</span>
            <input type="number" min="0" max="9" value={targetLabel} onChange={(event) => setTargetLabel(Number(event.target.value))} />
          </label>
          <label>
            <span>触发比例</span>
            <input type="range" min="0.05" max="0.8" step="0.05" value={triggerRatio} onChange={(event) => setTriggerRatio(Number(event.target.value))} />
            <strong>{triggerRatio.toFixed(2)}</strong>
          </label>
        </div>

        <div className="button-row">
          <button className="action-button primary" onClick={() => runAction(pathMap[attackType], payload)}>启用当前攻击</button>
          <button className="action-button success" onClick={() => runAction("/api/attack/disable")}>恢复正常训练</button>
        </div>
      </section>

      <section className="panel list-panel">
        <div className="panel-header">
          <div>
            <h3>攻击态势看板</h3>
            <p>当前攻击配置与受影响节点列表。</p>
          </div>
        </div>
        <div className="info-block">
          <div><span>当前攻击模式</span><strong>{snapshot.attack.attack_type}</strong></div>
          <div><span>是否启用</span><strong>{snapshot.attack.enabled ? "已开启" : "未开启"}</strong></div>
          <div><span>攻击强度</span><strong>{snapshot.attack.intensity.toFixed(2)}</strong></div>
          <div><span>攻击目标</span><strong>{snapshot.attack.target_label}</strong></div>
        </div>

        <div className="tag-row">
          {maliciousClients.map((client) => (
            <span className="status-pill danger" key={client.client_id}>
              {client.name} - {client.status}
            </span>
          ))}
        </div>

        <div className="compare-card accent-danger">
          <span>Attack insight</span>
          <strong>
            {snapshot.attack.attack_type === "backdoor"
              ? "Backdoor mode should focus on the backdoor success-rate curve."
              : "Label flipping and coordinated poisoning directly pull down global accuracy."}
          </strong>
        </div>

        <div className="compare-card accent-cyan">
          <span>Demo tip</span>
          <strong>Run 3-4 clean rounds first, then enable attacks to create a clearer contrast.</strong>
        </div>
      </section>
    </div>
  );
}
