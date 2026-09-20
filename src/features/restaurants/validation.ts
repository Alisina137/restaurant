import { z } from "zod";
const day = z.object({
  day: z.number().int().min(0).max(6),
  closed: z.boolean(),
  opens: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  closes: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});
export const profileInput = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Restaurant name needs at least 2 characters.")
    .max(90),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(70)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens for the page address.",
    ),
  description: z
    .string()
    .trim()
    .min(20, "Add a description of at least 20 characters.")
    .max(1200),
  city: z.enum(["Kabul", "Herat", "Mazar-i-Sharif", "Kandahar", "Jalalabad"]),
  area: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(300),
  phone: z
    .string()
    .trim()
    .regex(
      /^\+93[2-7]\d{8}$/,
      "Use an Afghan phone number such as +93700123456.",
    ),
  cuisine: z.enum(["Afghan", "Pizza", "Burgers", "Cafe", "Asian", "Other"]),
  deliveryAvailable: z.boolean().default(false),
  pickupAvailable: z.boolean().default(false),
  hours: z
    .array(day)
    .length(7)
    .refine(
      (v) => new Set(v.map((d) => d.day)).size === 7,
      "Each day must appear once.",
    ),
});
export const updateInput = profileInput.extend({
  version: z.number().int().positive(),
});
export const reviewInput = z
  .object({
    version: z.number().int().positive(),
    decision: z.enum(["approved", "changes_requested", "suspended"]),
    note: z.string().trim().max(600),
  })
  .refine(
    (v) => v.decision === "approved" || v.note.length >= 5,
    "Explain why changes or suspension are needed.",
  );
