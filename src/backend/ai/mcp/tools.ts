/**
 * @file src/mcp/tools.ts
 * @description Model Context Protocol (MCP) tools listing and execution
 * @owner AI-Builder
 */

import { z } from "zod";
import * as S from "@/backend/schemas/apiSchemas";

/**
 * MCP Tool Definition
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny; // Zod schema for validation
  examples?: Array<{
    input: Record<string, any>;
    output: Record<string, any>;
  }>;
  category: string;
  tags?: string[];
}

/**
 * Registry of all available MCP tools
 */
export const MCP_TOOLS: MCPTool[] = [
  {
    name: "createSession",
    description: "Create a new agent session for GitHub search and analysis",
    category: "Agent Orchestration",
    tags: ["agents", "sessions", "orchestration"],
    inputSchema: S.CreateSessionRequest,
    examples: [
      {
        input: {
          projectId: "my-project",
          searchTerms: ["cloudflare workers", "durable objects"],
          options: {
            maxResults: 100,
          },
        },
        output: {
          success: true,
          session: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            status: "active",
          },
        },
      },
    ],
  },
  {
    name: "getSessionStatus",
    description: "Get the status of an agent session",
    category: "Agent Orchestration",
    tags: ["agents", "sessions", "status"],
    inputSchema: z.object({
      sessionId: z.string().uuid().describe("Session ID (UUID)"),
    }),
    examples: [
      {
        input: {
          sessionId: "550e8400-e29b-41d4-a716-446655440000",
        },
        output: {
          success: true,
          session: {
            id: "550e8400-e29b-41d4-a716-446655440000",
            status: "completed",
          },
        },
      },
    ],
  },
];

/**
 * Serialize MCP tools for JSON output (converting Zod schemas to JSON Schema)
 */
export async function serializeTools(): Promise<Array<{
  name: string;
  description: string;
  inputSchema: any;
  examples?: Array<{ input: Record<string, any>; output: Record<string, any> }>;
  category: string;
  tags?: string[];
}>> {
  const { zodToJsonSchema } = await import("zod-to-json-schema");
  return MCP_TOOLS.map(tool => ({
    ...tool,
    inputSchema: zodToJsonSchema(tool.inputSchema as any, {
      target: "jsonSchema7",
      $refStrategy: "none",
    }) as any,
  }));
}

/**
 * Get all MCP tools grouped by category
 */
export function getToolsByCategory(): Record<string, MCPTool[]> {
  const grouped: Record<string, MCPTool[]> = {};

  for (const tool of MCP_TOOLS) {
    if (!grouped[tool.category]) {
      grouped[tool.category] = [];
    }
    grouped[tool.category].push(tool);
  }

  return grouped;
}

/**
 * Get a specific tool by name
 */
export function getTool(name: string): MCPTool | undefined {
  return MCP_TOOLS.find(tool => tool.name === name);
}

/**
 * Search tools by tag
 */
export function searchToolsByTag(tag: string): MCPTool[] {
  return MCP_TOOLS.filter(tool => tool.tags?.includes(tag));
}

/**
 * Get tool statistics
 */
export function getToolStats() {
  const categories = new Set<string>();
  const tags = new Set<string>();

  for (const tool of MCP_TOOLS) {
    categories.add(tool.category);
    if (tool.tags) {
      for (const tag of tool.tags) {
        tags.add(tag);
      }
    }
  }

  return {
    totalTools: MCP_TOOLS.length,
    categories: Array.from(categories),
    categoryCount: categories.size,
    tags: Array.from(tags),
    tagCount: tags.size,
  };
}

/**
 * Execute request and response body schemas
 */
export const MCPExecuteRequest = z.object({
  tool: z.string().min(1).describe("Tool name to execute"),
  params: z.record(z.string(), z.any()).describe("Tool parameters"),
}).openapi({
  example: {
    tool: "searchRepositories",
    params: {
      q: "language:typescript",
      per_page: 10,
    },
  },
});

export const MCPExecuteResponse = z.object({
  success: z.literal(true),
  tool: z.string(),
  result: z.any(),
  executedAt: z.string(),
  durationMs: z.number().optional(),
}).openapi({
  example: {
    success: true,
    tool: "searchRepositories",
    result: {
      total_count: 100,
      items: [],
    },
    executedAt: "2024-01-01T00:00:00Z",
    durationMs: 123,
  },
});

export const MCPToolsListResponse = z.object({
  success: z.literal(true),
  tools: z.array(z.any()),
  stats: z.object({
    totalTools: z.number().int(),
    categories: z.array(z.string()),
    categoryCount: z.number().int(),
  }),
}).openapi({
  example: {
    success: true,
    tools: [],
    stats: {
      totalTools: 7,
      categories: ["GitHub Search", "GitHub Files", "GitHub Issues"],
      categoryCount: 3,
    },
  },
});

export type TMCPExecuteRequest = z.infer<typeof MCPExecuteRequest>;
export type TMCPExecuteResponse = z.infer<typeof MCPExecuteResponse>;
export type TMCPToolsListResponse = z.infer<typeof MCPToolsListResponse>;

/**
 * Tool routing configuration
 */
export interface ToolRoute {
  path: string;
  method: "GET" | "POST";
  pathBuilder?: (params: any) => string;
}

/**
 * Mapping of MCP tool names to their corresponding API routes
 */
export const TOOL_ROUTES: Record<string, ToolRoute> = {
  createSession: {
    path: "/api/agents/session",
    method: "POST",
  },
  getSessionStatus: {
    path: "/api/agents/session",
    method: "GET",
    pathBuilder: (params: { sessionId: string }) => `/api/agents/session/${params.sessionId}`,
  }
};
