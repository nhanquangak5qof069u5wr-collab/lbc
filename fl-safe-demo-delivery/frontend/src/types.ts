export type AttackType = "none" | "label_flipping" | "backdoor" | "multi_node_poisoning";
export type DefenseMode = "none" | "basic" | "dynamic_reputation";

export interface AttackConfig {
  enabled: boolean;
  attack_type: AttackType;
  num_malicious: number;
  intensity: number;
  target_label: number;
  source_label: number;
  trigger_ratio: number;
}

export interface DefenseConfig {
  enabled: boolean;
  mode: DefenseMode;
  anomaly_threshold: number;
  isolate_threshold: number;
  reputation_floor: number;
  decay: number;
  recovery: number;
}

export interface ExperimentConfig {
  scenario: string;
  dataset: string;
  model: string;
  num_clients: number;
  num_malicious: number;
  attack_type: AttackType;
  defense_enabled: boolean;
  aggregation_mode: string;
  max_rounds: number;
}

export interface ClientSnapshot {
  client_id: string;
  name: string;
  role: "normal" | "malicious";
  status: string;
  reputation_score: number;
  anomaly_score: number;
  similarity_cluster: number;
  current_weight: number;
  is_isolated: boolean;
  local_data_size: number;
  history_flags: string[];
  gradient_norm: number;
  downweighted: boolean;
  last_seen_round: number;
}

export interface RoundSnapshot {
  round_id: number;
  global_accuracy: number;
  global_loss: number;
  backdoor_success_rate: number;
  protected_accuracy: number;
  protected_loss: number;
  protected_backdoor_success_rate: number;
  no_defense_accuracy: number;
  no_defense_loss: number;
  no_defense_backdoor_success_rate: number;
  isolated_clients: string[];
  downweighted_clients: string[];
  defense_active: boolean;
  attack_active: boolean;
  detected_malicious: number;
  timestamp: string;
}

export interface ChartPoint {
  round: number;
  actual: number;
  no_defense: number;
  protected: number;
}

export interface NamedValue {
  client_id: string;
  name: string;
  value: number;
  status?: string;
}

export interface ReputationSeries {
  client_id: string;
  name: string;
  values: Array<{ round: number; value: number }>;
}

export interface SimilarityMatrix {
  labels: string[];
  values: number[][];
}

export interface ReportSnapshot {
  experiment_id: string;
  attack_type: string;
  malicious_nodes: number;
  defense_strategy: string;
  accuracy_before: number;
  accuracy_after: number;
  backdoor_before: number;
  backdoor_after: number;
  identified_nodes: number;
  isolated_clients: string[];
  summary: string;
}

export interface EventItem {
  event_type: string;
  message: string;
  created_at: string;
}

export interface SystemSnapshot {
  experiment: ExperimentConfig;
  running: boolean;
  current_round: number;
  attack: AttackConfig;
  defense: DefenseConfig;
  latest_round: RoundSnapshot | null;
  clients: ClientSnapshot[];
  recent_events: EventItem[];
  report: ReportSnapshot;
  charts: {
    accuracy: ChartPoint[];
    loss: ChartPoint[];
    backdoor_success: ChartPoint[];
    reputation: ReputationSeries[];
    anomaly: NamedValue[];
    weights: NamedValue[];
    similarity_matrix: SimilarityMatrix;
  };
}
