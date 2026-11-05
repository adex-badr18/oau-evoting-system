import { z } from "zod";

export const createElectionInput = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2_000).optional(),
  category: z.string().trim().min(2).max(100),
  scope: z.string().trim().min(2).max(200),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
}).superRefine((value, context) => {
  if (value.endsAt <= value.startsAt) context.addIssue({ code: "custom", path: ["endsAt"], message: "End time must be later than start time." });
});

export const positionInput = z.object({
  title: z.string().trim().min(2).max(150),
  displayOrder: z.number().int().min(0),
  isMandatory: z.boolean().default(true),
});

export const candidateInput = z.object({
  positionId: z.string().uuid(),
  fullName: z.string().trim().min(2).max(150),
  department: z.string().trim().max(150).optional(),
  manifestoUrl: z.string().url().optional(),
  photoUrl: z.string().url().optional(),
  displayOrder: z.number().int().min(0),
});
