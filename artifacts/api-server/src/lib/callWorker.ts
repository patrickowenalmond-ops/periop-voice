import { db } from "@workspace/db";
import { scheduledCallsTable, patientsTable, proceduresTable } from "@workspace/db/schema";
import { eq, and, lte, lt } from "drizzle-orm";
import { vapiClient } from "./vapiClient";
import { logger } from "./logger";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_HOURS = 2;
const POLL_INTERVAL_MS = 60_000;

async function processDueCalls(): Promise<void> {
  const now = new Date();
  const retryBefore = new Date(now.getTime() - RETRY_DELAY_HOURS * 3_600_000);

  const rows = await db
    .select({ call: scheduledCallsTable, patient: patientsTable, procedure: proceduresTable })
    .from(scheduledCallsTable)
    .leftJoin(patientsTable, eq(scheduledCallsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(scheduledCallsTable.procedureId, proceduresTable.id))
    .where(
      and(
        eq(scheduledCallsTable.status, "pending"),
        lte(scheduledCallsTable.scheduledAt, now),
        lt(scheduledCallsTable.attemptCount, MAX_ATTEMPTS),
      ),
    )
    .limit(20);

  for (const row of rows) {
    const { call, patient, procedure } = row;

    if (!patient?.phone) {
      logger.warn({ callId: call.id }, "Skipping due call — patient has no phone number");
      continue;
    }

    const lastAttempt = call.lastAttemptAt ? new Date(call.lastAttemptAt) : null;
    if (lastAttempt && lastAttempt > retryBefore) {
      continue;
    }

    const newAttemptCount = (call.attemptCount ?? 0) + 1;

    try {
      const vapiCall = await vapiClient.initiateCall({
        phone: patient.phone,
        callType: call.callType,
        patient,
        procedure: procedure!,
      });

      await db
        .update(scheduledCallsTable)
        .set({
          status: "in_progress",
          attemptCount: newAttemptCount,
          lastAttemptAt: now,
          vapiCallId: vapiCall?.id ?? null,
        })
        .where(eq(scheduledCallsTable.id, call.id));

      logger.info({ callId: call.id, vapiCallId: vapiCall?.id, attempt: newAttemptCount }, "Call initiated by worker");
    } catch (err) {
      const isFinalAttempt = newAttemptCount >= MAX_ATTEMPTS;

      await db
        .update(scheduledCallsTable)
        .set({
          status: isFinalAttempt ? "failed" : "pending",
          attemptCount: newAttemptCount,
          lastAttemptAt: now,
        })
        .where(eq(scheduledCallsTable.id, call.id));

      logger.error(
        { callId: call.id, attempt: newAttemptCount, maxAttempts: MAX_ATTEMPTS, err },
        isFinalAttempt ? "Call failed after max attempts" : "Call attempt failed, will retry",
      );
    }
  }
}

let workerTimer: ReturnType<typeof setInterval> | null = null;

export function startCallWorker(): void {
  if (workerTimer) return;

  logger.info("Call scheduling worker started");

  workerTimer = setInterval(async () => {
    try {
      await processDueCalls();
    } catch (err) {
      logger.error({ err }, "Call worker poll cycle error");
    }
  }, POLL_INTERVAL_MS);

  processDueCalls().catch((err) =>
    logger.error({ err }, "Call worker initial poll error"),
  );
}

export function stopCallWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    logger.info("Call scheduling worker stopped");
  }
}
