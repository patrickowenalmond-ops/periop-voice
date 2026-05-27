import { Router } from "express";
import { db } from "@workspace/db";
import { proceduresTable, patientsTable } from "@workspace/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

const router = Router();

router.get("/procedures", async (req, res) => {
  const { patientId, dateFrom, dateTo, limit = "50", offset = "0" } = req.query;
  const lim = Math.min(Number(limit), 200);
  const off = Number(offset);

  const conditions = [];
  if (patientId) conditions.push(eq(proceduresTable.patientId, Number(patientId)));
  if (dateFrom) conditions.push(gte(proceduresTable.scheduledDate, new Date(dateFrom as string)));
  if (dateTo) conditions.push(lte(proceduresTable.scheduledDate, new Date(dateTo as string)));

  const rows = await db
    .select({ procedure: proceduresTable, patient: patientsTable })
    .from(proceduresTable)
    .leftJoin(patientsTable, eq(proceduresTable.patientId, patientsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(proceduresTable.scheduledDate))
    .limit(lim)
    .offset(off);

  res.json(rows.map(r => ({ ...r.procedure, patient: r.patient })));
});

router.post("/procedures", async (req, res) => {
  const { patientId, procedureName, scheduledDate, procedureCode, facility, surgeon, arrivalTime, specialInstructions, ehrProcedureId } = req.body;
  if (!patientId || !procedureName || !scheduledDate) {
    return res.status(400).json({ error: "patientId, procedureName, scheduledDate are required" });
  }
  const [proc] = await db
    .insert(proceduresTable)
    .values({ patientId, procedureName, scheduledDate: new Date(scheduledDate), procedureCode, facility, surgeon, arrivalTime, specialInstructions, ehrProcedureId })
    .returning();

  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
  res.status(201).json({ ...proc, patient });
});

router.get("/procedures/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select({ procedure: proceduresTable, patient: patientsTable })
    .from(proceduresTable)
    .leftJoin(patientsTable, eq(proceduresTable.patientId, patientsTable.id))
    .where(eq(proceduresTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ ...row.procedure, patient: row.patient });
});

router.patch("/procedures/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { procedureName, procedureCode, scheduledDate, facility, surgeon, arrivalTime, specialInstructions } = req.body;
  const [proc] = await db
    .update(proceduresTable)
    .set({
      procedureName,
      procedureCode,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      facility,
      surgeon,
      arrivalTime,
      specialInstructions,
    })
    .where(eq(proceduresTable.id, id))
    .returning();
  if (!proc) return res.status(404).json({ error: "Not found" });
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, proc.patientId));
  res.json({ ...proc, patient });
});

router.delete("/procedures/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(proceduresTable).where(eq(proceduresTable.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

export default router;
