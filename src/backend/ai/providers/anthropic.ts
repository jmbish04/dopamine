/**
 * Anthropic AI Provider Integration
 * 
 * Provides an interface to Anthropic's Claude models via the official SDK, 
 * routed through Cloudflare AI Gateway for observability and centralized auth.
 * Support for text generation, structured responses, and tool calling.
 * 
 * @module AI/Providers/Anthropic
 */
import { getAiGatewayUrl, resolveDefaultAiModel } from "@/backend/ai/providers/config";
import { getAnthropicApiKey } from "@utils/secrets";
import { AIOptions, TextWithToolsResponse, StructuredWithToolsResponse, ModelCapability, UnifiedModel, ModelFilter } from "@/backend/ai/providers/index";


/**
 * Initializes a new Anthropic client instance.
 * Automatically configures the client to use Cloudflare AI Gateway.
 * 
 * @param env - Cloudflare Environment bindings.
 * @returns An initialized Anthropic client.
 * @throws Error if `ANTHROPIC_API_KEY` is missing.
 */
export async function createAnthropicClient(env: Env) {
  const apiKey = await getAnthropicApiKey(env);
  // @ts-ignore
  const aigToken = typeof env.AI_GATEWAY_TOKEN === 'object' && env.AI_GATEWAY_TOKEN?.get ? await env.AI_GATEWAY_TOKEN.get() : env.AI_GATEWAY_TOKEN as string;

  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY in environment variables");
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({
    apiKey: apiKey,
    baseURL: await getAiGatewayUrl(env, "anthropic", "anthropic_sdk"),
    defaultHeaders: aigToken ? { 'cf-aig-authorization': `Bearer ${aigToken}` } : undefined,
  });
}

/**
 * Verifies the validity of the Anthropic API key/Gateway config.
 * Performs a minimal text generation request.
 * 
 * @param env - Cloudflare Environment bindings.
 * @returns True if the verification call succeeds.
 */
export async function verifyApiKey(env: Env): Promise<boolean> {
  try {
    const client = await createAnthropicClient(env);
    await client.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }]
    });
    return true;
  } catch (error) {
    console.error("Anthropic Verification Error:", error);
    return false;
  }
}

/**
 * Orchestrates execution with automatic model fallback for Anthropic.
 * If the primary model fails, it attempts to find a suitable replacement 
 * within the Anthropic provider that satisfies the required capability.
 * 
 * @template T - The return type of the execution function.
 * @param env - Cloudflare Environment bindings.
 * @param originalModel - The preferred model ID.
 * @param requiredCapability - Optional capability filter (e.g., 'vision', 'fast').
 * @param executionFn - The core logic to execute.
 * @returns Result of the execution function.
 * @agent-note This pattern ensures high availability even during model deprecations or local outages.
 */
async function executeWithFallback<T>(
  env: Env,
  originalModel: string,
  requiredCapability: ModelFilter | undefined,
  executionFn: (model: string) => Promise<T>
): Promise<T> {
  try {
    return await executionFn(originalModel);
  } catch (error: any) {
    console.warn(`[Anthropic Fallback] Initial execution failed for model \${originalModel}:`, error?.message);
    const models = await getAnthropicModels(env);
    const requestedModelInfo = models.find(m => m.id === originalModel);
    
    if (requestedModelInfo) {
      if (requiredCapability && !requestedModelInfo.capabilities.includes(requiredCapability)) {
        console.warn(`[Anthropic Fallback] ALERT: Specified model \${originalModel} is available but lacks capability '\${requiredCapability}'.`);
      } else {
        console.warn(`[Anthropic Fallback] Specified model \${originalModel} is available but failed.`);
      }
    } else {
      console.warn(`[Anthropic Fallback] Specified model \${originalModel} is NOT available in the current models list (likely deprecated).`);
    }

    const fallbackModelInfo = models.find(m => m.id !== originalModel && (!requiredCapability || m.capabilities.includes(requiredCapability)));
    if (!fallbackModelInfo) {
      console.error(`[Anthropic Fallback] No alternative model available. Throwing original error.`);
      throw error;
    }

    console.warn(`[Anthropic Fallback] Retrying with alternative model: \${fallbackModelInfo.id}`);
    return await executionFn(fallbackModelInfo.id);
  }
}

/**
 * Generates plain text using an Anthropic model.
 * 
 * @param env - Cloudflare Environment bindings.
 * @param prompt - User message.
 * @param systemPrompt - Optional system role/instructions.
 * @param options - Generation options (maxTokens, temperature, etc).
 * @returns The generated text response.
 */
export async function generateText(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  options?: AIOptions
): Promise<string> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "anthropic");
  return executeWithFallback(env, initialModel, undefined, async (model) => {
    const client = await createAnthropicClient(env);
    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }]
    });

    return (response.content.find((c: any) => c.type === 'text') as any)?.text || "";
  });
}

