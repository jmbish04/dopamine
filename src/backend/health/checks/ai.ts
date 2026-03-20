import type { CodeHealthCheck } from "../registry";

/**
 * AI provider health checks.
 * Tests Workers AI inference, API key presence, and binding availability.
 */
export const AI_CHECKS: CodeHealthCheck[] = [
  {
    id: "workers_ai_binding",
    name: "Workers AI Binding",
    group: "AI Providers",
    check: async (env: Env) => {
      if (!env.AI) return { ok: false, message: "AI binding missing." };
      return { ok: true, message: "AI binding present." };
    },
  },
  {
    id: "workers_ai_inference",
    name: "Workers AI Text Inference",
    group: "AI Providers",
    check: async (env: Env) => {
      try {
        if (!env.AI) return { ok: false, message: "AI binding missing." };
        const resp = await (env.AI as any).run("@cf/meta/llama-3-8b-instruct", {
          messages: [{ role: "user", content: "Reply with the word HEALTHY and nothing else." }],
          max_tokens: 8,
        });
        const text: string = resp?.response ?? "";
        if (!text) return { ok: false, message: "Empty inference response." };
        return { ok: true, message: `Workers AI responded: "${text.trim().slice(0, 40)}"` };
      } catch (e: any) {
        return { ok: false, message: `Inference failed: ${e.message}` };
      }
    },
  },
  {
    id: "openai_secret_present",
    name: "OpenAI API Key Secret",
    group: "AI Providers",
    check: async (env: Env) => {
      const key = (env as any).OPENAI_API_KEY;
      if (!key) return { ok: false, message: "OPENAI_API_KEY secret not bound." };
      return { ok: true, message: "OPENAI_API_KEY present." };
    },
  },
  {
    id: "gemini_secret_present",
    name: "Gemini API Key Secret",
    group: "AI Providers",
    check: async (env: Env) => {
      const key = (env as any).GEMINI_API_KEY;
      if (!key) return { ok: false, message: "GEMINI_API_KEY secret not bound." };
      return { ok: true, message: "GEMINI_API_KEY present." };
    },
  },
  {
    id: "anthropic_secret_present",
    name: "Anthropic API Key Secret",
    group: "AI Providers",
    check: async (env: Env) => {
      const key = (env as any).ANTHROPIC_API_KEY;
      if (!key) return { ok: false, message: "ANTHROPIC_API_KEY secret not bound." };
      return { ok: true, message: "ANTHROPIC_API_KEY present." };
    },
  },
];
