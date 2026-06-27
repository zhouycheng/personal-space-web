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
});
