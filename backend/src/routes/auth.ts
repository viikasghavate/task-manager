import { Hono } from "hono";
import jwt from "jsonwebtoken";
import { hash, compare } from "bcryptjs";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { registerSchema, loginSchema } from "../types/schemas.js";
import { JWT_SECRET } from "../middleware/auth.js";

const auth = new Hono();

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { email, name, password } = parsed.data;

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: "Email already registered" }, 409);
  }

  const passwordHash = await hash(password, 10);
  const [user] = await db
    .insert(users)
    .values({ email, name, passwordHash })
    .returning({ id: users.id, email: users.email, name: users.name });

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });

  return c.json({ user, token }, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });

  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    token,
  });
});

auth.get("/me", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { userId: number; email: string };
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ user });
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

export default auth;
