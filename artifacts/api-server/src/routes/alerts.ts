import { Router } from "express";
import { db } from "@workspace/db";
import { alertsTable, patientsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

router.use(requireAuth);

router.get("/alerts", async (req, res) => {
  const { acknowledged, severity, limit = "50", offset = "0" } = req.query;
  const lim = Math.min(Number(limit), 200);
  const off = Number(offset);

  const conditions = [];
  if (acknowledged !== undefined) {
    conditions.push(eq(alertsTable.acknowledged, acknowledged === "true" ? "true" : "false"));
  }
  if (severity) {
    conditions.push(eq(alertsTable.severity, severity as string));
  }

  const rows = await db
    .select({ alert: alertsTable, patient: patientsTable })
    .from(alertsTable)
    .leftJoin(patientsTable, eq(alertsTable.patientId, patientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(alertsTable.createdAt))
    .limit(lim)
    .offset(off);

  res.json(rows.map(r => ({
    ...r.alert,
    acknowledged: r.alert.acknowledged === "true",
    patient: r.patient,
  })));
});

router.post("/alerts/:id/acknowledge", async (req, res) => {
  const id = Number(req.params.id);
  const clerkId = (req as any).auth?.userId ?? "system";

  const [alert] = await db
    .update(alertsTable)
    .set({ acknowledged: "true", acknowledgedBy: clerkId, acknowledgedAt: new Date() })
    .where(eq(alertsTable.id, id))
    .returning();

  if (!alert) return res.status(404).json({ error: "Not found" });
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, alert.patientId));
  res.json({ ...alert, acknowledged: alert.acknowledged === "true", patient });
});

export default router;
