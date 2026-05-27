import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/users/me", async (req, res) => {
  const clerkUserId = (req as any).auth?.userId;
  if (!clerkUserId) return res.status(401).json({ error: "Unauthorized" });

  let [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));

  if (!user) {
    const clerkUser = (req as any).auth;
    [user] = await db
      .insert(usersTable)
      .values({
        clerkUserId,
        email: clerkUser?.sessionClaims?.email ?? `${clerkUserId}@unknown.com`,
        role: "coordinator",
        active: "true",
      })
      .onConflictDoNothing()
      .returning();

    if (!user) {
      [user] = await db.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId));
    }
  }

  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ ...user, active: user.active === "true" });
});

router.get("/users", async (req, res) => {
  const rows = await db.select().from(usersTable).orderBy(desc(usersTable.createdAt));
  res.json(rows.map(u => ({ ...u, active: u.active === "true" })));
});

router.post("/users", async (req, res) => {
  const { email, firstName, lastName, role } = req.body;
  if (!email || !role) return res.status(400).json({ error: "email and role are required" });

  const [user] = await db
    .insert(usersTable)
    .values({ clerkUserId: `manual_${Date.now()}`, email, firstName, lastName, role: role ?? "coordinator", active: "true" })
    .returning();
  res.status(201).json({ ...user, active: user.active === "true" });
});

router.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { role, active } = req.body;
  const update: Record<string, unknown> = {};
  if (role !== undefined) update.role = role;
  if (active !== undefined) update.active = active ? "true" : "false";

  const [user] = await db.update(usersTable).set(update).where(eq(usersTable.id, id)).returning();
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ ...user, active: user.active === "true" });
});

export default router;
