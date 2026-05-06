import { useEffect, useMemo, useRef, useState } from "react";
import { buildWebSocketUrl, exportReport, fetchSystemStatus, postAction } from "../services/api";
import { SystemSnapshot } from "../types";

export function useLiveSystemState() {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number | null>(null);

  const load = async () => {
    try {
      const data = await fetchSystemStatus();
      setSnapshot(data);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "加载系统状态失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(buildWebSocketUrl());
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.event === "system_update") {
          setSnapshot(message.payload);
          setError(null);
        }
      };

      ws.onerror = () => {
        setError("实时连接异常，已切换为轮询加载。");
      };

      ws.onclose = () => {
        retryRef.current = window.setTimeout(connect, 2400);
      };
    };

    connect();
    return () => {
      if (retryRef.current) {
        window.clearTimeout(retryRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchSystemStatus().then(setSnapshot).catch(() => undefined);
    }, 10000);

    return () => window.clearInterval(timer);
  }, []);

  const actions = useMemo(
    () => ({
      async run(path: string, payload?: unknown) {
        const data = await postAction(path, payload);
        setSnapshot(data);
        return data;
      },
      async downloadReport() {
        const result = await exportReport();
        const blob = new Blob([result.content], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = result.filename;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    }),
    []
  );

  return { snapshot, loading, error, reload: load, actions };
}
