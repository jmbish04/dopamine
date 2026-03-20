/**
 * OpenAI Provider Integration
 * 
 * Provides an interface to OpenAI's models via official SDK, 
 * routed through Cloudflare AI Gateway. Supports Chat Completions, 
 * structured JSON (via `json_schema`), and tool calling.
 * 
 * @module AI/Providers/OpenAI
 */
import { getAiGatewayUrl, resolveDefaultAiModel } from "@/backend/ai/providers/config";
import { getAIGatewayUrl as getRawGatewayUrl } from "@/backend/ai/utils/ai-gateway";
import { getOpenaiApiKey } from "@utils/secrets";
import { cleanJsonOutput } from "@/ai/utils/sanitizer";
import { AIOptions, TextWithToolsResponse, StructuredWithToolsResponse, ModelCapability, UnifiedModel, ModelFilter } from "@/backend/ai/providers/index";

/**
 * Initializes an OpenAI client instance.
 * Transparently configures the client to use Cloudflare AI Gateway 
 * while maintaining native API key authorization.
 * 
 * @param env - Cloudflare Environment bindings.
 * @returns An initialized OpenAI client.
 */
export async function createOpenAIClient(env: Env) {
  // @ts-ignore
  const aigToken = await getSecret(env, "AI_GATEWAY_TOKEN");

  // "Key in Request + Authenticated Gateway" pattern:
  // - apiKey: REAL OpenAI key (SDK sends as Authorization: Bearer)
  // - cf-aig-authorization: gateway token (for gateway auth/logging)
  const apiKey = await getOpenaiApiKey(env);

  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY — required for SDK auth");
  }

  const OpenAIModule = await import("openai");
  const OpenAIClass = OpenAIModule.default || Object.values(OpenAIModule).find((m: any) => m && m.name === 'OpenAI') || OpenAIModule;
  const baseURL = await getAiGatewayUrl(env, "openai");

  return new (OpenAIClass as any)({
    apiKey: apiKey,
    baseURL,
    defaultHeaders: aigToken ? { 'cf-aig-authorization': `Bearer ${aigToken}` } : undefined,
  });
}

/**
 * Verifies API connectivity by listing available models.
 */
export async function verifyApiKey(env: Env): Promise<boolean> {
  try {
    const client = await createOpenAIClient(env);
    await client.models.list();
    return true;
  } catch (error) {
    console.error("OpenAI Verification Error:", error);
    return false;
  }
}

/**
 * Orchestrates execution with automatic model fallback for OpenAI.
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
    console.warn(`[OpenAI Fallback] Initial execution failed for model \${originalModel}:`, error?.message);
    const models = await getOpenAIModels(env);
    const requestedModelInfo = models.find(m => m.id === originalModel);
    
    if (requestedModelInfo) {
      if (requiredCapability && !requestedModelInfo.capabilities.includes(requiredCapability)) {
        console.warn(`[OpenAI Fallback] ALERT: Specified model \${originalModel} is available but lacks capability '\${requiredCapability}'.`);
      } else {
        console.warn(`[OpenAI Fallback] Specified model \${originalModel} is available but failed.`);
      }
    } else {
      console.warn(`[OpenAI Fallback] Specified model \${originalModel} is NOT available in the current models list (likely deprecated).`);
    }

    const fallbackModelInfo = models.find(m => m.id !== originalModel && (!requiredCapability || m.capabilities.includes(requiredCapability)));
    if (!fallbackModelInfo) {
      console.error(`[OpenAI Fallback] No alternative model available. Throwing original error.`);
      throw error;
    }

    console.warn(`[OpenAI Fallback] Retrying with alternative model: \${fallbackModelInfo.id}`);
    return await executionFn(fallbackModelInfo.id);
  }
}

/**
 * Generates text using an OpenAI model.
 */
export async function generateText(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  options?: AIOptions
): Promise<string> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "openai");
  return executeWithFallback(env, initialModel, undefined, async (model) => {
    const client = await createOpenAIClient(env);
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    return response.choices[0]?.message?.content || "";
  });
}

/**
 * Generates a structured JSON response using OpenAI's `json_schema` mode.
 */
export async function generateStructuredResponse<T = any>(
  env: Env,
  prompt: string,
  schema: object,
  systemPrompt?: string,
  options?: AIOptions
): Promise<T> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "openai");
  return executeWithFallback(env, initialModel, 'structured_response', async (model) => {
    const client = await createOpenAIClient(env);
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_output",
          schema: schema as any,
          strict: true
        }
      }
    });

    return JSON.parse(cleanJsonOutput(response.choices[0]?.message?.content || "{}")) as T;
  });
}

export async function generateTextWithTools(
  env: Env,
  prompt: string,
  tools: any[],
  systemPrompt?: string,
  options?: AIOptions
): Promise<TextWithToolsResponse> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "openai");
  return executeWithFallback(env, initialModel, 'function_calling', async (model) => {
    const client = await createOpenAIClient(env);
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    const msg = response.choices[0]?.message;
    return {
      text: msg?.content || "",
      toolCalls: msg?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        function: { name: tc.function?.name, arguments: tc.function?.arguments }
      })) || []
    };
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
  const initialModel = options?.model || resolveDefaultAiModel(env, "openai");
  return executeWithFallback(env, initialModel, 'function_calling', async (model) => {
    const client = await createOpenAIClient(env);
    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model,
      messages,
      tools,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_output",
          schema: schema as any,
          strict: true
        }
      }
    });

    const msg = response.choices[0]?.message;
    return {
      data: JSON.parse(cleanJsonOutput(msg?.content || "{}")) as T,
      toolCalls: msg?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        function: { name: tc.function?.name, arguments: tc.function?.arguments }
      })) || []
    };
  });
}




/**
 * Lists and transforms available OpenAI models.
 */
export async function getOpenAIModels(env: Env, filter?: ModelFilter): Promise<UnifiedModel[]> {
  const client = await createOpenAIClient(env);
  const { data } = await client.models.list();
  
  const models: UnifiedModel[] = data.map((m: any) => {
    const caps: ModelFilter[] = [];
    const id = m.id.toLowerCase();

    if (id.includes('gpt-4') || id.includes('o1') || id.includes('o3')) {
        caps.push('high_reasoning', 'structured_response', 'function_calling');
    }
    if (id.includes('mini') || id.includes('turbo')) caps.push('fast');
    if (id.includes('gpt-4o') || id.includes('vision')) caps.push('vision');

    return {
      id: m.id,
      provider: 'openai',
      name: m.id,
      description: `OpenAI model ${m.id}`,
      capabilities: caps,
      raw: m
    };
  });

  return filter ? models.filter(m => m.capabilities.includes(filter)) : models;
}