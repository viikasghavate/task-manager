import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tasks as tasksApi, categories as categoriesApi, type Task, type Category } from '../api/client';

// ── Theme ──
const COLORS = {
  todo: { border: 'border-l-cyan-500', badge: 'bg-cyan-500/20 text-cyan-400', icon: 'text-cyan-400' },
  in_progress: { border: 'border-l-yellow-500', badge: 'bg-yellow-500/20 text-yellow-400', icon: 'text-yellow-400' },
  on_hold: { border: 'border-l-pink-500', badge: 'bg-pink-500/20 text-pink-400', icon: 'text-pink-400' },
  done: { border: 'border-l-emerald-500', badge: 'bg-emerald-500/20 text-emerald-400', icon: 'text-emerald-400' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-pink-500',
  urgent: 'bg-red-500',
};

const KANBAN_LANES = [
  { key: 'todo', label: 'To Do', icon: '○' },
  { key: 'in_progress', label: 'In Progress', icon: '◐' },
  { key: 'on_hold', label: 'On Hold', icon: '⏸' },
  { key: 'done', label: 'Done', icon: '✓' },
] as const;

const STATUS_OPTIONS = ['todo', 'in_progress', 'on_hold', 'done'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

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
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (filterPriority) params.priority = filterPriority;
    if (filterCategory) params.categoryId = filterCategory;
    const data = await tasksApi.list(params);
    setTaskList(data.tasks);
  }, [filterStatus, filterPriority, filterCategory]);

  const loadCategories = useCallback(async () => {
    const data = await categoriesApi.list();
    setCategoryList(data.categories);
  }, []);

  useEffect(() => {
    loadTasks();
    loadCategories();
  }, [loadTasks, loadCategories]);

  const filteredTasks = taskList
    .filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'priority') {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
      }
      return 0;
    });

  const tasksByStatus = (status: string) => filteredTasks.filter((t) => t.status === status);

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

  const handleClearCompleted = async () => {
    const done = taskList.filter((t) => t.status === 'done');
    for (const t of done) {
      await tasksApi.delete(t.id);
    }
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
    <div className="min-h-screen bg-[#0B0F14] text-white flex">
      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside className="w-64 shrink-0 bg-[#151921] border-r border-gray-800/50 flex flex-col p-5 gap-5">
          {/* View Mode */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-500 uppercase mb-2">View Mode</p>
            <div className="relative">
              <select
                value="kanban"
                className="w-full bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
              >
                <option value="kanban">⊞ Kanban Board</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">▼</span>
            </div>
          </div>

          {/* Search */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-500 uppercase mb-2">Search</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0B0F14] border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Filters */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-500 uppercase mb-2">Filters</p>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer mb-2"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categoryList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-500 uppercase mb-2">Priority</p>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-gray-500 uppercase mb-2">Sort By</p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">Priority</option>
            </select>
          </div>

          {/* Actions */}
          <div className="space-y-2 mt-auto">
            <button
              onClick={handleClearCompleted}
              className="w-full flex items-center gap-2 px-3 py-2 border border-red-500/30 text-red-400 rounded-lg text-sm hover:bg-red-500/10 transition"
            >
              <span className="text-sm">🗑</span>
              Clear Completed
            </button>
            <button
              onClick={() => setShowCategoryForm(!showCategoryForm)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition"
            >
              <span className="text-sm">🔗</span>
              {showCategoryForm ? 'Close Categories' : 'Manage Categories'}
            </button>
          </div>
        </aside>
      )}

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-gray-800/50 bg-[#0B0F14]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white text-lg"
            >
              {sidebarOpen ? '☰' : '☰'}
            </button>
            <span className="text-lg font-bold text-cyan-400">TaskFlow</span>
            <span className="text-xs text-gray-500 bg-gray-800/60 px-2 py-0.5 rounded-full">
              {taskList.length} tasks
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition"
            >
              <span>+</span> New Task
            </button>
            <button onClick={logout} className="text-gray-500 hover:text-white text-sm transition">
              Sign out
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-5 overflow-auto">
          {/* Category Form */}
          {showCategoryForm && (
            <div className="mb-5 p-4 bg-[#151921] rounded-xl border border-gray-800">
              <h3 className="text-sm font-medium mb-3">Manage Categories</h3>
              <form onSubmit={handleCategorySubmit} className="flex gap-3 items-end mb-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-1.5 text-sm"
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
                  className="bg-cyan-600 hover:bg-cyan-500 px-4 py-1.5 rounded-lg text-sm transition"
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
            <div className="mb-5 p-4 bg-[#151921] rounded-xl border border-gray-800">
              <h3 className="text-sm font-medium mb-3">
                {editingTask ? 'Edit Task' : 'New Task'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Task title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-gray-800 rounded-lg px-4 py-2 text-sm"
                  required
                />
                <textarea
                  placeholder="Description (optional)"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-gray-800 rounded-lg px-4 py-2 text-sm"
                  rows={2}
                />
                <div className="flex gap-3 flex-wrap">
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-1.5 text-sm"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-1.5 text-sm"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value ? Number(e.target.value) : '')}
                    className="bg-[#0B0F14] border border-gray-800 rounded-lg px-3 py-1.5 text-sm"
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
                    className="bg-cyan-600 hover:bg-cyan-500 px-4 py-1.5 rounded-lg text-sm transition"
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
              const theme = COLORS[lane.key as keyof typeof COLORS];
              return (
                <div
                  key={lane.key}
                  className="bg-[#151921]/60 rounded-xl min-h-[400px] flex flex-col"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggingId !== null) handleDrop(draggingId, lane.key);
                  }}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${theme.icon}`}>{lane.icon}</span>
                      <h3 className="text-sm font-semibold text-gray-300">{lane.label}</h3>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${theme.badge}`}>
                        {tasks.length}
                      </span>
                    </div>
                    <button
                      onClick={() => { resetForm(); setFormStatus(lane.key as any); setShowForm(true); }}
                      className="text-gray-500 hover:text-white text-sm"
                    >
                      +
                    </button>
                  </div>

                  {/* Cards */}
                  <div className="p-3 space-y-2 flex-1">
                    {tasks.length === 0 && (
                      <div className="border-2 border-dashed border-gray-800 rounded-lg flex flex-col items-center justify-center py-8 text-gray-600">
                        <span className="text-2xl mb-1">⊞</span>
                        <span className="text-xs">No tasks</span>
                      </div>
                    )}
                    {tasks.map((task) => {
                      const cat = categoryList.find((c) => c.id === task.categoryId);
                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => setDraggingId(task.id)}
                          className={`bg-[#151921] border-l-[3px] ${theme.border} rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-gray-700 transition group ${
                            draggingId === task.id ? 'opacity-50' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            {/* Checkbox */}
                            <span className={`mt-0.5 shrink-0 text-sm ${
                              task.status === 'done' ? 'text-emerald-400' : 'text-gray-600'
                            }`}>
                              {task.status === 'done' ? '✓' : '○'}
                            </span>

                            <div className="flex-1 min-w-0">
                              {/* Title */}
                              <h4 className={`text-sm font-medium leading-snug ${
                                task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-100'
                              }`}>
                                {task.title}
                              </h4>

                              {/* Description */}
                              {task.description && (
                                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                              )}

                              {/* Tags */}
                              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${theme.badge}`}>
                                  {task.status === 'done' ? '✓ Done' : task.status.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 flex items-center gap-1">
                                  <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[task.priority]}`} />
                                  {task.priority}
                                </span>
                                {cat && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                    {cat.name}
                                  </span>
                                )}
                              </div>

                              {/* Metadata */}
                              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-600">
                                {task.dueDate && (
                                  <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button
                                onClick={() => startEdit(task)}
                                className="text-gray-500 hover:text-white text-xs px-1"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDelete(task.id)}
                                className="text-gray-500 hover:text-red-400 text-xs px-1"
                              >
                                ✕
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
    </div>
  );
}
