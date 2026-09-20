import { z } from "zod";

export const captionInput = z.object({
  caption: z
    .string()
    .trim()
    .min(3, "Write at least 3 characters.")
    .max(1200, "Keep posts under 1,200 characters."),
  linkedMealId: z.string().uuid().nullable().optional(),
});

export const updatePostInput = captionInput.extend({
  version: z.number().int().positive(),
});

export const postActionInput = z.object({
  version: z.number().int().positive(),
  action: z.enum(["publish", "unpublish", "archive"]),
});

export const socialInput = z.object({ active: z.boolean() });

export const reportInput = z.object({
  postId: z.string().uuid(),
  reason: z.enum(["spam", "misleading", "inappropriate", "other"]),
  detail: z.string().trim().max(500).default(""),
});

export const reportDecisionInput = z
  .object({
    action: z.enum(["dismiss", "remove"]),
    note: z.string().trim().max(600),
  })
  .refine((value) => value.note.length >= 5, {
    message: "Add a short moderation note.",
  });
