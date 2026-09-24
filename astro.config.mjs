import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";
import journalIntegration from "./scripts/journal-integration.mjs";

export default defineConfig({
  output: "server",
  integrations: [react(), journalIntegration()],
  devToolbar: {
    enabled: false,
  },
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    optimizeDeps: {
      include: [
        "@xyflow/react",
      ],
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "canvas-flow", test: /node_modules[\\/]@xyflow[\\/]/, priority: 3 },
            ],
          },
        },
      },
    },
  },
});
