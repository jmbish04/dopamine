import { z } from "zod";

export const CreateSessionRequest = z.object({
    projectId: z.string().describe("The project identifier"),
    searchTerms: z.array(z.string()).describe("Search terms for the session"),
    options: z.object({
        maxResults: z.number().optional().describe("Maximum results to return")
    }).optional()
});
