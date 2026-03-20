import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

import { createTask, getTask, listTasks, updateTaskStatus } from "@/api";
import { taskStatuses } from "@/db/schema/tasks";

const taskStatusSchema = z.enum(taskStatuses);

const taskSchema = z.object({
  id: z.string().length(6),
  title: z.string(),
  notes: z.string().nullable(),
  status: taskStatusSchema,
  layer: z.number().int(),
  xp: z.number().int(),
  receiptQrValue: z.string(),
  printStatus: z.enum(["queued", "sent", "failed"]),
  position: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  dueDate: z.string().nullable().optional(),
  originalContent: z.string().nullable(),
  ttsAudioBase64: z.string().optional(),
});

const taskAnalyticsSchema = z.array(z.object({
  date: z.string(),
  completed: z.number().int(),
  xpEarned: z.number().int(),
  added: z.number().int(),
}));

const createTaskBodySchema = z.object({
  title: z.string().min(1).max(140),
  notes: z.string().max(600).optional(),
  layer: z.number().int().min(1).max(5).optional(),
  xp: z.number().int().min(5).max(500).optional(),
  dueDate: z.string().optional(),
});

const updateTaskStatusBodySchema = z.object({
  status: taskStatusSchema,
  return_tts: z.boolean().optional(),
});

const listTasksQuerySchema = z.object({
  status: taskStatusSchema.optional(),
});

const taskParamsSchema = z.object({
  id: z.string().length(6),
});

const notFoundSchema = z.object({
  error: z.literal("Task not found"),
});

const printerResponseSchema = z.object({
  ok: z.boolean(),
  status: z.enum(["sent", "failed"]),
});

const adhdBurndownSchema = z.object({
  completedToday: z.array(taskSchema),
  completedLast3Days: z.array(taskSchema),
  completedLast7Days: z.array(taskSchema),
  remainingTasks: z.array(taskSchema),
});

export const tasksRoutes = new OpenAPIHono<{ Bindings: Env }>();

const listTasksRoute = createRoute({
  method: "get",
  path: "/",
  operationId: "listTasks",
  request: {
    query: listTasksQuerySchema,
  },
  responses: {
    200: {
      description: "List tasks.",
      content: {
        "application/json": {
          schema: z.array(taskSchema),
        },
      },
    },
  },
});

const createTaskRoute = createRoute({
  method: "post",
  path: "/",
  operationId: "createTask",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createTaskBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Create a task and dispatch its print job.",
      content: {
        "application/json": {
          schema: taskSchema.extend({
            printer: printerResponseSchema,
          }),
        },
      },
    },
  },
});

const getTaskRoute = createRoute({
  method: "get",
  path: "/{id}",
  operationId: "getTask",
  request: {
    params: taskParamsSchema,
  },
  responses: {
    200: {
      description: "Get a task by its receipt id.",
      content: {
        "application/json": {
          schema: taskSchema,
        },
      },
    },
    404: {
      description: "Task not found.",
      content: {
        "application/json": {
          schema: notFoundSchema,
        },
      },
    },
  },
});

const getTaskWsRoute = createRoute({
  method: "get",
  path: "/{id}/ws",
  operationId: "getTaskWebsocket",
  description: "Establish a WebSocket connection to stream real-time details of a specfic task.",
  request: {
    params: taskParamsSchema,
  },
  responses: {
    101: {
      description: "Switching Protocols to WebSocket. The server immediately sends the task payload.",
    },
    426: {
      description: "Upgrade Required",
    },
    404: {
      description: "Task not found.",
      content: {
        "application/json": {
          schema: notFoundSchema,
        },
      },
    },
  },
});

const getAdhdBurndownWsRoute = createRoute({
  method: "get",
  path: "/burndown/ws",
  operationId: "getAdhdBurndownWebsocket",
  description: "Establish a WebSocket connection to stream ADHD burndown statistics to local TTS AI.",
  responses: {
    101: {
      description: "Switching Protocols to WebSocket. The server immediately sends the categorized tasks payload.",
    },
    426: {
      description: "Upgrade Required",
    },
  },
});

const generateTaskTtsRoute = createRoute({
  method: "get",
  path: "/{id}/tts",
  operationId: "generateTaskTts",
  description: "Generate and return an audio file containing a motivational speech for the given task.",
  request: {
    params: taskParamsSchema,
  },
  responses: {
    200: {
      description: "Successful audio stream.",
      content: {
        "audio/mpeg": {
          schema: z.any()
        }
      }
    },
    404: {
      description: "Task not found or audio generation failed.",
      content: {
        "application/json": {
          schema: notFoundSchema,
        },
      },
    },
  },
});

