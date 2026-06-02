import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { scheduledCallsTable, callRecordsTable, alertsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { transcriptAnalyzer } from "../lib/transcriptAnalyzer";
import { logger } from "../lib/logger";
import { publicUrlFor } from "../lib/publicUrl";
import { requireAuth, requireAdmin } from "../middlewares/auth";

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

  logger.info({ type, vapiCallId: call?.id }, "Vapi webhook received");

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

          const hasFlags = analysis.flags.length > 0;
          await db
            .update(callRecordsTable)
            .set({
              hasFlags: hasFlags ? "true" : "false",
              structuredData: Object.keys(analysis.structuredData).length > 0
                ? JSON.stringify(analysis.structuredData)
                : null,
            })
            .where(eq(callRecordsTable.id, record.id));

          if (hasFlags) {
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
          } else {
            logger.info({ callRecordId: record.id }, "Transcript analyzed — no clinical flags");
          }
        } catch (err) {
          logger.error({ err, callRecordId: record.id }, "Transcript analysis failed");
        }
      }

      logger.info({ callRecordId: record?.id, scheduledCallId: scheduledCall.id }, "Vapi call-ended processed successfully");
    } else if (type === "call-failed" || type === "no-answer") {
      if (!scheduledCall) {
        logger.warn({ vapiCallId, type }, "Vapi webhook: no matching scheduled call found for failure event");
        res.json({ status: "ok" });
        return;
      }

      const MAX_ATTEMPTS = 3;
      const newStatus = type === "no-answer" ? "no_answer" : "failed";
      const isFinalAttempt = scheduledCall.attemptCount >= MAX_ATTEMPTS;

      await db
        .update(scheduledCallsTable)
        .set({
          status: isFinalAttempt ? "failed" : newStatus,
          lastAttemptAt: new Date(),
        })
        .where(eq(scheduledCallsTable.id, scheduledCall.id));

      logger.info({ callId: scheduledCall.id, newStatus, isFinalAttempt, attempts: scheduledCall.attemptCount }, "Vapi call outcome recorded");
    } else {
      logger.debug({ type, vapiCallId }, "Vapi webhook: unhandled event type");
    }
  } catch (err) {
    logger.error({ err }, "Vapi webhook processing error");
  }

  res.json({ status: "ok" });
});

router.get("/vapi/config", requireAuth, (_req, res): void => {
  const webhookUrl = publicUrlFor("/api/vapi/webhook");

  res.json({
    webhookUrl,
    isLive: !!(
      process.env.VAPI_API_KEY &&
      process.env.VAPI_PHONE_NUMBER_ID &&
      process.env.VAPI_ASSISTANT_ID
    ),
    webhookSecretConfigured: !!process.env.VAPI_WEBHOOK_SECRET,
  });
});

router.post("/vapi/test-webhook", requireAdmin, async (req, res): Promise<void> => {
  const { vapiCallId, eventType = "end-of-call-report", transcript } = req.body as {
    vapiCallId: string;
    eventType?: string;
    transcript?: string;
  };

  if (!vapiCallId) {
    res.status(400).json({ error: "vapiCallId is required" });
    return;
  }

  const fakeEvent = {
    type: eventType,
    call: {
      id: vapiCallId,
      startedAt: new Date(Date.now() - 120_000).toISOString(),
      endedAt: new Date().toISOString(),
    },
    artifact: {
      transcript: transcript ?? "Patient: Hello. Agent: Hello, this is a test call. Patient: I understand, thank you. Agent: Great, goodbye.",
      summary: "Test webhook simulation",
    },
  };

  const fakeReq = {
    ...req,
    body: fakeEvent,
    headers: {
      ...req.headers,
      ...(process.env.VAPI_WEBHOOK_SECRET
        ? { "x-vapi-secret": process.env.VAPI_WEBHOOK_SECRET }
        : {}),
    },
  } as Request;

  logger.info({ vapiCallId, eventType }, "Simulating Vapi webhook event");

  const { type, call, artifact } = fakeEvent;

  try {
    const [scheduledCall] = await db
      .select()
      .from(scheduledCallsTable)
      .where(eq(scheduledCallsTable.vapiCallId, vapiCallId));

    if (!scheduledCall) {
      res.status(404).json({ error: `No scheduled call found with vapiCallId: ${vapiCallId}` });
      return;
    }

    if (type === "end-of-call-report" || type === "call-ended") {
      const transcriptText = artifact?.transcript ?? null;
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
          startedAt: new Date(call.startedAt),
          endedAt: new Date(call.endedAt),
          transcript: transcriptText,
          aiSummary: summary,
          hasFlags: "false",
        })
        .returning();

      let analysisResult = null;
      if (transcriptText && record) {
        try {
          const analysis = await transcriptAnalyzer.analyze(transcriptText, scheduledCall.callType);
          const hasFlags = analysis.flags.length > 0;
          await db
            .update(callRecordsTable)
            .set({
              hasFlags: hasFlags ? "true" : "false",
              structuredData: Object.keys(analysis.structuredData).length > 0
                ? JSON.stringify(analysis.structuredData)
                : null,
            })
            .where(eq(callRecordsTable.id, record.id));

          if (hasFlags) {
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
          }
          analysisResult = analysis;
        } catch (err) {
          logger.error({ err }, "Test webhook: transcript analysis failed");
        }
      }

      res.json({
        status: "ok",
        message: "Test webhook processed successfully",
        scheduledCallId: scheduledCall.id,
        callRecordId: record?.id,
        flagsGenerated: analysisResult?.flags.length ?? 0,
      });
    } else if (type === "call-failed" || type === "no-answer") {
      const MAX_ATTEMPTS = 3;
      const newStatus = type === "no-answer" ? "no_answer" : "failed";
      const isFinalAttempt = scheduledCall.attemptCount >= MAX_ATTEMPTS;
      await db
        .update(scheduledCallsTable)
        .set({ status: isFinalAttempt ? "failed" : newStatus, lastAttemptAt: new Date() })
        .where(eq(scheduledCallsTable.id, scheduledCall.id));

      res.json({ status: "ok", message: `Call marked as ${newStatus}`, scheduledCallId: scheduledCall.id });
    } else {
      res.status(400).json({ error: `Unsupported eventType: ${type}` });
    }
  } catch (err) {
    logger.error({ err }, "Test webhook simulation error");
    res.status(500).json({ error: "Internal error during test webhook simulation" });
  }

  void fakeReq;
});

export default router;
