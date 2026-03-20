import type { CreateTaskInput, OpenApiDocument, Task, TaskAnalytics, TaskStatus, Reward, Reflection } from "@frontend/types/api";

const request = async <T>(input: RequestInfo, init?: RequestInit) => {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }

  return (await response.json()) as T;
};

export const api = {
  listTasks(status?: TaskStatus) {
    const search = status ? `?status=${status}` : "";
    return request<Task[]>(`/api/tasks${search}`);
  },
  createTask(payload: CreateTaskInput) {
    return request<Task & { printer: { ok: boolean; status: "sent" | "failed" } }>(
      "/api/tasks",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },
  getTask(id: string) {
    return request<Task>(`/api/tasks/${id}`);
  },
  updateTaskStatus(id: string, status: TaskStatus) {
    return request<Task>(`/api/tasks/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
  updateTaskOrder(items: { id: string; status: TaskStatus; position: number }[]) {
    return request<{ success: boolean }>("/api/tasks/reorder", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
  },
  getTaskAnalytics() {
    return request<TaskAnalytics>("/api/tasks/analytics");
  },
  getOpenApiDocument() {
    return request<OpenApiDocument>("/openapi.json");
  },
  listRewards() {
    return request<Reward[]>("/api/rewards");
  },
  getUserXp() {
    return request<{ xp: number }>("/api/rewards/xp");
  },
  redeemReward(id: string) {
    return request<{ success: boolean; newXp: number }>(`/api/rewards/${id}/redeem`, {
      method: "POST",
    });
  },
  listReflections() {
    return request<Reflection[]>("/api/reflections");
  },
  createReflection(payload: { prompt: string; answer: string }) {
    return request<Reflection>("/api/reflections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
};
