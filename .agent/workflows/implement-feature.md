# Workflow: Implement Backend API and Local CLI

**Goal**: Establish the Cloudflare Worker API backend using Hono and Drizzle ORM, and create a local CLI to interface with the service.

## Steps
1. **Update Dependencies**: Install `hono`, `@hono/zod-openapi`, `@scalar/hono-api-reference`, `zod`, `commander`, `chalk`, and `node-fetch`.
2. **Database Schema Setup**: Update `src/db/schema.ts` to modify the `users` table's `id` field (adding `autoIncrement: true`) and include the `tasks` table with fields for ID, title, status, duration, and createdAt.
3. **Configure Drizzle**: Ensure `drizzle.config.ts` targets `./src/db/schema.ts` and outputs to `./drizzle`. Add `migrate:db` script to `package.json`.
4. **Implement Hono API**: Overwrite `src/index.ts` to instantiate `OpenAPIHono`. Implement `/api/tasks` (GET, POST, PUT), and `/api/ai/dj` (routing to Cloudflare AI Gateway).
5. **Serve OpenAPI Specs**: Mount `/openapi.json`, `/swagger`, and `/scalar` directly in `src/index.ts`.
6. **Local CLI**: Create `local_cli/index.js` using `commander` to perform CLI actions (`tasks`, `add`, `complete`) against `http://127.0.0.1:8787/api`.
7. **Database Migration**: Run `npm run db:generate` and `npm run migrate:db` to initialize the local D1 database.
8. **Run & Test**: Run `npm run start` and test the CLI via `node local_cli/index.js tasks`.
