import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  schema: z.object({
    title: z.string(),
    date: z.date(),
    thumbnail: z.string(),
    rating: z.number(),
    layout: z.string().optional(),
  }),
});

const pagesCollection = defineCollection({
  type: "content",
  schema: z.object({
    hero: z.object({
      title: z.string(),
      subtitle: z.string(),
      description: z.string(),
      image: z.string(),
      primaryBtnText: z.string(),
      secondaryBtnText: z.string(),
      phoneNumber: z.string(),
    }),
    features: z.array(
      z.object({
        title: z.string(),
        content: z.string(), // This will be the body of the markdown widget
        image: z.string().optional(),
        imageAlt: z.string().optional(),
        reverse: z.boolean(),
      }),
    ),
    products: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        description: z.string(),
        price: z.string(),
        image: z.string(),
      }),
    ),
  }),
});

const settingsCollection = defineCollection({
  type: "data",
  schema: z.object({
    brand: z.object({
      title: z.string(),
      description: z.string(),
    }),
    contact: z.object({
      phone: z.string(),
      email: z.string(),
    }),
    information: z.array(
      z.object({
        text: z.string(),
      }),
    ),
    copyright: z.string(),
  }),
});

export const collections = {
  blog: blogCollection,
  pages: pagesCollection,
  settings: settingsCollection,
};
