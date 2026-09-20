import { z } from "zod";

const money = z.number().int().min(0).max(100_000_000);

export const categoryInput = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  active: z.boolean().default(true),
});

const variantInput = z.object({
  name: z.string().trim().min(1).max(60),
  priceMinor: money,
  available: z.boolean().default(true),
});

const extraGroupInput = z
  .object({
    name: z.string().trim().min(1).max(60),
    minSelect: z.number().int().min(0).max(10).default(0),
    maxSelect: z.number().int().min(1).max(10).default(1),
    options: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(60),
          priceMinor: money,
          available: z.boolean().default(true),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine((value) => value.minSelect <= value.maxSelect, {
    message: "The minimum selection cannot exceed the maximum.",
  })
  .refine((value) => value.maxSelect <= value.options.length, {
    message: "The maximum selection cannot exceed the number of options.",
  });

export const mealInput = z.object({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(800).default(""),
  priceMinor: money,
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1000).default(0),
  variants: z.array(variantInput).max(12).default([]),
  extraGroups: z.array(extraGroupInput).max(8).default([]),
});

export const zoneInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    feeMinor: money,
    minimumMinor: money,
    etaMin: z.number().int().min(5).max(240),
    etaMax: z.number().int().min(5).max(360),
    active: z.boolean().default(true),
  })
  .refine((value) => value.etaMin <= value.etaMax, {
    message: "The minimum ETA cannot exceed the maximum ETA.",
  });

export const orderingInput = z.object({ acceptingOrders: z.boolean() });
