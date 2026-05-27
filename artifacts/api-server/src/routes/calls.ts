import { Router } from "express";
import { db } from "@workspace/db";
import { scheduledCallsTable, callRecordsTable, proceduresTable, patientsTable, alertsTable } from "@workspace/db/schema";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { callScheduler } from "../lib/callScheduler";
import { vapiClient } from "../lib/vapiClient";

const router = Router();

// ── PATIENT TIMELINE ──────────────────────────────────────────────────────────
router.get("/patients/:id/timeline", async (req, res) => {
  const patientId = Number(req.params.id);
  const rows = await db
    .select({ record: callRecordsTable, patient: patientsTable })
    .from(callRecordsTable)
    .leftJoin(patientsTable, eq(callRecordsTable.patientId, patientsTable.id))
    .where(eq(callRecordsTable.patientId, patientId))
    .orderBy(desc(callRecordsTable.startedAt));
  res.json(rows.map(r => ({ ...r.record, hasFlags: r.record.hasFlags === "true", patient: r.patient })));
});

// ── SCHEDULED CALLS ───────────────────────────────────────────────────────────
router.get("/scheduled-calls", async (req, res) => {
  const { status, callType, patientId, procedureId, scheduledDateFrom, scheduledDateTo, limit = "50", offset = "0" } = req.query;
  const lim = Math.min(Number(limit), 200);
  const off = Number(offset);

  const conditions = [];
  if (status) conditions.push(eq(scheduledCallsTable.status, status as string));
  if (callType) conditions.push(eq(scheduledCallsTable.callType, callType as string));
  if (patientId) conditions.push(eq(scheduledCallsTable.patientId, Number(patientId)));
  if (procedureId) conditions.push(eq(scheduledCallsTable.procedureId, Number(procedureId)));
  if (scheduledDateFrom) conditions.push(gte(scheduledCallsTable.scheduledAt, new Date(scheduledDateFrom as string)));
  if (scheduledDateTo) conditions.push(lte(scheduledCallsTable.scheduledAt, new Date(scheduledDateTo as string)));

  const rows = await db
    .select({ call: scheduledCallsTable, patient: patientsTable, procedure: proceduresTable })
    .from(scheduledCallsTable)
    .leftJoin(patientsTable, eq(scheduledCallsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(scheduledCallsTable.procedureId, proceduresTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(scheduledCallsTable.scheduledAt))
    .limit(lim)
    .offset(off);

  res.json(rows.map(r => ({ ...r.call, patient: r.patient, procedure: r.procedure })));
});

router.get("/scheduled-calls/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({ call: scheduledCallsTable, patient: patientsTable, procedure: proceduresTable })
    .from(scheduledCallsTable)
    .leftJoin(patientsTable, eq(scheduledCallsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(scheduledCallsTable.procedureId, proceduresTable.id))
    .where(eq(scheduledCallsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ ...row.call, patient: row.patient, procedure: row.procedure });
});

router.patch("/scheduled-calls/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { status, scheduledAt } = req.body;
  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (scheduledAt) update.scheduledAt = new Date(scheduledAt);

  const [call] = await db.update(scheduledCallsTable).set(update).where(eq(scheduledCallsTable.id, id)).returning();
  if (!call) return res.status(404).json({ error: "Not found" });

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, call.patientId));
  const [procedure] = await db.select().from(proceduresTable).where(eq(proceduresTable.id, call.procedureId));
  res.json({ ...call, patient, procedure });
});

// ── TRIGGER CALL ──────────────────────────────────────────────────────────────
router.post("/scheduled-calls/:id/trigger", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({ call: scheduledCallsTable, patient: patientsTable, procedure: proceduresTable })
    .from(scheduledCallsTable)
    .leftJoin(patientsTable, eq(scheduledCallsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(scheduledCallsTable.procedureId, proceduresTable.id))
    .where(eq(scheduledCallsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });

  let vapiCallId: string | null = null;
  try {
    const vapiCall = await vapiClient.initiateCall({
      phone: row.patient?.phone ?? "",
      callType: row.call.callType,
      patient: row.patient!,
      procedure: row.procedure!,
    });
    vapiCallId = vapiCall?.id ?? null;
  } catch {
    // continue without vapi in dev/stub mode
  }

  const [updated] = await db
    .update(scheduledCallsTable)
    .set({ status: "in_progress", attemptCount: (row.call.attemptCount ?? 0) + 1, lastAttemptAt: new Date(), vapiCallId })
    .where(eq(scheduledCallsTable.id, id))
    .returning();

  res.json({ ...updated, patient: row.patient, procedure: row.procedure });
});

// ── SCHEDULE PROCEDURE CALLS ──────────────────────────────────────────────────
router.post("/procedures/:procedureId/schedule-calls", async (req, res) => {
  const procedureId = Number(req.params.procedureId);
  const [procedure] = await db.select().from(proceduresTable).where(eq(proceduresTable.id, procedureId));
  if (!procedure) return res.status(404).json({ error: "Not found" });

  const scheduledCalls = await callScheduler.scheduleForProcedure(procedure);
  res.status(201).json(scheduledCalls);
});

// ── CALL RECORDS ──────────────────────────────────────────────────────────────
router.get("/call-records", async (req, res) => {
  const { patientId, limit = "50", offset = "0" } = req.query;
  const lim = Math.min(Number(limit), 200);
  const off = Number(offset);

  const conditions = [];
  if (patientId) conditions.push(eq(callRecordsTable.patientId, Number(patientId)));

  const rows = await db
    .select({ record: callRecordsTable, patient: patientsTable })
    .from(callRecordsTable)
    .leftJoin(patientsTable, eq(callRecordsTable.patientId, patientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(callRecordsTable.startedAt))
    .limit(lim)
    .offset(off);

  res.json(rows.map(r => ({ ...r.record, hasFlags: r.record.hasFlags === "true", patient: r.patient })));
});

router.get("/call-records/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({ record: callRecordsTable, patient: patientsTable })
    .from(callRecordsTable)
    .leftJoin(patientsTable, eq(callRecordsTable.patientId, patientsTable.id))
    .where(eq(callRecordsTable.id, id));

  if (!row) return res.status(404).json({ error: "Not found" });

  const flags = await db
    .select({ alert: alertsTable, patient: patientsTable })
    .from(alertsTable)
    .leftJoin(patientsTable, eq(alertsTable.patientId, patientsTable.id))
    .where(eq(alertsTable.callRecordId, id));

  let structuredData = null;
  try {
    if (row.record.structuredData) {
      structuredData = JSON.parse(row.record.structuredData);
    }
  } catch {}

  res.json({
    ...row.record,
    hasFlags: row.record.hasFlags === "true",
    patient: row.patient,
    structuredData,
    flags: flags.map(f => ({ ...f.alert, acknowledged: f.alert.acknowledged === "true", patient: f.patient })),
  });
});

export default router;
