import { db } from "@workspace/db";
import { scheduledCallsTable } from "@workspace/db/schema";
import type { Procedure } from "@workspace/db/schema";

const CALL_OFFSETS: { callType: string; offsetHours: number }[] = [
  { callType: "pre_op_history", offsetHours: -72 },
  { callType: "pre_op_instructions", offsetHours: -24 },
  { callType: "post_op_24h", offsetHours: 24 },
  { callType: "post_op_72h", offsetHours: 72 },
  { callType: "post_op_2wk", offsetHours: 336 },
];

class CallScheduler {
  async scheduleForProcedure(procedure: Procedure) {
    const procedureDate = new Date(procedure.scheduledDate);
    const results = [];

    for (const { callType, offsetHours } of CALL_OFFSETS) {
      const scheduledAt = new Date(procedureDate.getTime() + offsetHours * 60 * 60 * 1000);
      const [scheduled] = await db
        .insert(scheduledCallsTable)
        .values({
          procedureId: procedure.id,
          patientId: procedure.patientId,
          callType: callType as "pre_op_history" | "pre_op_instructions" | "post_op_24h" | "post_op_72h" | "post_op_2wk",
          status: "pending",
          scheduledAt,
          attemptCount: 0,
        })
        .onConflictDoNothing()
        .returning();

      if (scheduled) results.push(scheduled);
    }

    return results;
  }
}

export const callScheduler = new CallScheduler();
