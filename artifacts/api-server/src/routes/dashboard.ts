import { Router } from "express";
import { db } from "@workspace/db";
import { scheduledCallsTable, callRecordsTable, alertsTable, patientsTable, proceduresTable } from "@workspace/db/schema";
import { eq, count, and, gte, lte, desc } from "drizzle-orm";
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

export default router;
