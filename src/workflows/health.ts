export async function checkGitHubAPIHealth(env: Env): Promise<any> {
    return { status: "OK", component: "github_api_stub" };
}

export async function checkWebhooksHealth(env: Env): Promise<any> {
    return { status: "OK", component: "webhooks_stub" };
}
