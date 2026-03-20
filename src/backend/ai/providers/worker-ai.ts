/**
 * Cloudflare Workers AI Provider Integration
 * 
 * Provides a unified interface to Cloudflare's native Workers AI models, 
 * utilizing the OpenAI SDK compatibility layer through AI Gateway.
 * Supports text generation, structured output, embeddings, and tool calling.
 * 
 * @module AI/Providers/WorkerAI
 */

import OpenAI from "openai";
import { resolveDefaultAiModel } from "@/backend/ai/providers/config";
import { cleanJsonOutput, sanitizeAndFormatResponse } from "@/ai/utils/sanitizer";
import { AIOptions, TextWithToolsResponse, StructuredWithToolsResponse, ModelCapability, UnifiedModel, ModelFilter } from "@/backend/ai/providers/index";
import { getWorkerApiKey, getCloudflareApiToken, getAiGatewayToken, getCloudflareAccountId, getSecret } from "@/utils/secrets";

/** Primary model for reasoning tasks (e.g., Llama 3 or GPT-OSS). */
export const REASONING_MODEL = "@cf/openai/gpt-oss-120b";
/** Primary model for structured output and tool calling tasks. */
export const STRUCTURING_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
/** Primary model for embeddings. */
export const EMBEDDING_MODEL = "@cf/baai/bge-large-en-v1.5";



/**
 * Initializes a new OpenAI client routed through Cloudflare AI Gateway's 
 * universal/compat endpoint for Workers AI.
 * 
 * @param env - Cloudflare Environment bindings.
 * @returns A configured OpenAI client instance.
 * @agent-note This client behaves like an OpenAI client but targets Workers AI models.
 */
async function getAIClient(env: Env) {
  const gatewayId = env.AI_GATEWAY_NAME || "default-gateway";
  
  const gatewayToken = await getAiGatewayToken(env);
  if (!gatewayToken) {
    throw new Error("[WorkerAI] AI Gateway token not found.");
  }

  const baseUrl = await env.AI.gateway(gatewayId).getUrl('compat');

  return new OpenAI({   
    apiKey: "dummy-key",
    defaultHeaders: {
      "cf-aig-authorization": `Bearer ${gatewayToken}`
    },
    // Routes requests through AI Gateway's Universal/Compat endpoint
    baseURL: baseUrl,
  });
}

/**
 * Formats a model name for the Workers AI compatibility endpoint.
 * Adds the `workers-ai/` prefix if not already present.
 */
function formatModelNameForOpenAISDK(model: string): string {
  if (model.startsWith("workers-ai/")) {
    return model; // Already prefixed correctly
  }
  if (model.startsWith("@cf/")) {
    return `workers-ai/${model}`; // Cloudflare Workers AI model, needs prefix for OpenAI SDK compat
  }
  // For other models (e.g., 'openai/gpt-3.5-turbo', 'anthropic/claude-3-opus-20240229'),
  // assume they are already in the correct format for the AI Gateway compat endpoint.
  return model;
}

/**
 * Verifies API connectivity with Workers AI.
 */
export async function verifyApiKey(env: Env): Promise<boolean> {
  try {
    const client = await getAIClient(env);
    await client.chat.completions.create({
      model: formatModelNameForOpenAISDK(STRUCTURING_MODEL),
      messages: [{ role: "user", content: "hi" }],
      max_tokens: 1,
    });
    return true;
  } catch (error) {
    console.error("Workers AI Verification Error:", error);
    return false;
  }
}

