import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

export const collections = {
  journal: defineCollection({
    loader: glob({ base: "./src/content/journal", pattern: "**/*.md" }),
    schema: z.object({ title: z.string(), description: z.string().default(""), pubDate: z.coerce.date(), draft: z.boolean().default(false) }),
  }),
};
