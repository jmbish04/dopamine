import { HealthStepResult } from "@/health/types";
import { fetchCloudflareDocsIndex } from "@/backend/ai/mcp/tools/browser/docs-fetcher";
import { createMCPRequest } from "@/backend/ai/mcp/mcp-client"; // Import the helper

/**
 * Checks the health of the MCP domain by validating:
 * 1. Cloudflare Docs Fetching (External Connectivity)
 * 2. MCP Protocol Compliance (Internal/Upstream Connectivity)
 */
export async function checkHealth(env: Env): Promise<HealthStepResult> {
    const start = Date.now();
    const subChecks: Record<string, any> = {};

    try {
        // --- 1. Test Docs Fetcher (External) ---
        const docsStart = Date.now();
        const sections = await fetchCloudflareDocsIndex();

        if (!Array.isArray(sections) || sections.length === 0) {
            throw new Error("MCP: fetchCloudflareDocsIndex returned empty/invalid list");
        }
        subChecks.docsFetcher = { status: "OK", latency: Date.now() - docsStart, count: sections.length };

        // --- 2. Test MCP Protocol (Internal/Upstream) ---
        const mcpStart = Date.now();
        if (!env.WORKER_NAME) {
            subChecks.mcpProtocol = { status: "SKIPPED", reason: "WORKER_NAME missing" };
        } else {
            // Actual JSON-RPC Handshake: Ask for capabilities
            const rpcRequest = createMCPRequest("tools/list", {});
            const workerName = env.WORKER_NAME || `dopamine`;
            const mcpUrl = `https://${workerName}.hacolby.workers.dev`;
            const response = await fetch(mcpUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "text/event-stream, application/json"
                },
                body: JSON.stringify(rpcRequest)
            });

            if (!response.ok) {
                throw new Error(`MCP Server returned HTTP ${response.status}`);
            }

            const contentType = response.headers.get("Content-Type") || "";
            let data: any = {};

            if (contentType.includes("text/event-stream")) {
                // SSE Stream - we can't easily parse JSON-RPC response from raw stream here
                // But connectivity is established.
                subChecks.mcpConnectivity = {
                    status: "OK",
                    latency: Date.now() - mcpStart,
                    protocol: "sse",
                    message: "Connection established (SSE)"
                };

                // Skip functional search for SSE endpoints for now as it needs a client
                subChecks.mcpFunctional = {
                    status: "SKIPPED",
                    reason: "SSE endpoint requires full client"
                };

                return {
                    name: "MCP Domain",
                    status: "success",
                    message: "MCP Services Operational (SSE)",
                    durationMs: Date.now() - start,
                    details: subChecks
                };
            } else {
                // Standard JSON-RPC
                data = await response.json();

                // Validate Protocol Compliance
                if (data.error) {
                    throw new Error(`MCP Error: ${data.error.message}`);
                }
                if (!data.result || !data.result.tools) {
                    throw new Error("MCP Response invalid: missing 'result.tools'");
                }

                // Verify the specific tool we need exists
                const hasSearchTool = data.result.tools.some((t: any) => t.name === 'search_cloudflare_documentation');

                if (!hasSearchTool) {
                    throw new Error("MCP Tool 'search_cloudflare_documentation' missing");
                }

                subChecks.mcpConnectivity = {
                    status: "OK",
                    latency: Date.now() - mcpStart,
                    protocol: "v2",
                    toolFound: hasSearchTool,
                    toolsCount: data.result.tools.length
                };

                // --- 3. Test Functional Search (tools/call) ---
                const workerName = env.WORKER_NAME || `dopamine`;
                const mcpUrl = `https://${workerName}.hacolby.workers.dev`;
                const searchStart = Date.now();
                const searchResult = await import("./mcp-client").then(m => m.queryMCP("Workers", undefined, mcpUrl));

                if (!searchResult || (Array.isArray(searchResult) && searchResult.length === 0)) {
                    throw new Error("MCP Functional Search returned empty result");
                }

                subChecks.mcpFunctional = {
                    status: "OK",
                    latency: Date.now() - searchStart,
                    query: "Workers",
                    resultLength: Array.isArray(searchResult) ? searchResult.length : String(searchResult).length
                };
            }
        }

        return {
            name: "MCP Domain",
            status: "success",
            message: "MCP Services Operational",
            durationMs: Date.now() - start,
            details: subChecks
        };

    } catch (error) {
        return {
            name: "MCP Domain",
            status: "failure",
            message: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - start,
            details: subChecks
        };
    }
}