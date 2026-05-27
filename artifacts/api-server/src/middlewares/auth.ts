import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as any).auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = (req as any).auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkUserId, userId))
    .limit(1);

  if (!user || user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  next();
}
