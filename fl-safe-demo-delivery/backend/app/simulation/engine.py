from __future__ import annotations

import asyncio
import math
import random
from copy import deepcopy
from datetime import UTC, datetime
from typing import Any

import numpy as np

from app.services.broadcaster import EventBroadcaster
from app.services.storage import ExperimentStorage


CLIENT_NAMES = [
    "Hospital A",
    "Hospital B",
    "Hospital C",
    "Hospital D",
    "Hospital E",
    "Hospital F",
    "Hospital G",
    "Hospital H",
]


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def as_builtin(value: Any) -> Any:
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, dict):
        return {key: as_builtin(item) for key, item in value.items()}
    if isinstance(value, list):
        return [as_builtin(item) for item in value]
    return value


class SimulationEngine:
    def __init__(self, storage: ExperimentStorage, broadcaster: EventBroadcaster) -> None:
        self.storage = storage
        self.broadcaster = broadcaster
        self.lock = asyncio.Lock()
        self.background_task: asyncio.Task[None] | None = None
        self.rng = random.Random(24)
        self.round_interval = 2.4
        self.reset_state()

    def reset_state(self) -> None:
        self.experiment = {
            "scenario": "medical_fl",
            "dataset": "mnist",
            "model": "lightweight_cnn_sim",
            "num_clients": 8,
            "num_malicious": 2,
            "attack_type": "none",
            "defense_enabled": True,
            "aggregation_mode": "reputation_weighted",
            "max_rounds": 20,
        }
        self.attack = {
            "enabled": False,
            "attack_type": "none",
            "num_malicious": 2,
            "intensity": 0.6,
            "target_label": 7,
            "source_label": 1,
            "trigger_ratio": 0.25,
        }
        self.defense = {
            "enabled": True,
            "mode": "dynamic_reputation",
            "anomaly_threshold": 0.62,
            "isolate_threshold": 0.82,
            "reputation_floor": 0.18,
            "decay": 0.2,
            "recovery": 0.08,
        }
        self.current_round = 0
        self.running = False
        self.tick_seed = 0
        self.no_defense_metrics = {"accuracy": 0.55, "loss": 1.35, "backdoor_success_rate": 0.02}
        self.protected_metrics = {"accuracy": 0.58, "loss": 1.28, "backdoor_success_rate": 0.01}
        self.current_metrics = deepcopy(self.protected_metrics)
        self.round_history: list[dict[str, Any]] = []
        self.client_histories: dict[str, list[dict[str, Any]]] = {}
        self.similarity_matrix = {"labels": [], "values": []}
        self.reputation_series: dict[str, list[dict[str, Any]]] = {}
        self.latest_report: dict[str, Any] = {}
        self.clients = self._build_clients()
        self.storage.reset()

    def _build_clients(self) -> list[dict[str, Any]]:
        data_sizes = [1200, 980, 1320, 1100, 1250, 1020, 1180, 1140]
        clients: list[dict[str, Any]] = []
        for index, name in enumerate(CLIENT_NAMES, start=1):
            role = "malicious" if index <= self.attack["num_malicious"] else "normal"
            client = {
                "client_id": f"client_{index}",
                "name": name,
                "role": role,
                "status": "idle",
                "reputation_score": 0.92 if role == "normal" else 0.76,
                "anomaly_score": 0.08 if role == "normal" else 0.32,
                "similarity_cluster": 0,
                "current_weight": round(1 / self.experiment["num_clients"], 4),
                "is_isolated": False,
                "local_data_size": data_sizes[index - 1],
                "history_flags": [],
                "gradient_norm": 0.0,
                "downweighted": False,
                "last_seen_round": 0,
            }
            clients.append(client)
            self.client_histories[client["client_id"]] = []
            self.reputation_series[client["client_id"]] = []
        return clients

    async def ensure_background_task(self) -> None:
        if self.background_task is None or self.background_task.done():
            self.background_task = asyncio.create_task(self._auto_loop())

    async def _auto_loop(self) -> None:
        while True:
            await asyncio.sleep(self.round_interval)
            if self.running:
                await self.step_round(trigger="auto")

    async def start_training(self) -> dict[str, Any]:
        async with self.lock:
            self.running = True
            self._log_event("system", "训练已启动，系统进入联邦训练状态。")
            payload = self.snapshot()
        await self._broadcast("system_update", payload)
        return payload

    async def pause_training(self) -> dict[str, Any]:
        async with self.lock:
            self.running = False
            self._log_event("system", "训练已暂停，可手动推进下一轮。")
            payload = self.snapshot()
        await self._broadcast("system_update", payload)
        return payload

    async def reset(self) -> dict[str, Any]:
        async with self.lock:
            self.reset_state()
            self._log_event("system", "实验已重置，攻击与防御配置恢复默认。")
            payload = self.snapshot()
        await self._broadcast("system_update", payload)
        return payload

    async def configure_attack(self, config: dict[str, Any]) -> dict[str, Any]:
        async with self.lock:
            attack_type = config["attack_type"]
            self.attack.update(config)
            self.attack["enabled"] = attack_type != "none"
            self.experiment["attack_type"] = attack_type
            self.experiment["num_malicious"] = self.attack["num_malicious"]
            self._refresh_roles()
            label_map = {
                "none": "关闭攻击",
                "label_flipping": "标签翻转攻击",
                "backdoor": "后门攻击",
                "multi_node_poisoning": "多节点协同投毒",
            }
            self._log_event(
                "attack",
                f"已切换为{label_map[attack_type]}，恶意节点数 {self.attack['num_malicious']}，强度 {self.attack['intensity']:.2f}。",
            )
            payload = self.snapshot()
        await self._broadcast("attack_update", payload["attack"])
        await self._broadcast("system_update", payload)
        return payload

    async def configure_defense(self, config: dict[str, Any]) -> dict[str, Any]:
        async with self.lock:
            self.defense.update(config)
            self.experiment["defense_enabled"] = self.defense["enabled"]
            self.experiment["aggregation_mode"] = (
                "reputation_weighted" if self.defense["enabled"] else "fedavg"
            )
            mode_label = "开启" if self.defense["enabled"] else "关闭"
            self._log_event(
                "defense",
                f"{mode_label}防御，模式 {self.defense['mode']}，异常阈值 {self.defense['anomaly_threshold']:.2f}。",
            )
            payload = self.snapshot()
        await self._broadcast("defense_update", payload["defense"])
        await self._broadcast("system_update", payload)
        return payload

    def _refresh_roles(self) -> None:
        for index, client in enumerate(self.clients, start=1):
            client["role"] = "malicious" if index <= self.attack["num_malicious"] else "normal"
            if client["role"] == "normal" and client["reputation_score"] < 0.5:
                client["reputation_score"] = 0.72

    def _base_vector(self) -> np.ndarray:
        phase = self.current_round + self.tick_seed
        values = [
            math.sin(phase / 3 + offset / 5) + math.cos(phase / 5 + offset / 7)
            for offset in range(12)
        ]
        return np.asarray(values, dtype=np.float64)

    def _simulate_update(self, client: dict[str, Any], base_vector: np.ndarray) -> np.ndarray:
        noise = np.asarray([self.rng.gauss(0, 0.18) for _ in range(base_vector.size)], dtype=np.float64)
        honest_update = base_vector + noise
        attack_type = self.attack["attack_type"]
        intensity = self.attack["intensity"]

        if client["role"] != "malicious" or not self.attack["enabled"]:
            return honest_update

        if attack_type == "label_flipping":
            poison = np.roll(base_vector, 2) * (1.1 + intensity) - honest_update * (0.75 + intensity * 0.3)
            return poison + noise * 1.4

        if attack_type == "backdoor":
            trigger = np.zeros_like(base_vector)
            trigger[-3:] = np.asarray([1.8, 1.5, 2.1]) * (0.6 + self.attack["trigger_ratio"] + intensity * 0.5)
            return honest_update * 0.35 + trigger + noise * 0.8

        if attack_type == "multi_node_poisoning":
            cluster = np.linspace(2.4, -1.8, num=base_vector.size)
            return cluster * (0.45 + intensity) + noise * 0.35

        return honest_update

    def _pairwise_similarity(self, updates: dict[str, np.ndarray]) -> dict[str, Any]:
        labels = list(updates.keys())
        values: list[list[float]] = []
        for left_id in labels:
            left = updates[left_id]
            left_norm = np.linalg.norm(left) or 1.0
            row: list[float] = []
            for right_id in labels:
                right = updates[right_id]
                right_norm = np.linalg.norm(right) or 1.0
                similarity = float(np.dot(left, right) / (left_norm * right_norm))
                row.append(round(similarity, 4))
            values.append(row)
        return {"labels": labels, "values": values}

    def _detect_anomalies(self, updates: dict[str, np.ndarray], similarity: dict[str, Any]) -> dict[str, float]:
        matrix = np.stack(list(updates.values()))
        centroid = matrix.mean(axis=0)
        distances = np.linalg.norm(matrix - centroid, axis=1)
        dist_mean = distances.mean()
        dist_std = distances.std() or 1.0
        anomalies: dict[str, float] = {}
        for index, client_id in enumerate(updates.keys()):
            z_score = abs(distances[index] - dist_mean) / dist_std
            similarity_mean = (
                sum(similarity["values"][index]) - similarity["values"][index][index]
            ) / max(len(similarity["values"][index]) - 1, 1)
            score = clamp(0.22 + z_score * 0.28 + (1 - similarity_mean) * 0.45, 0.03, 0.98)
            anomalies[client_id] = round(score, 4)
        return anomalies

    def _cluster_ids(self, similarity: dict[str, Any]) -> dict[str, int]:
        clusters: dict[str, int] = {}
        for index, client_id in enumerate(similarity["labels"]):
            average_similarity = (
                sum(similarity["values"][index]) - similarity["values"][index][index]
            ) / max(len(similarity["values"][index]) - 1, 1)
            clusters[client_id] = 1 if average_similarity > 0.45 else 2
        return clusters

    def _status_from_scores(self, client: dict[str, Any]) -> str:
        if client["is_isolated"]:
            return "isolated"
        if client["downweighted"]:
            return "downweighted"
        if client["role"] == "malicious" and client["anomaly_score"] > 0.78:
            return "malicious"
        if client["anomaly_score"] >= self.defense["anomaly_threshold"]:
            return "suspicious"
        return "normal"

    def _update_clients(self, updates: dict[str, np.ndarray], anomalies: dict[str, float], similarity: dict[str, Any]) -> None:
        clusters = self._cluster_ids(similarity)
        raw_weights: dict[str, float] = {}
        for client in self.clients:
            update = updates[client["client_id"]]
            anomaly = anomalies[client["client_id"]]
            client["gradient_norm"] = round(float(np.linalg.norm(update)), 4)
            client["anomaly_score"] = anomaly
            client["similarity_cluster"] = clusters[client["client_id"]]
            client["last_seen_round"] = self.current_round
            client["status"] = "uploading"

            if self.defense["enabled"]:
                delta = self.defense["recovery"] * (0.55 - anomaly) - self.defense["decay"] * max(0.0, anomaly - 0.45)
                if client["role"] == "malicious":
                    delta -= 0.05
                client["reputation_score"] = round(clamp(client["reputation_score"] + delta, 0.05, 0.99), 4)
                client["is_isolated"] = (
                    anomaly >= self.defense["isolate_threshold"]
                    or client["reputation_score"] <= self.defense["reputation_floor"]
                )
                client["downweighted"] = not client["is_isolated"] and anomaly >= self.defense["anomaly_threshold"]
                raw_weight = client["local_data_size"] * client["reputation_score"] * max(0.06, 1 - anomaly)
                if client["downweighted"]:
                    raw_weight *= 0.42
                if client["is_isolated"]:
                    raw_weight = 0.0
            else:
                client["is_isolated"] = False
                client["downweighted"] = False
                client["reputation_score"] = round(clamp(client["reputation_score"] + (0.02 - anomaly * 0.01), 0.1, 0.99), 4)
                raw_weight = float(client["local_data_size"])

            raw_weights[client["client_id"]] = raw_weight

        total_weight = sum(raw_weights.values()) or 1.0
        for client in self.clients:
            client["current_weight"] = round(raw_weights[client["client_id"]] / total_weight, 4)
            client["status"] = self._status_from_scores(client)
            if client["status"] in {"suspicious", "malicious", "downweighted", "isolated"}:
                flag = f"R{self.current_round}:{client['status']}"
                if flag not in client["history_flags"]:
                    client["history_flags"].append(flag)

            history_item = {
                "round_id": self.current_round,
                "anomaly_score": client["anomaly_score"],
                "reputation_score": client["reputation_score"],
                "weight": client["current_weight"],
                "status": client["status"],
                "gradient_norm": client["gradient_norm"],
            }
            self.client_histories[client["client_id"]].append(history_item)
            self.reputation_series[client["client_id"]].append(
                {"round": self.current_round, "value": client["reputation_score"]}
            )

    def _attack_pressure(self, malicious_weight_share: float) -> tuple[float, float]:
        if not self.attack["enabled"]:
            return 0.0, 0.0

        intensity = self.attack["intensity"]
        ratio = self.attack["num_malicious"] / self.experiment["num_clients"]
        attack_type = self.attack["attack_type"]

        if attack_type == "label_flipping":
            return 0.085 * intensity * ratio, 0.0
        if attack_type == "backdoor":
            return 0.028 * intensity * ratio, 0.19 * (0.5 + self.attack["trigger_ratio"]) * ratio
        if attack_type == "multi_node_poisoning":
            return 0.105 * intensity * ratio * (0.9 + malicious_weight_share), 0.06 * intensity * ratio
        return 0.0, 0.0

    def _update_metrics(self) -> dict[str, Any]:
        malicious_weight_share = sum(
            client["current_weight"] for client in self.clients if client["role"] == "malicious"
        )
        detected = sum(
            1
            for client in self.clients
            if client["role"] == "malicious" and client["status"] in {"suspicious", "malicious", "downweighted", "isolated"}
        )
        isolated = [client["client_id"] for client in self.clients if client["is_isolated"]]
        downweighted = [client["client_id"] for client in self.clients if client["downweighted"]]
        detection_ratio = detected / max(self.attack["num_malicious"], 1)

        attack_penalty, backdoor_gain = self._attack_pressure(malicious_weight_share)
        baseline_gain = (0.965 - self.no_defense_metrics["accuracy"]) * 0.16
        protected_gain = (0.972 - self.protected_metrics["accuracy"]) * 0.18

        self.no_defense_metrics["accuracy"] = clamp(
            self.no_defense_metrics["accuracy"] + baseline_gain - attack_penalty,
            0.12,
            0.99,
        )
        self.no_defense_metrics["loss"] = clamp(
            self.no_defense_metrics["loss"] * 0.86 + 0.18 + attack_penalty * 3.8,
            0.08,
            2.0,
        )
        self.no_defense_metrics["backdoor_success_rate"] = clamp(
            self.no_defense_metrics["backdoor_success_rate"] * 0.78 + backdoor_gain,
            0.0,
            0.98,
        )

        protection_factor = (1 - malicious_weight_share) * 0.55 + detection_ratio * 0.4
        self.protected_metrics["accuracy"] = clamp(
            self.protected_metrics["accuracy"] + protected_gain - attack_penalty * (0.25 + malicious_weight_share) + 0.012 * protection_factor,
            0.18,
            0.995,
        )
        self.protected_metrics["loss"] = clamp(
            self.protected_metrics["loss"] * 0.83 + 0.14 + attack_penalty * (1.35 + malicious_weight_share),
            0.05,
            1.8,
        )
        self.protected_metrics["backdoor_success_rate"] = clamp(
            self.protected_metrics["backdoor_success_rate"] * 0.7 + backdoor_gain * max(0.08, malicious_weight_share) - 0.07 * protection_factor,
            0.0,
            0.95,
        )

        selected_metrics = self.protected_metrics if self.defense["enabled"] else self.no_defense_metrics
        self.current_metrics = deepcopy(selected_metrics)

        return {
            "isolated_clients": isolated,
            "downweighted_clients": downweighted,
            "detected_malicious": detected,
            "malicious_weight_share": round(malicious_weight_share, 4),
            "detection_ratio": round(detection_ratio, 4),
        }

    def _make_round_record(self, metric_meta: dict[str, Any]) -> dict[str, Any]:
        timestamp = datetime.now(UTC).isoformat()
        return {
            "round_id": self.current_round,
            "global_accuracy": round(self.current_metrics["accuracy"], 4),
            "global_loss": round(self.current_metrics["loss"], 4),
            "backdoor_success_rate": round(self.current_metrics["backdoor_success_rate"], 4),
            "protected_accuracy": round(self.protected_metrics["accuracy"], 4),
            "protected_loss": round(self.protected_metrics["loss"], 4),
            "protected_backdoor_success_rate": round(self.protected_metrics["backdoor_success_rate"], 4),
            "no_defense_accuracy": round(self.no_defense_metrics["accuracy"], 4),
            "no_defense_loss": round(self.no_defense_metrics["loss"], 4),
            "no_defense_backdoor_success_rate": round(self.no_defense_metrics["backdoor_success_rate"], 4),
            "isolated_clients": metric_meta["isolated_clients"],
            "downweighted_clients": metric_meta["downweighted_clients"],
            "defense_active": self.defense["enabled"],
            "attack_active": self.attack["enabled"],
            "detected_malicious": metric_meta["detected_malicious"],
            "timestamp": timestamp,
        }

    def _generate_report(self) -> dict[str, Any]:
        latest_round = self.round_history[-1] if self.round_history else None
        if latest_round is None:
            return {
                "experiment_id": "EXP-000",
                "summary": "等待训练开始后生成报告。",
                "identified_nodes": 0,
                "isolated_clients": [],
            }

        report = {
            "experiment_id": f"EXP-{self.current_round:03d}",
            "attack_type": self.attack["attack_type"],
            "malicious_nodes": self.attack["num_malicious"],
            "defense_strategy": self.defense["mode"] if self.defense["enabled"] else "none",
            "accuracy_before": latest_round["no_defense_accuracy"],
            "accuracy_after": latest_round["protected_accuracy"],
            "backdoor_before": latest_round["no_defense_backdoor_success_rate"],
            "backdoor_after": latest_round["protected_backdoor_success_rate"],
            "identified_nodes": latest_round["detected_malicious"],
            "isolated_clients": latest_round["isolated_clients"],
            "summary": (
                "系统完成了一轮联邦学习攻防演示。"
                f"在 {self.attack['attack_type']} 场景下，防御策略将准确率从 "
                f"{latest_round['no_defense_accuracy']:.2%} 提升到 {latest_round['protected_accuracy']:.2%}，"
                f"并将后门成功率压制到 {latest_round['protected_backdoor_success_rate']:.2%}。"
            ),
        }
        return report

    async def step_round(self, trigger: str = "manual") -> dict[str, Any]:
        async with self.lock:
            self.current_round += 1
            self.tick_seed += 1
            base_vector = self._base_vector()

            for client in self.clients:
                client["status"] = "training"

            updates = {client["client_id"]: self._simulate_update(client, base_vector) for client in self.clients}
            similarity = self._pairwise_similarity(updates)
            anomalies = self._detect_anomalies(updates, similarity)
            self._update_clients(updates, anomalies, similarity)
            self.similarity_matrix = similarity
            metric_meta = self._update_metrics()
            round_record = self._make_round_record(metric_meta)
            self.round_history.append(round_record)
            self.latest_report = self._generate_report()

            self.storage.save_round(round_record)
            self.storage.save_client_histories(self.current_round, self.clients, round_record["timestamp"])
            self._log_event(
                "round",
                f"第 {self.current_round} 轮完成，当前精度 {round_record['global_accuracy']:.2%}，损失 {round_record['global_loss']:.3f}。",
                timestamp=round_record["timestamp"],
            )
            payload = self.snapshot()

        await self._broadcast("round_update", round_record)
        await self._broadcast("chart_update", payload["charts"])
        await self._broadcast("system_update", payload)
        if trigger == "manual":
            await self._broadcast("report_ready", self.latest_report)
        return payload

    def _log_event(self, event_type: str, message: str, timestamp: str | None = None) -> None:
        created_at = timestamp or datetime.now(UTC).isoformat()
        self.storage.append_event(event_type, message, created_at)

    async def _broadcast(self, event: str, payload: Any) -> None:
        await self.broadcaster.broadcast(event, payload)

    def snapshot(self) -> dict[str, Any]:
        latest_round = self.round_history[-1] if self.round_history else None
        client_series = [
            {
                "client_id": client["client_id"],
                "name": client["name"],
                "values": self.reputation_series[client["client_id"]][-10:],
            }
            for client in self.clients
        ]
        anomaly_latest = [
            {
                "client_id": client["client_id"],
                "name": client["name"],
                "value": client["anomaly_score"],
                "status": client["status"],
            }
            for client in self.clients
        ]
        weights = [
            {
                "client_id": client["client_id"],
                "name": client["name"],
                "value": client["current_weight"],
                "status": client["status"],
            }
            for client in self.clients
        ]
        return as_builtin({
            "experiment": deepcopy(self.experiment),
            "running": self.running,
            "current_round": self.current_round,
            "attack": deepcopy(self.attack),
            "defense": deepcopy(self.defense),
            "latest_round": latest_round,
            "clients": deepcopy(self.clients),
            "recent_events": self.storage.recent_events(),
            "report": deepcopy(self.latest_report),
            "charts": {
                "accuracy": [
                    {
                        "round": record["round_id"],
                        "actual": record["global_accuracy"],
                        "no_defense": record["no_defense_accuracy"],
                        "protected": record["protected_accuracy"],
                    }
                    for record in self.round_history
                ],
                "loss": [
                    {
                        "round": record["round_id"],
                        "actual": record["global_loss"],
                        "no_defense": record["no_defense_loss"],
                        "protected": record["protected_loss"],
                    }
                    for record in self.round_history
                ],
                "backdoor_success": [
                    {
                        "round": record["round_id"],
                        "actual": record["backdoor_success_rate"],
                        "no_defense": record["no_defense_backdoor_success_rate"],
                        "protected": record["protected_backdoor_success_rate"],
                    }
                    for record in self.round_history
                ],
                "reputation": client_series,
                "anomaly": anomaly_latest,
                "weights": weights,
                "similarity_matrix": deepcopy(self.similarity_matrix),
            },
        })
