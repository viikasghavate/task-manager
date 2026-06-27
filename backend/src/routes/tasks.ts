import { Hono } from "hono";
import { db } from "../db/index.js";
import { tasks, categories } from "../db/schema.js";
import { eq, and, desc, inArray } from "drizzle-orm";
import { createTaskSchema, updateTaskSchema } from "../types/schemas.js";
import { authMiddleware } from "../middleware/auth.js";

const taskRoutes = new Hono();
taskRoutes.use("*", authMiddleware);

// GET /tasks — list tasks with optional filters
taskRoutes.get("/", async (c) => {
  const { userId } = c.get("user");
  const status = c.req.query("status");
  const priority = c.req.query("priority");
  const categoryId = c.req.query("categoryId");

  const filters = [eq(tasks.userId, userId)];
  if (status) filters.push(eq(tasks.status, status as any));
  if (priority) filters.push(eq(tasks.priority, priority as any));
  if (categoryId) filters.push(eq(tasks.categoryId, Number(categoryId)));

  const result = await db
    .select()
    .from(tasks)
    .where(and(...filters))
    .orderBy(desc(tasks.createdAt));

  return c.json({ tasks: result });
});

// GET /tasks/:id
taskRoutes.get("/:id", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);

  if (!task) return c.json({ error: "Task not found" }, 404);
  return c.json({ task });
});

// POST /tasks
taskRoutes.post("/", async (c) => {
  const { userId } = c.get("user");
  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  // Verify category belongs to user if provided
  if (data.categoryId) {
    const [cat] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, data.categoryId), eq(categories.userId, userId)))
      .limit(1);
    if (!cat) return c.json({ error: "Category not found" }, 404);
  }

  const [task] = await db
    .insert(tasks)
    .values({
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      userId,
    })
    .returning();

  return c.json({ task }, 201);
});

// PATCH /tasks/:id
taskRoutes.patch("/:id", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  // Verify ownership
  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  if (!existing) return c.json({ error: "Task not found" }, 404);

  // Verify category if provided
  if (data.categoryId) {
    const [cat] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, data.categoryId), eq(categories.userId, userId)))
      .limit(1);
    if (!cat) return c.json({ error: "Category not found" }, 404);
  }

  const updateData: Record<string, any> = { ...data, updatedAt: new Date() };
  if (data.dueDate !== undefined) {
    updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  }

  const [task] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .returning();

  return c.json({ task });
});

// DELETE /tasks/:id
taskRoutes.delete("/:id", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));

  const [existing] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  if (!existing) return c.json({ error: "Task not found" }, 404);

  await db.delete(tasks).where(eq(tasks.id, id));
  return c.json({ success: true });
});

export default taskRoutes;
