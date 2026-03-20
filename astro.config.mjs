// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import cloudflare from "@astrojs/cloudflare";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  srcDir: "./src/frontend",
  outDir: "./dist/client",
  output: "server",
  adapter: cloudflare({
    imageService: "cloudflare",
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [
      tailwindcss(),
      tsconfigPaths({
        projects: ["./tsconfig.json"],
        ignoreConfigErrors: true,
      }),
    ],
  },
});
