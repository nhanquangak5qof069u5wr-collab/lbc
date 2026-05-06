from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.schemas import AttackRequest, DefenseConfigRequest
from app.services.broadcaster import EventBroadcaster
from app.services.storage import ExperimentStorage
from app.simulation.engine import SimulationEngine


app = FastAPI(title="FLSafeGuard Demo API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

storage = ExperimentStorage(Path(__file__).resolve().parents[1] / "data" / "demo.db")
broadcaster = EventBroadcaster()
engine = SimulationEngine(storage=storage, broadcaster=broadcaster)


@app.on_event("startup")
async def startup_event() -> None:
    await engine.ensure_background_task()


@app.get("/api/system/status")
async def get_system_status() -> dict:
    return engine.snapshot()


@app.get("/api/system/rounds/latest")
async def get_latest_round() -> dict:
    snapshot = engine.snapshot()
    return snapshot.get("latest_round") or {}


@app.post("/api/control/start")
async def start_training() -> dict:
    return await engine.start_training()


@app.post("/api/control/pause")
async def pause_training() -> dict:
    return await engine.pause_training()


@app.post("/api/control/reset")
async def reset_training() -> dict:
    return await engine.reset()


@app.post("/api/control/next-round")
async def next_round() -> dict:
    return await engine.step_round(trigger="manual")


@app.post("/api/attack/label-flipping")
async def enable_label_flipping(config: AttackRequest) -> dict:
    payload = config.model_dump()
    payload["attack_type"] = "label_flipping"
    return await engine.configure_attack(payload)


@app.post("/api/attack/backdoor")
async def enable_backdoor(config: AttackRequest) -> dict:
    payload = config.model_dump()
    payload["attack_type"] = "backdoor"
    return await engine.configure_attack(payload)


@app.post("/api/attack/multi-node-poisoning")
async def enable_multi_node_poisoning(config: AttackRequest) -> dict:
    payload = config.model_dump()
    payload["attack_type"] = "multi_node_poisoning"
    return await engine.configure_attack(payload)


@app.post("/api/attack/disable")
async def disable_attack() -> dict:
    payload = AttackRequest(attack_type="none").model_dump()
    return await engine.configure_attack(payload)


@app.post("/api/defense/enable")
async def enable_defense(config: DefenseConfigRequest) -> dict:
    payload = config.model_dump()
    payload["enabled"] = True
    return await engine.configure_defense(payload)


@app.post("/api/defense/disable")
async def disable_defense() -> dict:
    payload = DefenseConfigRequest(enabled=False, mode="none").model_dump()
    payload["enabled"] = False
    payload["mode"] = "none"
    return await engine.configure_defense(payload)


@app.post("/api/defense/config")
async def update_defense_config(config: DefenseConfigRequest) -> dict:
    return await engine.configure_defense(config.model_dump())


@app.get("/api/clients")
async def get_clients() -> list[dict]:
    return engine.snapshot()["clients"]


@app.get("/api/clients/{client_id}")
async def get_client(client_id: str) -> JSONResponse:
    client = next((item for item in engine.snapshot()["clients"] if item["client_id"] == client_id), None)
    if client is None:
        return JSONResponse(status_code=404, content={"detail": "Client not found"})
    return JSONResponse(content=client)


@app.get("/api/clients/{client_id}/history")
async def get_client_history(client_id: str) -> JSONResponse:
    history = engine.client_histories.get(client_id)
    if history is None:
        return JSONResponse(status_code=404, content={"detail": "Client not found"})
    return JSONResponse(content={"client_id": client_id, "history": history})


@app.get("/api/charts/accuracy")
async def get_accuracy_chart() -> list[dict]:
    return engine.snapshot()["charts"]["accuracy"]


@app.get("/api/charts/loss")
async def get_loss_chart() -> list[dict]:
    return engine.snapshot()["charts"]["loss"]


@app.get("/api/charts/backdoor-success")
async def get_backdoor_chart() -> list[dict]:
    return engine.snapshot()["charts"]["backdoor_success"]


@app.get("/api/charts/reputation")
async def get_reputation_chart() -> list[dict]:
    return engine.snapshot()["charts"]["reputation"]


@app.get("/api/charts/anomaly")
async def get_anomaly_chart() -> list[dict]:
    return engine.snapshot()["charts"]["anomaly"]


@app.get("/api/charts/similarity-matrix")
async def get_similarity_chart() -> dict:
    return engine.snapshot()["charts"]["similarity_matrix"]


@app.get("/api/report/latest")
async def get_latest_report() -> dict:
    return engine.snapshot()["report"]


@app.post("/api/report/export")
async def export_report() -> dict:
    report = engine.snapshot()["report"]
    latest_round = engine.snapshot()["latest_round"] or {}
    markdown = f"""# FLSafeGuard 实验报告

- 实验编号：{report.get('experiment_id', 'EXP-000')}
- 攻击类型：{report.get('attack_type', 'none')}
- 恶意节点数：{report.get('malicious_nodes', 0)}
- 防御策略：{report.get('defense_strategy', 'none')}
- 当前轮次：{latest_round.get('round_id', 0)}
- 防御前准确率：{report.get('accuracy_before', 0):.2%}
- 防御后准确率：{report.get('accuracy_after', 0):.2%}
- 防御前后门成功率：{report.get('backdoor_before', 0):.2%}
- 防御后后门成功率：{report.get('backdoor_after', 0):.2%}
- 识别恶意节点数：{report.get('identified_nodes', 0)}
- 被隔离节点：{', '.join(report.get('isolated_clients', [])) or '无'}

## 摘要

{report.get('summary', '等待训练开始后自动生成摘要。')}
"""
    return {"filename": f"{report.get('experiment_id', 'EXP-000').lower()}.md", "content": markdown}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await broadcaster.connect(websocket)
    await websocket.send_json({"event": "system_update", "payload": engine.snapshot()})
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await broadcaster.disconnect(websocket)
