import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import react from "@astrojs/react";

export default defineConfig({
  output: "server",
  integrations: [react()],
  devToolbar: {
    enabled: false,
  },
  adapter: node({
    mode: "standalone",
  }),
  vite: {
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "canvas-flow", test: /node_modules[\\/]@xyflow[\\/]/, priority: 3 },
              { name: "canvas-editor", test: /node_modules[\\/]@tiptap[\\/]/, priority: 3 },
              { name: "canvas-ui", test: /node_modules[\\/](@floating-ui|lucide-react)[\\/]/, priority: 2 },
            ],
          },
        },
      },
    },
  },
});