async function executeWithFallback<T>(
  env: Env,
  originalModel: string,
  requiredCapability: ModelFilter | undefined,
  executionFn: (model: string) => Promise<T>
): Promise<T> {
  try {
    return await executionFn(originalModel);
  } catch (error: any) {
    // If the error is an authentication error, bubbling it up is better than trying fallback models that will also fail auth.
    if (error?.status === 401 || error?.status === 403 || error?.message?.includes("Authentication error")) {
      console.error(`[WorkerAI] Critical Authentication Error (Status ${error?.status || "Unknown"}). Please verify your active AI_GATEWAY_TOKEN or CLOUDFLARE_API_TOKEN is valid and has not expired.`);
      throw error;
    }

    console.warn(`[WorkerAI Fallback] Initial execution failed for model ${originalModel}:`, error?.message);
    const models = await getCloudflareModels(env);
    const requestedModelInfo = models.find(m => m.id === originalModel);
    
    if (requestedModelInfo) {
      if (requiredCapability && !requestedModelInfo.capabilities.includes(requiredCapability)) {
        console.warn(`[WorkerAI Fallback] ALERT: Specified model ${originalModel} is available but lacks capability '${requiredCapability}'.`);
      } else {
        console.warn(`[WorkerAI Fallback] Specified model ${originalModel} is available but failed.`);
      }
    } else {
      console.warn(`[WorkerAI Fallback] Specified model ${originalModel} is NOT available in the current models list (likely deprecated).`);
    }

    const fallbackModelInfo = models.find(m => m.id !== originalModel && (!requiredCapability || m.capabilities.includes(requiredCapability)));
    if (!fallbackModelInfo) {
      console.error(`[WorkerAI Fallback] No alternative model available. Throwing original error.`);
      throw error;
    }

    console.warn(`[WorkerAI Fallback] Retrying with alternative model: ${fallbackModelInfo.id}`);
    return await executionFn(fallbackModelInfo.id);
  }
}

/**
 * Generates text using a Workers AI model.
 */
export async function generateText(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  options?: AIOptions
): Promise<string> {
  const rawModel = options?.model || resolveDefaultAiModel(env, "worker-ai") || REASONING_MODEL;
  return executeWithFallback(env, rawModel, undefined, async (modelToUse) => {
    const client = await getAIClient(env);
    const model = formatModelNameForOpenAISDK(modelToUse);

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const isReasoningModel = model.includes("gpt-oss");
    const requestOptions: any = {
      model,
      messages,
    };

    if (isReasoningModel && options?.effort) {
      requestOptions.reasoning_effort = options.effort;
    }

    const response = await client.chat.completions.create(requestOptions);
    let textResult = response.choices[0]?.message?.content || "";

    if (options?.sanitize) {
      return sanitizeAndFormatResponse(textResult);
    }

    return textResult;
  });
}

/**
 * Generates a structured JSON response using Workers AI's JSON mode.
 */
export async function generateStructuredResponse<T = any>(
  env: Env,
  prompt: string,
  schema: object,
  systemPrompt?: string,
  options?: AIOptions
): Promise<T> {
  const rawModel = options?.model || STRUCTURING_MODEL;
  return executeWithFallback(env, rawModel, 'structured_response', async (modelToUse) => {
    const client = await getAIClient(env);
    const model = formatModelNameForOpenAISDK(modelToUse);

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model,
      messages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_output",
          schema: schema as Record<string, unknown>,
          strict: true
        }
      }
    });

    const rawJson = response.choices[0]?.message?.content || "{}";
    return JSON.parse(cleanJsonOutput(rawJson)) as T;
  });
}

