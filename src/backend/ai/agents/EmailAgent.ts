import PostalMime from "postal-mime";
import { createAgent } from "honidev";
import { generateStructuredResponse } from "@/ai/providers/index";
import { createTask, type CreateTaskInput } from "@/api/tasks";
import { BrowserService } from "@/ai/agents/tools/browser/browserRenderApi";

// Define a schema for task extraction
const emailExtractionSchema = {
    type: "object",
    properties: {
        title: { type: "string", description: "A concise summary or actionable title for the extracted task." },
        notes: { type: "string", description: "Detailed notes, body content, and formatting derived from the email." },
        layer: { type: "number", description: "The layer depth of the task. Routine tasks default to 1, bigger goals are higher." },
        xp: { type: "number", description: "Experience points to assign the task upon completion." }
    },
    required: ["title", "notes"]
};

export const { DurableObject: HoniAgent, fetch: emailHandler } = createAgent({
    name: "EmailAgent",
    model: "@cf/meta/llama-3.1-8b-instruct",
    system: "You are an AI task extractor. Read emails and extract well-defined dopamine tasks.",
    binding: "EMAIL_AGENT",
    memory: {
      enabled: true,
      episodic: {
        enabled: true,
        binding: "DB",
        limit: 50,
      },
      semantic: {
        enabled: true,
        binding: "VECTORIZE_LOGS",
        aiBinding: "AI",
        topK: 5,
      },
    },
});

export class EmailAgent extends HoniAgent {
    /**
     * Required by agents SDK for processing email hooks routed via Cloudflare Email Routing.
     * @param email The incoming email stream payload.
     */
    async onEmail(email: any) {
        try {
            console.log("[EmailAgent] Incoming email received.");

            // 1. Extract raw stream
            const raw = await email.getRaw();
            
            // 2. Parse using postal-mime (compatible on edge)
            const parsed = await PostalMime.parse(raw);

            console.log(`[EmailAgent] Email Parsed Successfully: Subject=${parsed.subject}`);

            let taskExtraction: CreateTaskInput;

            if (parsed.html) {
                console.log("[EmailAgent] Using Browser Rendering API to parse HTML email");
                const browserService = new BrowserService(this.env as unknown as Env);
                
                const promptContext = `
Email Subject: ${parsed.subject || '(No Subject)'}
Sender: ${parsed.from?.address || 'Unknown'}
Date: ${parsed.date || 'Unknown'}

You are an AI task extractor. Read the provided email HTML rendering and extract a well-defined dopamine task. Set an appropriate layer and XP (default 1 layer, 25 XP).
                `;

                const result = await browserService.getJson({
                    html: parsed.html,
                    prompt: promptContext,
                    response_format: {
                        type: 'json_schema',
                        schema: emailExtractionSchema
                    }
                });

                taskExtraction = result as CreateTaskInput;
            } else {
                console.log("[EmailAgent] Using standard structured response for text email");
                // 3. Construct Context
                const promptContext = `
Email Subject: ${parsed.subject || '(No Subject)'}
Sender: ${parsed.from?.address || 'Unknown'}
Date: ${parsed.date || 'Unknown'}

Email Body (Text):
${parsed.text || '(No text content)'}
                `;

                // 4. Send inference request to Workers AI or fallback model
                taskExtraction = await generateStructuredResponse<CreateTaskInput>(
                    this.env as unknown as Env,
                    promptContext,
                    emailExtractionSchema,
                    "You are an AI task extractor. Read the provided email and extract a well-defined dopamine task. Set an appropriate layer and XP (default 1 layer, 25 XP)."
                );
            }

            console.log(`[EmailAgent] Extracted task from email: ${taskExtraction.title}`);

            // 5. Build and insert task into database
            await createTask(this.env as unknown as Env, taskExtraction);

            console.log("[EmailAgent] Successfully persisted task from email.");
        } catch (error: any) {
            console.error("[EmailAgent] Failed to process incoming email", error);
            throw error;
        }
    }
}

export default emailHandler;
