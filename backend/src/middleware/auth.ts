import { createMiddleware } from "hono/factory";
import jwt from "jsonwebtoken";
import type { Context } from "hono";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

export interface JwtPayload {
  userId: number;
  email: string;
}

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    c.set("user", payload);
    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});

export { JWT_SECRET };
