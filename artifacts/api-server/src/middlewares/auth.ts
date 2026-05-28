import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = (req as any).auth;
  const userId = auth?.userId;
  if (!userId) {
    const authHeader = req.headers.authorization;
    console.log("[AUTH DEBUG]", {
      url: req.url,
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 30) : null,
      authObject: auth ? { sessionId: auth.sessionId, userId: auth.userId, reason: auth.reason, message: auth.message } : null,
      host: req.headers.host,
      xForwardedHost: req.headers["x-forwarded-host"],
    });
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
