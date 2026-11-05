import { z } from "zod";

export const ballotInput = z.object({
  electionId: z.string().uuid(),
  selections: z.array(z.object({ positionId: z.string().uuid(), candidateId: z.string().uuid() })).min(1).max(50),
});
