/**
 * Google Gemini AI Provider Integration
 * 
 * Implements the Gemini provider using the `@google/genai` SDK.
 * Features:
 * 1. BYOK (Bring Your Own Key) via Cloudflare AI Gateway.
 * 2. Fetch interception to inject Gateway Auth and strip dummy keys.
 * 3. Support for text, structured JSON, vision, and function calling.
 * 4. Automatic model fallback orchestration.
 * 
 * @module AI/Providers/Gemini
 */
import { getAiGatewayUrl, resolveDefaultAiModel } from "@/backend/ai/providers/config";
import { getAIGatewayUrl as getRawGatewayUrl } from "@/backend/ai/utils/ai-gateway";
import { cleanJsonOutput } from "@/ai/utils/sanitizer";
import { AIOptions, TextWithToolsResponse, StructuredWithToolsResponse, ModelCapability, UnifiedModel, ModelFilter } from "@/backend/ai/providers/index";

/**
 * Initializes a Google Gemini client (GoogleGenAI).
 * Extends the global `fetch` temporarily to route requests through 
 * the Cloudflare AI Gateway with BYOK authorization.
 * 
 * @param env - Cloudflare Environment bindings.
 * @param model - Target model identifier (used for context).
 * @returns A configured GoogleGenAI instance.
 * @throws Error if Gateway credentials or Account ID are missing.
 * @agent-note The client uses a dummy API key because the real key is handled by the Gateway.
 */
export async function createGeminiClient(env: Env, model: string) {
  // @ts-ignore
  const aigToken = typeof env.AI_GATEWAY_TOKEN === 'object' && env.AI_GATEWAY_TOKEN?.get ? await env.AI_GATEWAY_TOKEN.get() : env.AI_GATEWAY_TOKEN as string;

  if (!aigToken || !env.CLOUDFLARE_ACCOUNT_ID) {
    throw new Error("Missing AI_GATEWAY_TOKEN and CLOUDFLARE_ACCOUNT_ID required for BYOK configuration");
  }

  const { GoogleGenAI } = await import("@google/genai");
  const baseUrl = await getRawGatewayUrl(env, { provider: "google-ai-studio" });

  const originalFetch = globalThis.fetch;
  
  // Intercept the fetch call to strip dummy keys and inject the Gateway Authorization
  const wrappedFetch = async (url: any, init: any) => {
    const newInit = { ...init };
    if (newInit.headers) {
      const headers = new Headers(newInit.headers);
      
      // Strip the SDK-enforced dummy key so it doesn't override the Gateway's BYOK injection
      headers.delete("x-goog-api-key");
      
      // Apply the AI Gateway token for Gateway auth
      if (aigToken && !headers.has("cf-aig-authorization")) {
          headers.set("cf-aig-authorization", `Bearer ${aigToken}`);
      }
      
      const headerObj: Record<string, string> = {};
      headers.forEach((value, key) => {
          headerObj[key] = value;
      });
      newInit.headers = headerObj;
    }

    let finalUrl = String(url);
    try {
        const u = new URL(finalUrl);
        // Strip the query parameter ?key= if the SDK appended the dummy key
        if (u.searchParams.has("key")) {
            u.searchParams.delete("key");
            finalUrl = u.toString();
        }
    } catch (e) { /* ignore url parsing errors */ }

    return await originalFetch(finalUrl, newInit);
  };
  
  // Monkey-patch temporarily for this instance creation
  globalThis.fetch = wrappedFetch as unknown as typeof fetch;

  try {
    const client = new GoogleGenAI({
      // Pass a dummy key to bypass SDK validation. 
      // The real key is stored in Cloudflare AI Gateway (BYOK)
      apiKey: "cf-aig-byok-dummy-key",
      httpOptions: {
        baseUrl,
      },
    });
    
    return client;
  } finally {
     // We leave fetch patched currently as the client resolves requests asynchronously later
  }
}

/**
 * Verifies the Gemini integration by attempting to fetch model metadata.
 */
export async function verifyApiKey(env: Env): Promise<boolean> {
  try {
    const testModel = "gemini-2.5-flash";
    const client = await createGeminiClient(env, testModel);
    await client.models.get({ model: testModel });
    return true;
  } catch (error) {
    console.error("Gemini BYOK Verification Error:", error);
    return false;
  }
}

