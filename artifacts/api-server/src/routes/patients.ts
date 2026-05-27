import { Router } from "express";
import { db } from "@workspace/db";
import { patientsTable } from "@workspace/db/schema";
import { eq, ilike, or, desc } from "drizzle-orm";

const router = Router();

router.get("/patients", async (req, res) => {
  const { search, limit = "50", offset = "0" } = req.query;
  const lim = Math.min(Number(limit), 200);
  const off = Number(offset);

  let query = db.select().from(patientsTable).orderBy(desc(patientsTable.createdAt));

  let rows;
  if (search && typeof search === "string" && search.trim()) {
    rows = await db
      .select()
      .from(patientsTable)
      .where(
        or(
          ilike(patientsTable.firstName, `%${search}%`),
          ilike(patientsTable.lastName, `%${search}%`),
          ilike(patientsTable.mrn, `%${search}%`),
          ilike(patientsTable.phone, `%${search}%`),
        ),
      )
      .orderBy(desc(patientsTable.createdAt))
      .limit(lim)
      .offset(off);
  } else {
    rows = await query.limit(lim).offset(off);
  }
  res.json(rows);
});

router.post("/patients", async (req, res) => {
  const { firstName, lastName, dateOfBirth, phone, email, mrn, language, notes, ehrPatientId } = req.body;
  if (!firstName || !lastName || !dateOfBirth || !phone) {
    return res.status(400).json({ error: "firstName, lastName, dateOfBirth, phone are required" });
  }
  const [patient] = await db
    .insert(patientsTable)
    .values({ firstName, lastName, dateOfBirth, phone, email, mrn, language: language ?? "en", notes, ehrPatientId })
    .returning();
  res.status(201).json(patient);
});

router.get("/patients/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, id));
  if (!patient) return res.status(404).json({ error: "Not found" });
  res.json(patient);
});

router.patch("/patients/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { firstName, lastName, dateOfBirth, phone, email, mrn, language, notes } = req.body;
  const [patient] = await db
    .update(patientsTable)
    .set({ firstName, lastName, dateOfBirth, phone, email, mrn, language, notes })
    .where(eq(patientsTable.id, id))
    .returning();
  if (!patient) return res.status(404).json({ error: "Not found" });
  res.json(patient);
});

router.delete("/patients/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(patientsTable).where(eq(patientsTable.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

export default router;
