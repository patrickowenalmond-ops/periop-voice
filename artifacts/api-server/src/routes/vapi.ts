import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { scheduledCallsTable, callRecordsTable, alertsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { transcriptAnalyzer } from "../lib/transcriptAnalyzer";
import { logger } from "../lib/logger";

const router = Router();

function verifyWebhookSecret(req: Request): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true;

  const incoming = req.headers["x-vapi-secret"];
  if (!incoming) {
    logger.warn("Vapi webhook: missing x-vapi-secret header");
    return false;
  }

  return incoming === secret;
}

router.post("/vapi/webhook", async (req, res): Promise<void> => {
  if (!verifyWebhookSecret(req)) {
    res.status(401).json({ error: "Invalid webhook secret" });
    return;
  }

  const event = req.body;
  const { type, call, artifact } = event;

  try {
    if (!call?.id) {
      res.json({ status: "ok" });
      return;
    }

    const vapiCallId = call.id as string;

    const [scheduledCall] = await db
      .select()
      .from(scheduledCallsTable)
      .where(eq(scheduledCallsTable.vapiCallId, vapiCallId));

    if (type === "call-ended" || type === "end-of-call-report") {
      // If no matching scheduled call, log and bail — cannot safely insert FK refs
      if (!scheduledCall) {
        logger.warn({ vapiCallId, type }, "Vapi webhook: no matching scheduled call found, skipping record insertion");
        res.json({ status: "ok" });
        return;
      }

      const transcript = artifact?.transcript ?? null;
      const summary = artifact?.summary ?? null;
      const durationSeconds = call.endedAt && call.startedAt
        ? Math.round((new Date(call.endedAt).getTime() - new Date(call.startedAt).getTime()) / 1000)
        : null;

      await db
        .update(scheduledCallsTable)
        .set({ status: "completed", lastAttemptAt: new Date() })
        .where(eq(scheduledCallsTable.id, scheduledCall.id));

      const [record] = await db
        .insert(callRecordsTable)
        .values({
          scheduledCallId: scheduledCall.id,
          patientId: scheduledCall.patientId,
          callType: scheduledCall.callType,
          outcome: "completed",
          durationSeconds,
          startedAt: call.startedAt ? new Date(call.startedAt) : new Date(),
          endedAt: call.endedAt ? new Date(call.endedAt) : new Date(),
          transcript,
          aiSummary: summary,
          hasFlags: "false",
        })
        .returning();

      if (transcript && record) {
        try {
          const analysis = await transcriptAnalyzer.analyze(transcript, scheduledCall.callType);
          if (analysis.flags.length > 0) {
            await db
              .update(callRecordsTable)
              .set({ hasFlags: "true", structuredData: JSON.stringify(analysis.structuredData) })
              .where(eq(callRecordsTable.id, record.id));

            for (const flag of analysis.flags) {
              await db.insert(alertsTable).values({
                callRecordId: record.id,
                patientId: record.patientId,
                severity: flag.severity as "low" | "medium" | "high" | "critical",
                category: flag.category,
                description: flag.description,
                recommendedAction: flag.recommendedAction,
                acknowledged: "false",
              });
            }

            logger.info({ callRecordId: record.id, flagCount: analysis.flags.length }, "Clinical flags generated from transcript");
          }
        } catch (err) {
          logger.error({ err, callRecordId: record.id }, "Transcript analysis failed");
        }
      }
    } else if (type === "call-failed" || type === "no-answer") {
      if (!scheduledCall) {
        logger.warn({ vapiCallId, type }, "Vapi webhook: no matching scheduled call found for failure event");
        res.json({ status: "ok" });
        return;
      }

      const newStatus = type === "no-answer" ? "no_answer" : "failed";
      const newAttemptCount = scheduledCall.attemptCount + 1;
      const isFinalAttempt = newAttemptCount >= 3;

      await db
        .update(scheduledCallsTable)
        .set({
          // If max attempts reached → permanent failure; otherwise keep retriable status
          status: isFinalAttempt ? "failed" : newStatus,
          attemptCount: newAttemptCount,
          lastAttemptAt: new Date(),
        })
        .where(eq(scheduledCallsTable.id, scheduledCall.id));

      logger.info({ callId: scheduledCall.id, newStatus, isFinalAttempt }, "Vapi call outcome recorded");
    }
  } catch (err) {
    logger.error({ err }, "Vapi webhook processing error");
  }

  res.json({ status: "ok" });
});

export default router;
