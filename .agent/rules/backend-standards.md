# Rule: Backend Standards
- **Framework**: Use Hono (`OpenAPIHono` from `@hono/zod-openapi`) for all routing.
- **Validation**: Strict `zod` validation for all request inputs and response schemas.
- **Documentation**: Always expose OpenAPI v3.1.0 at `/openapi.json`, Swagger at `/swagger`, and Scalar at `/scalar`.
- **Database**: Use Drizzle ORM configured for Cloudflare D1 (SQLite). Migrations go to `./drizzle`.
- **AI Gateway**: All AI requests (OpenAI SDKs) must map the endpoint URL through `https://gateway.ai.cloudflare.com/...`
- **Output Formats**: Generate the entire file from start to finish. Do not truncate functions or use comments like `// rest of the code`.
