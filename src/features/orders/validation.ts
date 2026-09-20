import { z } from "zod";

const address = z.object({
  recipient: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+93[2-7]\d{8}$/, "Use an Afghan phone number."),
  city: z.string().trim().min(2).max(80),
  area: z.string().trim().min(2).max(100),
  address: z.string().trim().min(5).max(300),
  instructions: z.string().trim().max(300).default(""),
});

export const quoteInput = z
  .object({
    restaurantId: z.string().uuid(),
    fulfillment: z.enum(["delivery", "pickup"]),
    deliveryZoneId: z.string().uuid().optional(),
    items: z
      .array(
        z.object({
          mealId: z.string().uuid(),
          variantId: z.string().uuid().optional(),
          extraOptionIds: z.array(z.string().uuid()).max(30).default([]),
          quantity: z.number().int().min(1).max(20),
        }),
      )
      .min(1)
      .max(40),
    address: address.optional(),
    note: z.string().trim().max(500).default(""),
  })
  .superRefine((value, context) => {
    if (value.fulfillment === "delivery" && !value.deliveryZoneId)
      context.addIssue({
        code: "custom",
        path: ["deliveryZoneId"],
        message: "Choose a delivery area.",
      });
    if (value.fulfillment === "delivery" && !value.address)
      context.addIssue({
        code: "custom",
        path: ["address"],
        message: "Add a delivery address.",
      });
  });

export const createOrderInput = z.object({
  quoteId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
});

export const transitionInput = z.object({
  status: z.enum([
    "accepted",
    "preparing",
    "out_for_delivery",
    "ready_for_pickup",
    "delivered",
    "collected",
    "rejected",
  ]),
  version: z.number().int().positive(),
  note: z.string().trim().max(300).default(""),
});
