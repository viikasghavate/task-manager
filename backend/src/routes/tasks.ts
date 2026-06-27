import { Hono } from "hono";
import { db } from "../db/index.js";
import { tasks, categories, worknotes } from "../db/schema.js";
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
      startDate: data.startDate ? new Date(data.startDate) : null,
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
  if (data.startDate !== undefined) {
    updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  }
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
// GET /tasks/:id/worknotes — list worknotes for a task
taskRoutes.get("/:id/worknotes", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));

  // Verify task ownership
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) return c.json({ error: "Task not found" }, 404);

  const result = await db
    .select()
    .from(worknotes)
    .where(eq(worknotes.taskId, id))
    .orderBy(desc(worknotes.createdAt));

  return c.json({ worknotes: result });
});

// POST /tasks/:id/worknotes — add a worknote to a task
taskRoutes.post("/:id/worknotes", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));
  const { content } = await c.req.json();

  if (!content || typeof content !== "string" || !content.trim()) {
    return c.json({ error: "Content is required" }, 400);
  }

  // Verify task ownership
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) return c.json({ error: "Task not found" }, 404);

  const [note] = await db
    .insert(worknotes)
    .values({
      taskId: id,
      content: content.trim(),
    })
    .returning();

  return c.json({ worknote: note }, 201);
});

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
