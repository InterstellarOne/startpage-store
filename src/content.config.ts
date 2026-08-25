import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const startpages = defineCollection({
	// Load json files in the `src/content/startpages/` directory.
	loader: glob({ base: './src/content/startpages', pattern: '**/*.json' }),
	// Type-check frontmatter using a schema
	schema: ({ }) =>
		z.object({
			title: z.string(),
			description: z.string(),
            firefoxLink: z.url().optional(),
            chromeLink: z.url().optional(),
            gitLink: z.url().optional(),
            websiteLink: z.url().optional(),
			safariLink: z.url().optional(),
			dateUpdated: z.number(),
            image: z.object({src: z.url()}),
            tags: z.array(z.string()),
            dateAdded: z.number(),
            proprietary: z.boolean().optional(),
		}),
});

const tags = defineCollection({
	loader: glob({ base: './src/content/startpages', pattern: '**/*.json' }),
	// Type-check frontmatter using a schema
	schema: ({ }) =>
		z.object({
            tags: z.array(z.string()),
		}),
});

export const collections = { startpages, tags };