/**
 * Orchestrates execution with automatic model fallback for Gemini.
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
    console.warn(`[Gemini Fallback] Initial execution failed for model ${originalModel}:`, error?.message);
    const models = await getGoogleModels(env);
    const requestedModelInfo = models.find(m => m.id === originalModel);
    
    if (requestedModelInfo) {
      if (requiredCapability && !requestedModelInfo.capabilities.includes(requiredCapability)) {
        console.warn(`[Gemini Fallback] ALERT: Specified model ${originalModel} is available but lacks capability '${requiredCapability}'.`);
      } else {
        console.warn(`[Gemini Fallback] Specified model ${originalModel} is available but failed.`);
      }
    } else {
      console.warn(`[Gemini Fallback] Specified model ${originalModel} is NOT available in the current models list (likely deprecated).`);
    }

    const fallbackModelInfo = models.find(m => m.id !== originalModel && (!requiredCapability || m.capabilities.includes(requiredCapability)));
    if (!fallbackModelInfo) {
      console.error(`[Gemini Fallback] No alternative model available. Throwing original error.`);
      throw error;
    }

    console.warn(`[Gemini Fallback] Retrying with alternative model: ${fallbackModelInfo.id}`);
    return await executionFn(fallbackModelInfo.id);
  }
}

/**
 * Generates text using a Gemini model.
 */
export async function generateText(
  env: Env,
  prompt: string,
  systemPrompt?: string,
  options?: AIOptions
): Promise<string> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "gemini");
  return executeWithFallback(env, initialModel, undefined, async (model) => {
    const client = await createGeminiClient(env, model);
    const response = await client.models.generateContent({
      model,
      config: {
        systemInstruction: systemPrompt,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    return response.text || "";
  });
}

/**
 * Generates a structured JSON response using Gemini's native JSON mode.
 * 
 * @param schema - The JSON Schema defining the expected output.
 */
export async function generateStructuredResponse<T = any>(
  env: Env,
  prompt: string,
  schema: object,
  systemPrompt?: string,
  options?: AIOptions
): Promise<T> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "gemini");
  return executeWithFallback(env, initialModel, 'structured_response', async (model) => {
    const client = await createGeminiClient(env, model);
    const response = await client.models.generateContent({
      model,
      config: {
        systemInstruction: systemPrompt,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });
    return JSON.parse(cleanJsonOutput(response.text || "{}")) as T;
  });
}

/**
 * Executes a text request with function calling capabilities.
 */
export async function generateTextWithTools(
  env: Env,
  prompt: string,
  tools: any[],
  systemPrompt?: string,
  options?: AIOptions
): Promise<TextWithToolsResponse> {
  const initialModel = options?.model || resolveDefaultAiModel(env, "gemini");
  return executeWithFallback(env, initialModel, 'function_calling', async (model) => {
    const client = await createGeminiClient(env, model);
    const functionDeclarations = tools.map((t) => t.function);
    const response = await client.models.generateContent({
      model,
      config: {
        systemInstruction: systemPrompt,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
        tools: [{ functionDeclarations }] as any,
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const toolCalls = response.functionCalls?.map((call, index) => ({
      id: `call_${index}`,
      function: {
        name: call.name || "unknown",
        arguments: JSON.stringify(call.args || {})
      }
    })) || [];

    return {
      text: response.text || "",
      toolCalls,
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
  const initialModel = options?.model || resolveDefaultAiModel(env, "gemini");
  return executeWithFallback(env, initialModel, 'function_calling', async (model) => {
    const client = await createGeminiClient(env, model);
    const functionDeclarations = tools.map((t) => t.function);
    const response = await client.models.generateContent({
      model,
      config: {
        systemInstruction: systemPrompt,
        temperature: options?.temperature,
        maxOutputTokens: options?.maxTokens,
        tools: [{ functionDeclarations }] as any,
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
      contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    const toolCalls = response.functionCalls?.map((call, index) => ({
      id: `call_${index}`,
      function: {
        name: call.name || "unknown",
        arguments: JSON.stringify(call.args || {})
      }
    })) || [];

    return {
      data: JSON.parse(cleanJsonOutput(response.text || "{}")) as T,
      toolCalls,
    };
  });
}

/**
 * Lists available Gemini models and transforms them into unified model definitions.
 */
export async function getGoogleModels(env: Env, filter?: ModelFilter): Promise<UnifiedModel[]> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: await env.GEMINI_API_KEY.get() as string });
  const response = await ai.models.list();
  
  const modelsData: any[] = [];
  for await (const model of response) {
    modelsData.push(model);
  }
  
  const models: UnifiedModel[] = modelsData.map((m: any) => {
    const caps: ModelFilter[] = [];
    if (m.name.includes('flash')) caps.push('fast');
    if (m.name.includes('pro')) caps.push('high_reasoning');
    if (m.supportedGenerationMethods?.includes('generateContent')) caps.push('vision', 'function_calling');
    
    return {
      id: m.name,
      provider: 'google',
      name: m.displayName || m.name,
      description: m.description,
      capabilities: caps,
      maxTokens: m.inputTokenLimit,
      raw: m
    };
  });

  return filter ? models.filter(m => m.capabilities.includes(filter)) : models;
}