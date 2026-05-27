import { Router } from "express";
import { db } from "@workspace/db";
import { callTemplatesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/call-templates", requireAuth, async (req, res) => {
  const rows = await db.select().from(callTemplatesTable).orderBy(desc(callTemplatesTable.createdAt));
  res.json(rows.map(r => ({ ...r, active: r.active === "true" })));
});

router.post("/call-templates", async (req, res) => {
  const { callType, name, systemPrompt, questions, language, active, vapiAssistantId } = req.body;
  if (!callType || !name || !systemPrompt) {
    return res.status(400).json({ error: "callType, name, systemPrompt are required" });
  }
  const [tpl] = await db
    .insert(callTemplatesTable)
    .values({ callType, name, systemPrompt, questions, language: language ?? "en", active: active !== false ? "true" : "false", vapiAssistantId })
    .returning();
  res.status(201).json({ ...tpl, active: tpl.active === "true" });
});

router.get("/call-templates/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [tpl] = await db.select().from(callTemplatesTable).where(eq(callTemplatesTable.id, id));
  if (!tpl) return res.status(404).json({ error: "Not found" });
  res.json({ ...tpl, active: tpl.active === "true" });
});

router.patch("/call-templates/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, systemPrompt, questions, language, active, vapiAssistantId } = req.body;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (systemPrompt !== undefined) update.systemPrompt = systemPrompt;
  if (questions !== undefined) update.questions = questions;
  if (language !== undefined) update.language = language;
  if (active !== undefined) update.active = active ? "true" : "false";
  if (vapiAssistantId !== undefined) update.vapiAssistantId = vapiAssistantId;

  const [tpl] = await db.update(callTemplatesTable).set(update).where(eq(callTemplatesTable.id, id)).returning();
  if (!tpl) return res.status(404).json({ error: "Not found" });
  res.json({ ...tpl, active: tpl.active === "true" });
});

router.delete("/call-templates/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [deleted] = await db.delete(callTemplatesTable).where(eq(callTemplatesTable.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Not found" });
  res.status(204).end();
});

export default router;