/**
 * Generates a structured (JSON) response using Anthropic's tool-calling mechanism.
 * 
 * @template T - The expected shape of the response.
 * @param env - Cloudflare Environment bindings.
 * @param prompt - User message.
 * @param schema - JSON Schema to enforce.
 * @param systemPrompt - Optional system role/instructions.
 * @param options - Generation options.
 * @returns The parsed JSON object.
 */
export async function generateStructuredResponse<T = any>(
  env: Env,
  prompt: string,
  schema: object,
  systemPrompt?: string,
  options?: AIOptions
): Promise<T> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "anthropic");
  return executeWithFallback(env, initialModel, 'structured_response', async (model) => {
    const client = await createAnthropicClient(env);
    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
      tool_choice: { type: "tool", name: "structured_output" },
      tools: [{
        name: "structured_output",
        description: "Output strictly matching the required JSON schema",
        input_schema: schema as any
      }]
    });

    const toolCall = response.content.find((c: any) => c.type === "tool_use" && c.name === "structured_output");
    if (toolCall && toolCall.type === "tool_use") {
      return toolCall.input as T;
    }
    
    throw new Error("Anthropic failed to return the structured_output tool call");
  });
}

/**
 * Executes a text generation request with multiple tools available.
 * 
 * @param env - Cloudflare Environment bindings.
 * @param prompt - User message.
 * @param tools - Array of tool definitions (OpenAI tool format).
 * @param systemPrompt - Optional system role/instructions.
 * @param options - Generation options.
 * @returns Object containing the text response and any tool calls.
 */
export async function generateTextWithTools(
  env: Env,
  prompt: string,
  tools: any[],
  systemPrompt?: string,
  options?: AIOptions
): Promise<TextWithToolsResponse> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "anthropic");
  return executeWithFallback(env, initialModel, 'function_calling', async (model) => {
    const client = await createAnthropicClient(env);
    const anthropicTools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description || "",
      input_schema: t.function.parameters as any
    }));

    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
      tools: anthropicTools,
    });

    const text = (response.content.find((c: any) => c.type === "text") as any)?.text || "";
    const toolCalls = response.content
      .filter((c: any) => c.type === "tool_use")
      .map((c: any) => ({
        id: c.id,
        function: {
          name: c.name,
          arguments: JSON.stringify(c.input)
        }
      }));

    return { text, toolCalls };
  });
}

export async function generateStructuredWithTools<T = any>(
  env: Env,
  prompt: string,
  schema: object,
  tools: any[],
  systemPrompt?: string,
  options?: AIOptions
): Promise<StructuredWithToolsResponse<T>> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "anthropic");
  return executeWithFallback(env, initialModel, 'function_calling', async (model) => {
    const client = await createAnthropicClient(env);
    const structuredTool = {
      name: "structured_output",
      description: "Provide your final answered data here",
      input_schema: schema as any
    };

    const anthropicTools = [
      ...tools.map(t => ({
        name: t.function.name,
        description: t.function.description || "",
        input_schema: t.function.parameters as any
      })),
      structuredTool
    ];

    const contextualSystemPrompt = systemPrompt 
      ? `${systemPrompt}\nYou must use the 'structured_output' tool to output your final answer.`
      : "You must use the 'structured_output' tool to output your final answer.";

    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature,
      system: contextualSystemPrompt,
      messages: [{ role: "user", content: prompt }],
      tools: anthropicTools
    });

    const structureCall = response.content.find((c: any) => c.type === "tool_use" && c.name === "structured_output");
    const toolCalls = response.content
      .filter((c: any) => c.type === "tool_use" && c.name !== "structured_output")
      .map((c: any) => ({
        id: c.id,
        function: {
          name: c.name,
          arguments: JSON.stringify(c.input)
        }
      }));

    return {
      data: (structureCall?.type === "tool_use" ? structureCall.input : {}) as T,
      toolCalls
    };
  });
}

/**
 * Retrieves a list of available Anthropic models and their capabilities.
 * 
 * @param env - Cloudflare Environment bindings.
 * @param filter - Optional capability to filter models by.
 * @returns Array of unified model definitions.
 */
export async function getAnthropicModels(env: Env, filter?: ModelFilter): Promise<UnifiedModel[]> {
  const client = await createAnthropicClient(env);
  const { data } = await client.models.list();
  
  const models: UnifiedModel[] = data.map(m => {
    const caps: ModelFilter[] = ['vision', 'function_calling']; // Standard on Claude 3+
    if (m.id.includes('haiku')) caps.push('fast');
    if (m.id.includes('opus')) caps.push('high_reasoning');

    return {
      id: m.id,
      provider: 'anthropic',
      name: m.display_name || m.id,
      description: `Anthropic ${m.id} model`,
      capabilities: caps,
      raw: m
    };
  });

  return filter ? models.filter(m => m.capabilities.includes(filter)) : models;
}
