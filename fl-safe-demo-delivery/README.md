# FLSafeGuard

联邦学习投毒攻击动态检测与鲁棒聚合展示系统。

本项目面向竞赛演示场景，采用前后端分离架构：

- 前端：React + TypeScript + ECharts
- 后端：FastAPI + SQLite
- 仿真：轻量联邦学习攻防模拟引擎，支持标签翻转、后门攻击、多节点协同投毒、异常检测、动态信誉评分和鲁棒聚合

## 目录

```text
fl-safe-demo/
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ schemas.py
│  │  ├─ services/
│  │  └─ simulation/
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  ├─ hooks/
│  │  ├─ pages/
│  │  ├─ services/
│  │  └─ types.ts
│  ├─ package.json
│  └─ vite.config.ts
├─ docs/
│  ├─ architecture.md
│  ├─ demo_script.md
│  └─ report_template.md
└─ start_demo.sh
```

## 页面能力

- 系统总览：节点拓扑、关键指标、实时事件流
- 攻击控制：标签翻转、后门、协同投毒、训练控制
- 防御分析：异常分布、相似度热力图、信誉分、聚合权重
- 结果对比：防御前后准确率、损失、后门成功率对比
- 节点详情：单节点信誉演化和历史风险标记
- 实验报告：摘要展示和 Markdown 导出

## 后端 API

- `GET /api/system/status`
- `POST /api/control/start`
- `POST /api/control/pause`
- `POST /api/control/reset`
- `POST /api/control/next-round`
- `POST /api/attack/label-flipping`
- `POST /api/attack/backdoor`
- `POST /api/attack/multi-node-poisoning`
- `POST /api/attack/disable`
- `POST /api/defense/enable`
- `POST /api/defense/disable`
- `POST /api/defense/config`
- `GET /api/clients`
- `GET /api/clients/{client_id}`
- `GET /api/clients/{client_id}/history`
- `GET /api/report/latest`
- `POST /api/report/export`
- `WS /ws`

## 运行

推荐在 Linux 虚拟机中执行：

```bash
chmod +x start_demo.sh
./start_demo.sh
```

默认端口：

- 后端：`8000`
- 前端：`5173`

前端访问地址：

```text
http://<server-ip>:5173
```

## 说明

- 当前版本优先保证“稳定演示”和“可视化效果”，训练逻辑采用轻量仿真引擎，方便在比赛现场快速跑出清晰对比。
- 仿真引擎已经保留了攻击、防御、信誉、隔离、聚合权重和结果对比所需的完整数据链路，后续可以平滑替换为真实的 PyTorch 本地训练流程。
