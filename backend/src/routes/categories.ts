import { Hono } from "hono";
import { db } from "../db/index.js";
import { categories, tasks } from "../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { createCategorySchema, updateCategorySchema } from "../types/schemas.js";
import { authMiddleware } from "../middleware/auth.js";

const categoryRoutes = new Hono();
categoryRoutes.use("*", authMiddleware);

// GET /categories
categoryRoutes.get("/", async (c) => {
  const { userId } = c.get("user");
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(desc(categories.createdAt));
  return c.json({ categories: result });
});

// POST /categories
categoryRoutes.post("/", async (c) => {
  const { userId } = c.get("user");
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [category] = await db
    .insert(categories)
    .values({ ...parsed.data, userId })
    .returning();

  return c.json({ category }, 201);
});

// PATCH /categories/:id
categoryRoutes.patch("/:id", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = updateCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!existing) return c.json({ error: "Category not found" }, 404);

  const [category] = await db
    .update(categories)
    .set(parsed.data)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .returning();

  return c.json({ category });
});

// DELETE /categories/:id
categoryRoutes.delete("/:id", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));

  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  if (!existing) return c.json({ error: "Category not found" }, 404);

  await db.delete(categories).where(eq(categories.id, id));
  return c.json({ success: true });
});

export default categoryRoutes;