const updateTaskStatusRoute = createRoute({
  method: "patch",
  path: "/{id}/status",
  operationId: "updateTaskStatus",
  request: {
    params: taskParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: updateTaskStatusBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Update a task status.",
      content: {
        "application/json": {
          schema: taskSchema,
        },
      },
    },
    404: {
      description: "Task not found.",
      content: {
        "application/json": {
          schema: notFoundSchema,
        },
      },
    },
  },
});

const updateTaskOrderBodySchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    status: taskStatusSchema,
    position: z.number().int(),
  }))
});

const updateTaskOrderRoute = createRoute({
  method: "post",
  path: "/reorder",
  operationId: "updateTaskOrder",
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateTaskOrderBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Update task order and status.",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

const getTaskAnalyticsRoute = createRoute({
  method: "get",
  path: "/analytics",
  operationId: "getTaskAnalytics",
  responses: {
    200: {
      description: "Get 7-day task performance analytics for charts.",
      content: {
        "application/json": {
          schema: taskAnalyticsSchema,
        },
      },
    },
  },
});

tasksRoutes.openapi(getTaskAnalyticsRoute, async (c) => {
  // @ts-ignore - Ensure getTaskAnalytics is imported implicitly or globally
  const { getTaskAnalytics } = await import("@/api");
  const data = await getTaskAnalytics(c.env);
  return c.json(data, 200);
});

tasksRoutes.openapi(getAdhdBurndownWsRoute, async (c) => {
  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426) as any;
  }

  const { getAdhdBurndownStats } = await import("@/api");
  const payload = await getAdhdBurndownStats(c.env);

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  
  // Send the burndown stats immediately upon connection
  server.send(JSON.stringify({
    type: "adhd_burndown_stats",
    data: payload
  }));

  // Keep connection alive with basic ping/pong
  server.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "ping") {
        server.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      // Ignore parse errors on raw messages
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  }) as any;
});

tasksRoutes.openapi(generateTaskTtsRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { getTask, generateTaskAudio } = await import("@/api");
  
  const task = await getTask(c.env, id);
  if (!task) {
    return c.json({ error: "Task not found" }, 404) as any;
  }

  const base64Audio = await generateTaskAudio(c.env, task, task.status);
  
  if (!base64Audio) {
    return c.json({ error: "Failed to generate TTS audio" }, 404) as any;
  }

  // Convert base64 to array buffer to return as standard binary response
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Disposition": `inline; filename="task_${id}.mp3"`
    }
  }) as any;
});

tasksRoutes.openapi(updateTaskOrderRoute, async (c) => {
  const { updateTaskOrder } = await import("@/api");
  const { items } = c.req.valid("json");
  const result = await updateTaskOrder(c.env, items);
  return c.json(result, 200);
});

tasksRoutes.openapi(listTasksRoute, async (c) => {
  const { status } = c.req.valid("query");
  return c.json(await listTasks(c.env, status), 200);
});

tasksRoutes.openapi(createTaskRoute, async (c) => {
  const payload = c.req.valid("json");
  const result = await createTask(c.env, payload, c.req.raw);
  return c.json(
    {
      ...result.task,
      printer: result.printer,
    },
    200,
  );
});

tasksRoutes.openapi(getTaskRoute, async (c) => {
  const { id } = c.req.valid("param");
  const task = await getTask(c.env, id);

  if (!task) {
    return c.json({ error: "Task not found" as const }, 404);
  }

  return c.json(task, 200);
});

tasksRoutes.openapi(getTaskWsRoute, async (c) => {
  const { id } = c.req.valid("param");

  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426) as any;
  }

  const { getTask } = await import("@/api");
  const task = await getTask(c.env, id);

  if (!task) {
    return c.json({ error: "Task not found" }, 404) as any;
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();
  
  // Send the task details immediately upon connection
  server.send(JSON.stringify({
    type: "task_details",
    data: task
  }));

  // Keep connection alive with basic ping/pong
  server.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "ping") {
        server.send(JSON.stringify({ type: "pong" }));
      }
    } catch {
      // Ignore parse errors on raw messages
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  }) as any;
});

tasksRoutes.openapi(updateTaskStatusRoute, async (c) => {
  const { id } = c.req.valid("param");
  const { status, return_tts } = c.req.valid("json");
  
  const { updateTaskStatus, generateTaskAudio } = await import("@/api");
  
  const task = await updateTaskStatus(c.env, { id, status }, c.req.raw);

  if (!task) {
    return c.json({ error: "Task not found" as const }, 404);
  }

  let ttsAudioBase64: string | undefined;
  if (return_tts) {
    const audio = await generateTaskAudio(c.env, task, status);
    if (audio) {
      ttsAudioBase64 = audio;
    }
  }

  return c.json({ ...task, ttsAudioBase64 }, 200);
});

