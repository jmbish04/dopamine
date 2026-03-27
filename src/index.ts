import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { apiReference } from '@scalar/hono-api-reference';
import { drizzle } from 'drizzle-orm/d1';
import { tasks } from './db/schema';
import { eq } from 'drizzle-orm';

export type Env = {
  DB: D1Database;
  AI_GATEWAY_URL: string;
  OPENAI_API_KEY: string;
};

const app = new OpenAPIHono<{ Bindings: Env }>();

const TaskSchema = z.object({
  id: z.number().openapi({ example: 1 }),
  title: z.string().openapi({ example: 'Complete Q3 Marketing Report' }),
  status: z.string().openapi({ example: 'pending' }),
  duration: z.number().nullable().openapi({ example: 0 }),
  createdAt: z.string().openapi({ example: '2026-03-20T12:00:00Z' }),
});

const createTaskRoute = createRoute({
  method: 'post',
  path: '/api/tasks',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            title: z.string().openapi({ example: 'New Task' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskSchema,
        },
      },
      description: 'Create a new task',
    },
  },
});

app.openapi(createTaskRoute, async (c) => {
  const { title } = c.req.valid('json');
  const db = drizzle(c.env.DB);

  const result = await db.insert(tasks).values({
    title,
    status: 'pending',
    duration: 0,
    createdAt: new Date(),
  }).returning().get();

  return c.json({
    id: result.id,
    title: result.title,
    status: result.status,
    duration: result.duration,
    createdAt: result.createdAt.toISOString(),
  }, 200);
});

const listTasksRoute = createRoute({
  method: 'get',
  path: '/api/tasks',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(TaskSchema),
        },
      },
      description: 'List all tasks',
    },
  },
});

app.openapi(listTasksRoute, async (c) => {
  const db = drizzle(c.env.DB);
  const allTasks = await db.select().from(tasks).all();

  return c.json(allTasks.map(t => ({
    id: t.id,
    title: t.title,
    status: t.status,
    duration: t.duration,
    createdAt: t.createdAt.toISOString(),
  })), 200);
});

const updateTaskRoute = createRoute({
  method: 'put',
  path: '/api/tasks/{id}',
  request: {
    params: z.object({
      id: z.string().openapi({ example: '1' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string().optional().openapi({ example: 'completed' }),
            duration: z.number().optional().openapi({ example: 1500 }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: TaskSchema,
        },
      },
      description: 'Update a task',
    },
    400: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Invalid ID',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({ error: z.string() }),
        },
      },
      description: 'Task not found',
    },
  },
});

app.openapi(updateTaskRoute, async (c) => {
  const id = parseInt(c.req.valid('param').id, 10);
  if (isNaN(id)) {
    return c.json({ error: 'Invalid ID' }, 400);
  }
  const body = c.req.valid('json');
  const db = drizzle(c.env.DB);

  const updateData: { status?: string; duration?: number } = {};
  if (body.status !== undefined) updateData.status = body.status;
  if (body.duration !== undefined) updateData.duration = body.duration;

  const result = await db.update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .returning().get();

  if (!result) {
    return c.json({ error: 'Task not found' }, 404);
  }

  return c.json({
    id: result.id,
    title: result.title,
    status: result.status,
    duration: result.duration,
    createdAt: result.createdAt.toISOString(),
  }, 200);
});

const aiDJRoute = createRoute({
  method: 'post',
  path: '/api/ai/dj',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            prompt: z.string().openapi({ example: 'More energy' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            response: z.string(),
          }),
        },
      },
      description: 'AI DJ Response via Cloudflare AI Gateway',
    },
    500: {
      content: {
        'application/json': {
          schema: z.object({
            error: z.string().optional(),
            response: z.string().optional(),
          }),
        },
      },
      description: 'Error response',
    },
  },
});

app.openapi(aiDJRoute, async (c) => {
  const { prompt } = c.req.valid('json');
  const gatewayUrl = c.env.AI_GATEWAY_URL;
  if (!gatewayUrl) {
    return c.json({ error: 'AI_GATEWAY_URL is not configured' }, 500);
  }

  try {
    const aiResponse = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await aiResponse.json() as any;
    return c.json({ response: data.choices?.[0]?.message?.content || 'Vibe adjusted.' }, 200);
  } catch (error) {
    return c.json({ response: 'Error connecting to AI Gateway.' }, 500);
  }
});

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'The Onion Tasker API',
  },
});

app.get('/swagger', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Swagger UI</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui',
          });
        };
      </script>
    </body>
    </html>
  `);
});

app.get('/scalar', apiReference({
  spec: {
    url: '/openapi.json',
  },
}));

export default app;
