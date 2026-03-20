export async function getOpenaiApiKey(env: Env): Promise<string | null> {
    const raw = env.OPENAI_API_KEY as any;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw.get === 'function') {
        try {
            const secret = await raw.get();
            if (secret && typeof secret === 'object' && secret.value) return secret.value;
            return String(secret);
        } catch (e) {
            console.error(`[Secrets] Failed to fetch OPENAI_API_KEY from Store:`, e);
            return null;
        }
    }
    return String(raw);
}

export async function getGeminiApiKey(env: Env): Promise<string | null> {
    const raw = env.GEMINI_API_KEY as any;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw.get === 'function') {
        try {
            const secret = await raw.get();
            if (secret && typeof secret === 'object' && secret.value) return secret.value;
            return String(secret);
        } catch (e) {
            console.error(`[Secrets] Failed to fetch GEMINI_API_KEY from Store:`, e);
            return null;
        }
    }
    return String(raw);
}

export async function getAnthropicApiKey(env: Env): Promise<string | null> {
    const raw = env.ANTHROPIC_API_KEY as any;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw.get === 'function') {
        try {
            const secret = await raw.get();
            if (secret && typeof secret === 'object' && secret.value) return secret.value;
            return String(secret);
        } catch (e) {
            console.error(`[Secrets] Failed to fetch ANTHROPIC_API_KEY from Store:`, e);
            return null;
        }
    }
    return String(raw);
}

export async function getSecret(env: Env, name: keyof Env): Promise<string | null> {
    const raw = env[name] as any;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw.get === 'function') {
        try {
            const secret = await raw.get();
            if (secret && typeof secret === 'object' && secret.value) return secret.value;
            return String(secret);
        } catch (e) {
            console.error(`[Secrets] Failed to fetch secret '${String(name)}' from Store:`, e);
            return null;
        }
    }
    return String(raw);
}

export async function getCloudflareApiToken(env: Env): Promise<string | null> {
    return getSecret(env, "CLOUDFLARE_API_TOKEN");
}

export async function getCloudflareAccountId(env: Env): Promise<string | null> {
    return getSecret(env, "CLOUDFLARE_ACCOUNT_ID");
}

export async function getWorkerApiKey(env: Env): Promise<string | null> {
    return getSecret(env, "WORKER_API_KEY");
}

export async function getAiGatewayToken(env: Env): Promise<string | null> {
    return getSecret(env, "AI_GATEWAY_TOKEN");
}
