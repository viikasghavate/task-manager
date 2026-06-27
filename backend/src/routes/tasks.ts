import { Hono } from "hono";
import { db } from "../db/index.js";
import { tasks, categories, worknotes, taskAssignees, users } from "../db/schema.js";
import { eq, and, desc, inArray, ne } from "drizzle-orm";
import { createTaskSchema, updateTaskSchema } from "../types/schemas.js";
import { authMiddleware } from "../middleware/auth.js";

const taskRoutes = new Hono();
taskRoutes.use("*", authMiddleware);

// GET /tasks — list tasks with optional filters
// Includes tasks owned by user AND tasks assigned to user
taskRoutes.get("/", async (c) => {
  const { userId } = c.get("user");
  const status = c.req.query("status");
  const priority = c.req.query("priority");
  const categoryId = c.req.query("categoryId");
  const shared = c.req.query("shared");

  if (shared === "true") {
    // Tasks assigned to user but not owned by them
    const assignedIds = await db
      .select({ taskId: taskAssignees.taskId })
      .from(taskAssignees)
      .where(eq(taskAssignees.userId, userId));

    if (assignedIds.length === 0) return c.json({ tasks: [] });

    const filters = [
      inArray(tasks.id, assignedIds.map((a) => a.taskId)),
      ne(tasks.userId, userId),
    ];
    if (status) filters.push(eq(tasks.status, status as any));
    if (priority) filters.push(eq(tasks.priority, priority as any));
    if (categoryId) filters.push(eq(tasks.categoryId, Number(categoryId)));

    const result = await db
      .select()
      .from(tasks)
      .where(and(...filters))
      .orderBy(tasks.position, desc(tasks.createdAt));

    return c.json({ tasks: result });
  }

  const filters = [eq(tasks.userId, userId)];
  if (status) filters.push(eq(tasks.status, status as any));
  if (priority) filters.push(eq(tasks.priority, priority as any));
  if (categoryId) filters.push(eq(tasks.categoryId, Number(categoryId)));

  const result = await db
    .select()
    .from(tasks)
    .where(and(...filters))
    .orderBy(tasks.position, desc(tasks.createdAt));

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

  // Fetch existing tasks in this status to compute the position
  const existingTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, data.status || "todo")));
  const position = existingTasks.length;

  const [task] = await db
    .insert(tasks)
    .values({
      ...data,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      userId,
      position,
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

// POST /tasks/:id/assign — assign a user to a task
taskRoutes.post("/:id/assign", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));
  const { assigneeId } = await c.req.json();

  if (!assigneeId) return c.json({ error: "assigneeId is required" }, 400);

  // Verify task ownership
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) return c.json({ error: "Task not found" }, 404);

  // Check if already assigned
  const [existing] = await db
    .select()
    .from(taskAssignees)
    .where(and(eq(taskAssignees.taskId, id), eq(taskAssignees.userId, assigneeId)))
    .limit(1);
  if (existing) return c.json({ error: "User already assigned" }, 409);

  const [assignment] = await db
    .insert(taskAssignees)
    .values({ taskId: id, userId: assigneeId })
    .returning();

  return c.json({ assignment }, 201);
});

// DELETE /tasks/:id/assign/:assigneeId — remove an assignee
taskRoutes.delete("/:id/assign/:assigneeId", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));
  const assigneeId = Number(c.req.param("assigneeId"));

  // Verify task ownership
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) return c.json({ error: "Task not found" }, 404);

  await db
    .delete(taskAssignees)
    .where(and(eq(taskAssignees.taskId, id), eq(taskAssignees.userId, assigneeId)));

  return c.json({ success: true });
});

// GET /tasks/:id/assignees — list assignees for a task
taskRoutes.get("/:id/assignees", async (c) => {
  const { userId } = c.get("user");
  const id = Number(c.req.param("id"));

  // Verify the user owns or is assigned to the task
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, id))
    .limit(1);
  if (!task) return c.json({ error: "Task not found" }, 404);

  if (task.userId !== userId) {
    const [assigned] = await db
      .select()
      .from(taskAssignees)
      .where(and(eq(taskAssignees.taskId, id), eq(taskAssignees.userId, userId)))
      .limit(1);
    if (!assigned) return c.json({ error: "Not authorized" }, 403);
  }

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(eq(taskAssignees.taskId, id));

  return c.json({ assignees: result });
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

taskRoutes.post("/reorder", async (c) => {
  const { userId } = c.get("user");
  const { taskId, status, targetTaskId } = await c.req.json();

  if (!taskId || !status) {
    return c.json({ error: "taskId and status are required" }, 400);
  }

  // Verify task ownership
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  if (!task) return c.json({ error: "Task not found" }, 404);

  // Fetch all tasks in the target status for this user, ordered by position
  const statusTasks = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.status, status)))
    .orderBy(tasks.position, tasks.id);

  // Remove the dragged task if it was already in this status
  const otherTasks = statusTasks.filter((t) => t.id !== taskId);

  if (targetTaskId) {
    const targetIdx = otherTasks.findIndex((t) => t.id === targetTaskId);
    if (targetIdx !== -1) {
      // Place it at the target task's index (shifting others down)
      otherTasks.splice(targetIdx, 0, task);
    } else {
      otherTasks.push(task);
    }
  } else {
    // Append to the end
    otherTasks.push(task);
  }

  // Update positions in the database
  for (let i = 0; i < otherTasks.length; i++) {
    await db
      .update(tasks)
      .set({ position: i, status: otherTasks[i].id === taskId ? status : otherTasks[i].status })
      .where(and(eq(tasks.id, otherTasks[i].id), eq(tasks.userId, userId)));
  }

  return c.json({ success: true });
});

export default taskRoutes;
