import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/backend/db/schemas/index.ts",
  out: "./src/backend/db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: "local-dev",
    databaseId: "local-dev",
    token: "local-dev",
  },
});
