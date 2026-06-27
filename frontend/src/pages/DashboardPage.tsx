import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tasks as tasksApi, categories as categoriesApi, type Task, type Category } from '../api/client';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-600',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

const STATUS_OPTIONS = ['todo', 'in_progress', 'on_hold', 'done'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

const KANBAN_LANES = [
  { key: 'todo', label: 'To Do', color: 'border-t-indigo-500' },
  { key: 'in_progress', label: 'In Progress', color: 'border-t-blue-500' },
  { key: 'on_hold', label: 'On Hold', color: 'border-t-amber-500' },
  { key: 'done', label: 'Done', color: 'border-t-emerald-500' },
] as const;

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState<'todo' | 'in_progress' | 'on_hold' | 'done'>('todo');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number | ''>('');

  // Category form
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#6366f1');

  const loadTasks = useCallback(async () => {
    const data = await tasksApi.list();
    setTaskList(data.tasks);
  }, []);

  const loadCategories = useCallback(async () => {
    const data = await categoriesApi.list();
    setCategoryList(data.categories);
  }, []);

  useEffect(() => {
    loadTasks();
    loadCategories();
  }, [loadTasks, loadCategories]);

  const tasksByStatus = (status: string) =>
    taskList.filter((t) => t.status === status);

  const resetForm = () => {
    setFormTitle('');
    setFormDesc('');
    setFormStatus('todo');
    setFormPriority('medium');
    setFormDueDate('');
    setFormCategoryId('');
    setEditingTask(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      title: formTitle,
      description: formDesc,
      status: formStatus,
      priority: formPriority,
    };
    if (formDueDate) payload.dueDate = new Date(formDueDate).toISOString();
    if (formCategoryId !== '') payload.categoryId = formCategoryId;

    if (editingTask) {
      await tasksApi.update(editingTask.id, payload);
    } else {
      await tasksApi.create(payload);
    }
    resetForm();
    loadTasks();
  };

  const handleDelete = async (id: number) => {
    await tasksApi.delete(id);
    loadTasks();
  };

  const startEdit = (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description);
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormDueDate(task.dueDate ? task.dueDate.slice(0, 16) : '');
    setFormCategoryId(task.categoryId ?? '');
    setShowForm(true);
  };

  const handleDrop = async (taskId: number, newStatus: string) => {
    setDraggingId(null);
    await tasksApi.update(taskId, { status: newStatus as any });
    loadTasks();
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await categoriesApi.create({ name: catName, color: catColor });
    setCatName('');
    setCatColor('#6366f1');
    setShowCategoryForm(false);
    loadCategories();
  };

  const handleDeleteCategory = async (id: number) => {
    await categoriesApi.delete(id);
    loadCategories();
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Task Manager</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.name}</span>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-white transition">
            Sign out
          </button>
        </div>
      </header>

      <div className="p-6">
        {/* Actions bar */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg text-sm font-medium transition"
          >
            + New Task
          </button>
          <button
            onClick={() => setShowCategoryForm(!showCategoryForm)}
            className="bg-gray-800 hover:bg-gray-700 px-4 py-1.5 rounded-lg text-sm transition"
          >
            {showCategoryForm ? 'Close' : 'Categories'}
          </button>
        </div>

        {/* Category Form */}
        {showCategoryForm && (
          <div className="mb-6 p-4 bg-gray-900 rounded-xl border border-gray-800">
            <h3 className="text-sm font-medium mb-3">Manage Categories</h3>
            <form onSubmit={handleCategorySubmit} className="flex gap-3 items-end mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Color</label>
                <input
                  type="color"
                  value={catColor}
                  onChange={(e) => setCatColor(e.target.value)}
                  className="w-10 h-9 rounded cursor-pointer"
                />
              </div>
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg text-sm transition"
              >
                Add
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {categoryList.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-2 bg-gray-800 px-3 py-1 rounded-full text-sm"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="text-gray-500 hover:text-red-400 ml-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Task Form */}
        {showForm && (
          <div className="mb-6 p-4 bg-gray-900 rounded-xl border border-gray-800">
            <h3 className="text-sm font-medium mb-3">
              {editingTask ? 'Edit Task' : 'New Task'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Task title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm"
                required
              />
              <textarea
                placeholder="Description (optional)"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm"
                rows={2}
              />
              <div className="flex gap-3 flex-wrap">
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
                <select
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value as any)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                />
                <select
                  value={formCategoryId}
                  onChange={(e) => setFormCategoryId(e.target.value ? Number(e.target.value) : '')}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value="">No category</option>
                  {categoryList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg text-sm transition"
                >
                  {editingTask ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="bg-gray-800 hover:bg-gray-700 px-4 py-1.5 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_LANES.map((lane) => {
            const tasks = tasksByStatus(lane.key);
            return (
              <div
                key={lane.key}
                className={`bg-gray-900/50 rounded-xl border-t-4 ${lane.color} border-gray-800 min-h-[300px]`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (draggingId !== null) handleDrop(draggingId, lane.key);
                }}
              >
                {/* Lane header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                  <h3 className="text-sm font-semibold text-gray-300">{lane.label}</h3>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                    {tasks.length}
                  </span>
                </div>

                {/* Lane body */}
                <div className="p-3 space-y-2">
                  {tasks.length === 0 && (
                    <p className="text-xs text-gray-600 text-center py-6">Drop tasks here</p>
                  )}
                  {tasks.map((task) => {
                    const cat = categoryList.find((c) => c.id === task.categoryId);
                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => setDraggingId(task.id)}
                        className={`bg-gray-900 border border-gray-800 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-700 transition group ${
                          draggingId === task.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_COLORS[task.priority]}`} />
                              <h4 className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                                {task.title}
                              </h4>
                            </div>
                            {task.description && (
                              <p className="text-xs text-gray-500 line-clamp-2 mb-1">{task.description}</p>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-gray-500">
                              <span className="capitalize">{task.priority}</span>
                              {cat && (
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                  {cat.name}
                                </span>
                              )}
                              {task.dueDate && (
                                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                            <button
                              onClick={() => startEdit(task)}
                              className="text-gray-500 hover:text-white text-xs"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="text-gray-500 hover:text-red-400 text-xs"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