export async function generateTextWithTools(
  env: Env,
  prompt: string,
  tools: any[],
  systemPrompt?: string,
  options?: AIOptions
): Promise<TextWithToolsResponse> {
  const rawModel = options?.model || STRUCTURING_MODEL;
  return executeWithFallback(env, rawModel, 'function_calling', async (modelToUse) => {
    const client = await getAIClient(env);
    const model = formatModelNameForOpenAISDK(modelToUse);

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: tools as any // assumes tools are already in OpenAI format
    });

    const message = response.choices[0]?.message;
    const text = message?.content || "";
    
    const toolCalls = (message?.tool_calls || []).map((tc: any) => ({
      id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments
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
  const rawModel = options?.model || STRUCTURING_MODEL;
  return executeWithFallback(env, rawModel, 'function_calling', async (modelToUse) => {
    const client = await getAIClient(env);
    const model = formatModelNameForOpenAISDK(modelToUse);

    const messages: any[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await client.chat.completions.create({
      model,
      messages,
      tools: tools as any,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "structured_output",
          schema: schema as Record<string, unknown>,
          strict: true
        }
      }
    });

    const message = response.choices[0]?.message;
    const rawJson = message?.content || "{}";
    const data = JSON.parse(cleanJsonOutput(rawJson)) as T;
    
    const toolCalls = (message?.tool_calls || []).map((tc: any) => ({
      id: tc.id || `call_${crypto.randomUUID()}`,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments
      }
    }));

    return { data, toolCalls };
  });
}

/**
 * Generates a single vector embedding for the given text.
 * Falls back to Workers AI native execution if no OpenAI preset is detected.
 * 
 * @param env - Cloudflare Environment bindings.
 * @param text - Input text.
 * @param model - Target model identifier (e.g., '@cf/baai/bge-large-en-v1.5').
 * @returns Vector array of numbers.
 */
export async function generateEmbedding(
  env: Env,
  text: string,
  model?: string
): Promise<number[]> {
  const rawModel = model || EMBEDDING_MODEL;
  if (!rawModel) {
    throw new Error("DEFAULT_MODEL_EMBEDDING is not set in environment variables.");
  }

  const client = await getAIClient(env);
  const modelToUse = formatModelNameForOpenAISDK(rawModel);

  try {
    const response = await client.embeddings.create({
      model: modelToUse,
      input: text
    });
    return response.data[0].embedding;
  } catch (error: any) {
    console.error(`Workers AI Embedding Error (${modelToUse}):`, error);
    throw error;
  }
}

export async function generateEmbeddings(env: Env, text: string | string[]): Promise<number[][]> {
  const rawModel = EMBEDDING_MODEL;
  if (!rawModel) {
    throw new Error("DEFAULT_MODEL_EMBEDDING is not set in environment variables.");
  }

  const inputArray = Array.isArray(text) ? text : [text];

  const client = await getAIClient(env);
  const modelToUse = formatModelNameForOpenAISDK(rawModel);

  try {
    const response = await client.embeddings.create({
      model: modelToUse,
      input: inputArray
    });
    return response.data.map(d => d.embedding);
  } catch (error: any) {
    console.error(`Workers AI Embeddings Error (${modelToUse}):`, error);
    throw error;
  }
}


/**
 * Lists available Workers AI models from the Cloudflare API 
 * and transforms them into consolidated model definitions.
 */
export async function getCloudflareModels(env: Env, filter?: ModelFilter): Promise<UnifiedModel[]> {
  const { Cloudflare } = await import("cloudflare");

  // Use Cloudflare API Token for the Cloudflare SDK, not AI Gateway Token
  const cloudflareApiToken = await getCloudflareApiToken(env);
  if (!cloudflareApiToken) {
    throw new Error("Cloudflare API Token is required to list models.");
  }
  const accountId = await getCloudflareAccountId(env);
  if (!accountId) {
    throw new Error("Cloudflare Account ID is required to list models.");
  }

  const cf = new Cloudflare({ apiToken: cloudflareApiToken });
  const response = await cf.ai.models.list({ account_id: accountId });
  
  // Cloudflare returns an array in 'result'
  const models: UnifiedModel[] = response.result.map((m: any) => {
    const caps: ModelFilter[] = [];
    const name = m.name.toLowerCase();
    const taskName = m.task.name.toLowerCase();
    const description = m.description.toLowerCase();

    // 1. Map Vision
    if (taskName.includes('image-to-text') || taskName.includes('text-to-image')) {
      caps.push('vision');
    }

    // 2. Map High Reasoning (Based on description/name as per your JSON example)
    if (description.includes('reasoning') || name.includes('120b') || name.includes('70b')) {
      caps.push('high_reasoning');
    }

    // 3. Map Fast (Small parameter counts or "mini" naming)
    if (name.includes('0.5b') || name.includes('3b') || name.includes('8b') || name.includes('tiny')) {
      caps.push('fast');
    }

    // 4. Map Structured Response & Function Calling
    if (taskName === 'text generation') {
      caps.push('structured_response');
      if (name.includes('llama-3') || name.includes('gpt-oss')) {
        caps.push('function_calling');
      }
    }

    // Extract Context Window from properties array
    const contextProp = m.properties?.find((p: any) => p.property_id === 'context_window');
    const maxTokens = contextProp ? parseInt(contextProp.value) : undefined;

    return {
      id: m.name,
      provider: 'cloudflare',
      name: m.name.split('/').pop() || m.name,
      description: m.description,
      capabilities: caps,
      maxTokens: maxTokens,
      raw: m
    };
  });

  return filter ? models.filter(m => m.capabilities.includes(filter)) : models;
}
