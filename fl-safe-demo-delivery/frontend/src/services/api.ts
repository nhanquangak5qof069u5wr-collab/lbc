import { SystemSnapshot } from "../types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchSystemStatus(): Promise<SystemSnapshot> {
  return request<SystemSnapshot>("/api/system/status");
}

export async function postAction(path: string, payload?: unknown): Promise<SystemSnapshot> {
  return request<SystemSnapshot>(path, {
    method: "POST",
    body: payload ? JSON.stringify(payload) : undefined
  });
}

export async function exportReport(): Promise<{ filename: string; content: string }> {
  return request<{ filename: string; content: string }>("/api/report/export", {
    method: "POST"
  });
}

export function buildWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
