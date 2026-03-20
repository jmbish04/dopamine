export type TaskStatus = "open" | "in_progress" | "paused" | "done";

export type Reward = {
  id: string;
  title: string;
  description: string;
  cost: number;
  icon: string;
  tone: string;
  locked: boolean;
  createdAt: number;
};

export type Reflection = {
  id: string;
  prompt: string;
  answer: string | null;
  createdAt: number;
  answeredAt: number | null;
};
export type PrintStatus = "queued" | "sent" | "failed";

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  layer: number;
  xp: number;
  receiptQrValue: string;
  printStatus: PrintStatus;
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  dueDate: string | null;
  originalContent: string | null;
  timeSpent?: number | null;
  lastStartedAt?: number | null;
};

export type TaskAnalytics = {
  date: string;
  completed: number;
  xpEarned: number;
  added: number;
}[];

export type CreateTaskInput = {
  title: string;
  notes?: string;
  layer?: number;
  xp?: number;
  dueDate?: string;
};

export type OpenApiDocument = {
  openapi?: string;
  info?: {
    title?: string;
    version?: string;
  };
  paths?: Record<string, unknown>;
};
