import { z } from "zod";

export const toggleInput = z.object({ active: z.boolean() });

export const addressInput = z.object({
  label: z.string().trim().min(2).max(40),
  recipient: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+93[2-7]\d{8}$/, "Use an Afghan phone number."),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(300),
  instructions: z.string().trim().max(300).default(""),
  isDefault: z.boolean().default(false),
  version: z.number().int().positive().optional(),
});
