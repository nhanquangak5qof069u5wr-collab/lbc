from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


AttackType = Literal["none", "label_flipping", "backdoor", "multi_node_poisoning"]
DefenseMode = Literal["none", "basic", "dynamic_reputation"]
ClientRole = Literal["normal", "malicious"]
ClientStatus = Literal[
    "idle",
    "training",
    "uploading",
    "normal",
    "suspicious",
    "malicious",
    "downweighted",
    "isolated",
    "offline",
]


class AttackRequest(BaseModel):
    attack_type: AttackType
    num_malicious: int = Field(default=2, ge=0, le=8)
    intensity: float = Field(default=0.6, ge=0.0, le=1.0)
    target_label: int = Field(default=7, ge=0, le=9)
    source_label: int = Field(default=1, ge=0, le=9)
    trigger_ratio: float = Field(default=0.25, ge=0.0, le=1.0)


class DefenseConfigRequest(BaseModel):
    mode: DefenseMode = "dynamic_reputation"
    enabled: bool = True
    anomaly_threshold: float = Field(default=0.62, ge=0.1, le=1.0)
    isolate_threshold: float = Field(default=0.82, ge=0.1, le=1.0)
    reputation_floor: float = Field(default=0.18, ge=0.0, le=1.0)
    decay: float = Field(default=0.2, ge=0.0, le=1.0)
    recovery: float = Field(default=0.08, ge=0.0, le=1.0)

