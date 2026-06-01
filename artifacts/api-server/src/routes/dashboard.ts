import { Router } from "express";
import { db } from "@workspace/db";
import { scheduledCallsTable, callRecordsTable, alertsTable, patientsTable, proceduresTable } from "@workspace/db/schema";
import { eq, count, and, gte, lte, lt, desc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/dashboard/summary", async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const [pendingCallsToday] = await db
    .select({ count: count() })
    .from(scheduledCallsTable)
    .where(and(
      eq(scheduledCallsTable.status, "pending"),
      gte(scheduledCallsTable.scheduledAt, startOfDay),
      lte(scheduledCallsTable.scheduledAt, endOfDay),
    ));

  const [activeCallsNow] = await db
    .select({ count: count() })
    .from(scheduledCallsTable)
    .where(eq(scheduledCallsTable.status, "in_progress"));

  const [completedToday] = await db
    .select({ count: count() })
    .from(scheduledCallsTable)
    .where(and(
      eq(scheduledCallsTable.status, "completed"),
      gte(scheduledCallsTable.updatedAt, startOfDay),
      lte(scheduledCallsTable.updatedAt, endOfDay),
    ));

  const [unresolvedAlerts] = await db
    .select({ count: count() })
    .from(alertsTable)
    .where(eq(alertsTable.acknowledged, "false"));

  const [criticalAlerts] = await db
    .select({ count: count() })
    .from(alertsTable)
    .where(and(eq(alertsTable.acknowledged, "false"), eq(alertsTable.severity, "critical")));

  const [totalPatients] = await db.select({ count: count() }).from(patientsTable);

  const [proceduresThisWeek] = await db
    .select({ count: count() })
    .from(proceduresTable)
    .where(and(
      gte(proceduresTable.scheduledDate, startOfWeek),
      lte(proceduresTable.scheduledDate, endOfWeek),
    ));

  const totalToday = (pendingCallsToday.count ?? 0) + (completedToday.count ?? 0);
  const callCompletionRate = totalToday > 0 ? (completedToday.count ?? 0) / totalToday : 0;

  res.json({
    pendingCallsToday: pendingCallsToday.count ?? 0,
    activeCallsNow: activeCallsNow.count ?? 0,
    completedToday: completedToday.count ?? 0,
    unresolvedAlerts: unresolvedAlerts.count ?? 0,
    criticalAlerts: criticalAlerts.count ?? 0,
    callCompletionRate: Math.round(callCompletionRate * 100) / 100,
    totalPatients: totalPatients.count ?? 0,
    proceduresThisWeek: proceduresThisWeek.count ?? 0,
  });
});

router.get("/dashboard/calls-today", async (req, res) => {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const rows = await db
    .select({ call: scheduledCallsTable, patient: patientsTable, procedure: proceduresTable })
    .from(scheduledCallsTable)
    .leftJoin(patientsTable, eq(scheduledCallsTable.patientId, patientsTable.id))
    .leftJoin(proceduresTable, eq(scheduledCallsTable.procedureId, proceduresTable.id))
    .where(and(
      gte(scheduledCallsTable.scheduledAt, startOfDay),
      lte(scheduledCallsTable.scheduledAt, endOfDay),
    ))
    .orderBy(scheduledCallsTable.scheduledAt);

  res.json(rows.map(r => ({ ...r.call, patient: r.patient, procedure: r.procedure })));
});

router.get("/dashboard/recent-activity", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 50);

  const rows = await db
    .select({ record: callRecordsTable, patient: patientsTable })
    .from(callRecordsTable)
    .leftJoin(patientsTable, eq(callRecordsTable.patientId, patientsTable.id))
    .orderBy(desc(callRecordsTable.startedAt))
    .limit(limit);

  res.json(rows.map(r => ({ ...r.record, hasFlags: r.record.hasFlags === "true", patient: r.patient })));
});

router.get("/dashboard/calendar", async (req, res) => {
  const weekStartParam = typeof req.query.weekStart === "string" ? req.query.weekStart : undefined;
  const base = weekStartParam ? new Date(weekStartParam) : new Date();
  if (Number.isNaN(base.getTime())) {
    res.status(400).json({ error: "Invalid weekStart date" });
    return;
  }

  // Normalize to the Sunday 00:00 of the week containing `base`.
  const weekStart = new Date(base);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // The client buckets each procedure into a day column using its own local
  // timezone, then drops anything outside the 7 visible days. Because the
  // server and client timezones may differ, widen the query by a one-day buffer
  // on each side so no boundary-time procedure is ever missed before the client
  // can place it. The client remains the authority on day placement.
  const queryStart = new Date(weekStart);
  queryStart.setDate(queryStart.getDate() - 1);
  const queryEnd = new Date(weekEnd);
  queryEnd.setDate(queryEnd.getDate() + 1);

  const procRows = await db
    .select({ procedure: proceduresTable, patient: patientsTable })
    .from(proceduresTable)
    .leftJoin(patientsTable, eq(proceduresTable.patientId, patientsTable.id))
    .where(and(
      gte(proceduresTable.scheduledDate, queryStart),
      lt(proceduresTable.scheduledDate, queryEnd),
    ))
    .orderBy(proceduresTable.scheduledDate);

  const procedureIds = procRows.map(r => r.procedure.id);
  const calls = procedureIds.length
    ? await db
        .select()
        .from(scheduledCallsTable)
        .where(inArray(scheduledCallsTable.procedureId, procedureIds))
    : [];

  const callsByProcedure = new Map<number, typeof calls>();
  for (const c of calls) {
    const list = callsByProcedure.get(c.procedureId) ?? [];
    list.push(c);
    callsByProcedure.set(c.procedureId, list);
  }

  res.json(procRows.map(r => ({
    ...r.procedure,
    patient: r.patient,
    calls: (callsByProcedure.get(r.procedure.id) ?? []).map(c => ({
      id: c.id,
      callType: c.callType,
      status: c.status,
      scheduledAt: c.scheduledAt,
    })),
  })));
});

export default router;
