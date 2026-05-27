import { db } from "@workspace/db";
import { scheduledCallsTable, patientsTable, proceduresTable } from "@workspace/db/schema";
import { eq, and, lte, lt, or, notExists } from "drizzle-orm";
import { vapiClient } from "./vapiClient";
import { callScheduler } from "./callScheduler";
import { logger } from "./logger";

const MAX_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 60_000;

/**
 * How long to wait before retrying a call, keyed by the call's current status.
 * Adjust these values to change retry cadence without touching any other logic.
 */
const RETRY_DELAY_HOURS: Record<string, number> = {
  no_answer: 2,
  failed: 4,
};

/**
 * Find procedures that have no scheduled calls yet and auto-schedule them.
 */
async function autoScheduleNewProcedures(): Promise<void> {
  const unscheduledProcedures = await db
    .select()
    .from(proceduresTable)
    .where(
      notExists(
        db
          .select({ id: scheduledCallsTable.id })
          .from(scheduledCallsTable)
          .where(eq(scheduledCallsTable.procedureId, proceduresTable.id)),
      ),
    )
    .limit(50);

  if (unscheduledProcedures.length === 0) return;

  logger.info({ count: unscheduledProcedures.length }, "Auto-scheduling calls for unscheduled procedures");

  for (const procedure of unscheduledProcedures) {
    try {
      const scheduled = await callScheduler.scheduleForProcedure(procedure);
      logger.info({ procedureId: procedure.id, callCount: scheduled.length }, "Auto-scheduled calls for procedure");
    } catch (err) {
      logger.error({ err, procedureId: procedure.id }, "Failed to auto-schedule calls for procedure");
    }
  }
}

/**
 * Process all calls that are due for initiation or retry.
 * Eligible statuses: "pending" (never tried or explicitly re-queued)
 *                    "no_answer" and "failed" (retriable, within attempt cap)
 */
async function processDueCalls(): Promise<void> {
  const now = new Date();

  const rows = await db
    .select({ call: scheduledCallsTable, patient: patientsTable, procedure: proceduresTable })
    .from(scheduledCallsTable)
    .leftJoin(patientsTable, eq(scheduledCallsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(scheduledCallsTable.procedureId, proceduresTable.id))
    .where(
      and(
        or(
          eq(scheduledCallsTable.status, "pending"),
          eq(scheduledCallsTable.status, "no_answer"),
          eq(scheduledCallsTable.status, "failed"),
        ),
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

    // Enforce per-status retry backoff for non-pending calls
    if (call.status !== "pending") {
      const delayHours = RETRY_DELAY_HOURS[call.status] ?? 2;
      const retryBefore = new Date(now.getTime() - delayHours * 3_600_000);
      const lastAttempt = call.lastAttemptAt ? new Date(call.lastAttemptAt) : null;
      if (lastAttempt && lastAttempt > retryBefore) {
        continue;
      }
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
          status: isFinalAttempt ? "failed" : call.status,
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

async function runWorkerCycle(): Promise<void> {
  await autoScheduleNewProcedures();
  await processDueCalls();
}

let workerTimer: ReturnType<typeof setInterval> | null = null;

export function startCallWorker(): void {
  if (workerTimer) return;

  logger.info("Call scheduling worker started");

  workerTimer = setInterval(async () => {
    try {
      await runWorkerCycle();
    } catch (err) {
      logger.error({ err }, "Call worker poll cycle error");
    }
  }, POLL_INTERVAL_MS);

  runWorkerCycle().catch((err) =>
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
