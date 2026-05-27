import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const clerkUserId = (req as any).auth?.userId;

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));

  if (!user) {
    const sessionClaims = (req as any).auth?.sessionClaims ?? {};
    const email = sessionClaims.email ?? `${clerkUserId}@unknown.com`;
    const firstName = sessionClaims.given_name ?? sessionClaims.firstName ?? null;
    const lastName = sessionClaims.family_name ?? sessionClaims.lastName ?? null;

    [user] = await db
      .insert(usersTable)
      .values({
        clerkUserId,
        email,
        firstName,
        lastName,
        role: "coordinator",
        active: "true",
      })
      .onConflictDoNothing()
      .returning();

    if (!user) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
    }
  }

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ ...user, active: user.active === "true" });
});

router.get("/users", requireAdmin, async (req, res): Promise<void> => {
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(rows.map(u => ({ ...u, active: u.active === "true" })));
});

router.post("/users", requireAdmin, async (req, res): Promise<void> => {
  const { email, firstName, lastName, role } = req.body;
  if (!email || !role) {
    res.status(400).json({ error: "email and role are required" });
    return;
  }
  const [user] = await db
    .insert(usersTable)
    .values({ clerkUserId: `manual_${Date.now()}`, email, firstName, lastName, role: role ?? "coordinator", active: "true" })
    .returning();
  res.status(201).json({ ...user, active: user.active === "true" });
});

router.patch("/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { role, active } = req.body;
  const update: Record<string, unknown> = {};
  if (role !== undefined) update.role = role;
  if (active !== undefined) update.active = active ? "true" : "false";

  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ ...user, active: user.active === "true" });
});

export default router;
