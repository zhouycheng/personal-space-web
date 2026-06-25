import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
  output: "server",
  devToolbar: {
    enabled: false,
  },
  adapter: node({
    mode: "standalone",
  }),
});
