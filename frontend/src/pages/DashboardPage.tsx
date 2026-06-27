import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tasks as tasksApi, categories as categoriesApi, type Task, type Category, type Worknote } from '../api/client';

// ── Theme (exact colors from reference image) ──
// bg-main: #0B0F14  |  bg-surface: #151921  |  bg-card: #151921
// bg-input: #0B0F14  |  border: #222B29  |  text-primary: #E8EDEB
// text-muted: #5B6F6B  |  text-secondary: #839592
// accent-teal: #0B7D7B  |  accent-teal-dark: #0E685E
// accent-yellow: #E6C404  |  accent-pink: #EB1740
// priority-low: #839592  |  priority-medium: #E6C404  |  priority-high: #EB1740

const COLORS = {
  todo: { border: 'border-l-[#0E685E]', badge: 'bg-[#0E685E]/20 text-[#0B7D7B]', icon: 'text-[#0B7D7B]' },
  in_progress: { border: 'border-l-[#E6C404]', badge: 'bg-[#E6C404]/20 text-[#E6C404]', icon: 'text-[#E6C404]' },
  on_hold: { border: 'border-l-[#EB1740]', badge: 'bg-[#EB1740]/20 text-[#EB1740]', icon: 'text-[#EB1740]' },
  done: { border: 'border-l-[#0E685E]', badge: 'bg-[#0E685E]/20 text-[#0E685E]', icon: 'text-[#0E685E]' },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-[#839592]',
  medium: 'bg-[#E6C404]',
  high: 'bg-[#EB1740]',
  urgent: 'bg-[#EB1740]',
};

const KANBAN_LANES = [
  { key: 'todo', label: 'To-do', icon: '○' },
  { key: 'in_progress', label: 'In Progress', icon: '◐' },
  { key: 'on_hold', label: 'On-Hold', icon: '⏸' },
  { key: 'done', label: 'Done', icon: '✓' },
] as const;

const STATUS_LABELS: Record<string, string> = {
  todo: 'To-do',
  in_progress: 'In Progress',
  on_hold: 'On-Hold',
  done: 'Done',
};

const STATUS_OPTIONS = ['todo', 'in_progress', 'on_hold', 'done'] as const;
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};
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
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [worknotesList, setWorknotesList] = useState<Worknote[]>([]);
  const [newWorknote, setNewWorknote] = useState('');
  const [isPostingNote, setIsPostingNote] = useState(false);

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
    setWorknotesList([]);
    setNewWorknote('');
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

  const startEdit = async (task: Task) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description);
    setFormStatus(task.status);
    setFormPriority(task.priority);
    setFormDueDate(task.dueDate ? task.dueDate.slice(0, 16) : '');
    setFormCategoryId(task.categoryId ?? '');
    setShowForm(true);

    try {
      const data = await tasksApi.getWorknotes(task.id);
      setWorknotesList(data.worknotes);
    } catch (err) {
      console.error("Failed to load worknotes", err);
      setWorknotesList([]);
    }
  };

  const toggleTaskStatus = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    await tasksApi.update(task.id, { status: nextStatus });
    loadTasks();
  };

  const handlePostWorknote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !newWorknote.trim()) return;

    setIsPostingNote(true);
    try {
      const data = await tasksApi.postWorknote(editingTask.id, newWorknote.trim());
      setWorknotesList((prev) => [data.worknote, ...prev]);
      setNewWorknote('');
    } catch (err) {
      console.error("Failed to post worknote", err);
    } finally {
      setIsPostingNote(false);
    }
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
    <div className="min-h-screen bg-[#0B0F14] text-[#E8EDEB] flex">
      {/* ── Sidebar ── */}
      {sidebarOpen && (
        <aside className="w-64 shrink-0 bg-[#151921] border-r border-[#222B29]/50 flex flex-col p-5 gap-5">
          {/* View Mode */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-2">View Mode</p>
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'kanban' | 'list')}
                className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer text-[#E8EDEB]"
              >
                <option value="kanban">⊞ Kanban Board</option>
                <option value="list">☰ List View</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6F6B] text-xs">▼</span>
            </div>
          </div>

          {/* Search */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-2">Search</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5B6F6B] text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg pl-9 pr-3 py-2 text-sm placeholder-[#364442] focus:outline-none focus:border-[#0B7D7B]/50"
              />
            </div>
          </div>

          {/* Filters */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-2">Filters</p>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer mb-2"
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categoryList.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-2">Priority</p>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer text-[#E8EDEB]"
            >
              <option value="">All Priorities</option>
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <p className="text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-2">Sort By</p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer"
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
              className="w-full flex items-center gap-2 px-3 py-2 border border-[#EB1740]/30 text-[#EB1740] rounded-lg text-sm hover:bg-[#EB1740]/10 transition"
            >
              <span className="text-sm">🗑</span>
              Clear Completed
            </button>
            <button
              onClick={() => setShowCategoryForm(!showCategoryForm)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-[#0E685E] hover:bg-[#0B7D7B] text-white rounded-lg text-sm font-medium transition"
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
        <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-[#222B29]/50 bg-[#0B0F14]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-[#5B6F6B] hover:text-white text-lg"
            >
              ☰
            </button>
            <span className="text-lg font-bold text-[#0B7D7B]">TaskFlow</span>
            <span className="text-xs text-[#5B6F6B] bg-[#222B29]/60 px-2 py-0.5 rounded-full">
              {taskList.length} tasks
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#839592]">{user?.name}</span>
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="flex items-center gap-1.5 bg-[#0E685E] hover:bg-[#0B7D7B] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition"
            >
              <span>+</span> New Task
            </button>
            <button onClick={logout} className="text-[#5B6F6B] hover:text-white text-sm transition">
              Sign out
            </button>
          </div>
        </header>

        {/* Content */}
        <div className={`flex-1 p-5 flex flex-col min-h-0 ${viewMode === 'kanban' ? 'overflow-hidden' : 'overflow-auto'}`}>
          {/* Category Form */}
          {showCategoryForm && (
            <div className="mb-5 p-4 bg-[#151921] rounded-xl border border-[#222B29]">
              <h3 className="text-sm font-medium mb-3">Manage Categories</h3>
              <form onSubmit={handleCategorySubmit} className="flex gap-3 items-end mb-4">
                <div>
                  <label className="block text-xs text-[#5B6F6B] mb-1">Name</label>
                  <input
                    type="text"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-1.5 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#5B6F6B] mb-1">Color</label>
                  <input
                    type="color"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="w-10 h-9 rounded cursor-pointer"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#0E685E] hover:bg-[#0B7D7B] px-4 py-1.5 rounded-lg text-sm transition"
                >
                  Add
                </button>
              </form>
              <div className="flex flex-wrap gap-2">
                {categoryList.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 bg-[#222B29] px-3 py-1 rounded-full text-sm"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                    <button
                      onClick={() => handleDeleteCategory(c.id)}
                      className="text-[#5B6F6B] hover:text-[#EB1740] ml-1"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Task Form Modal */}
          {showForm && (
            <div 
              className="fixed inset-0 bg-[#0B0F14]/75 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
              onClick={resetForm}
            >
              <div 
                className="w-full max-w-4xl bg-[#151921] rounded-2xl border border-[#222B29] p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-[#222B29]/50 pb-3">
                  <h3 className="text-base font-semibold text-[#E8EDEB]">
                    {editingTask ? 'Edit Task' : 'New Task'}
                  </h3>
                  <button 
                    type="button"
                    onClick={resetForm} 
                    className="text-[#5B6F6B] hover:text-[#E8EDEB] text-xl transition"
                  >
                    ×
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Left Lane: Task Fields */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-1.5">Title</label>
                      <input
                        type="text"
                        placeholder="Task title"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-4 py-2.5 text-sm text-[#E8EDEB] placeholder-[#364442] focus:outline-none focus:border-[#0B7D7B]/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-1.5">Description</label>
                      <textarea
                        placeholder="Description (optional)"
                        value={formDesc}
                        onChange={(e) => setFormDesc(e.target.value)}
                        className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-4 py-2.5 text-sm text-[#E8EDEB] placeholder-[#364442] focus:outline-none focus:border-[#0B7D7B]/50"
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-1.5">Status</label>
                        <select
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value as any)}
                          className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm text-[#E8EDEB] focus:outline-none focus:border-[#0B7D7B]/50"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-1.5">Priority</label>
                        <select
                          value={formPriority}
                          onChange={(e) => setFormPriority(e.target.value as any)}
                          className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm text-[#E8EDEB] focus:outline-none focus:border-[#0B7D7B]/50"
                        >
                          {PRIORITY_OPTIONS.map((p) => (
                            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-1.5">Due Date</label>
                        <input
                          type="datetime-local"
                          value={formDueDate}
                          onChange={(e) => setFormDueDate(e.target.value)}
                          className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm text-[#E8EDEB] focus:outline-none focus:border-[#0B7D7B]/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-1.5">Category</label>
                        <select
                          value={formCategoryId}
                          onChange={(e) => setFormCategoryId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-3 py-2 text-sm text-[#E8EDEB] focus:outline-none focus:border-[#0B7D7B]/50"
                        >
                          <option value="">No category</option>
                          {categoryList.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 justify-end pt-4 border-t border-[#222B29]/50">
                      <button
                        type="button"
                        onClick={resetForm}
                        className="bg-[#222B29] hover:bg-[#2D3835] text-[#839592] hover:text-[#E8EDEB] px-5 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-[#0E685E] hover:bg-[#0B7D7B] text-white px-5 py-2 rounded-lg text-sm font-medium transition"
                      >
                        {editingTask ? 'Save Changes' : 'Create Task'}
                      </button>
                    </div>
                  </form>

                  {/* Right Lane: Worknotes & Activity */}
                  <div className="border-t md:border-t-0 md:border-l border-[#222B29]/50 pt-6 md:pt-0 md:pl-6 h-full flex flex-col min-h-0">
                    {!editingTask ? (
                      <div className="bg-[#0B0F14]/50 border border-dashed border-[#222B29] rounded-xl p-8 flex flex-col items-center justify-center text-center py-16 h-full min-h-[300px]">
                        <span className="text-3xl mb-2">💬</span>
                        <p className="text-sm font-medium text-[#839592]">Worknotes & Activity</p>
                        <p className="text-xs text-[#5B6F6B] mt-1 max-w-[220px] leading-relaxed">
                          Worknotes will be available once the task has been created.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full space-y-4">
                        <div>
                          <label className="block text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase mb-1.5 font-medium">Add Worknote</label>
                          <form onSubmit={handlePostWorknote} className="space-y-2">
                            <textarea
                              placeholder="Type a worknote..."
                              value={newWorknote}
                              onChange={(e) => setNewWorknote(e.target.value)}
                              className="w-full bg-[#0B0F14] border border-[#222B29] rounded-lg px-4 py-2.5 text-sm text-[#E8EDEB] placeholder-[#364442] focus:outline-none focus:border-[#0B7D7B]/50"
                              rows={3}
                              required
                            />
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                disabled={isPostingNote || !newWorknote.trim()}
                                className="bg-[#0E685E] hover:bg-[#0B7D7B] disabled:opacity-50 disabled:hover:bg-[#0E685E] text-white px-4 py-1.5 rounded-lg text-xs font-medium transition"
                              >
                                {isPostingNote ? 'Posting...' : 'Post Note'}
                              </button>
                            </div>
                          </form>
                        </div>

                        {/* Activity Feed */}
                        <div className="flex-1 flex flex-col min-h-0 space-y-2">
                          <h5 className="text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase border-b border-[#222B29]/30 pb-1.5">Activity Log</h5>
                          <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 space-y-3">
                            {worknotesList.length === 0 && (
                              <p className="text-xs text-[#5B6F6B] italic py-4 text-center">No activities recorded yet.</p>
                            )}
                            {worknotesList.map((note) => (
                              <div key={note.id} className="bg-[#0B0F14] border border-[#222B29]/30 rounded-xl p-3 space-y-1">
                                <p className="text-xs text-[#E8EDEB] whitespace-pre-wrap break-words leading-relaxed">{note.content}</p>
                                <div className="flex justify-end">
                                  <span className="text-[9px] text-[#5B6F6B]">
                                    {new Date(note.createdAt).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Kanban Board */}
          {viewMode === 'kanban' && (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-0">
              {KANBAN_LANES.map((lane) => {
                const tasks = tasksByStatus(lane.key);
                const theme = COLORS[lane.key as keyof typeof COLORS];
                return (
                  <div
                    key={lane.key}
                    className="bg-[#151921]/60 rounded-xl flex flex-col h-full min-h-0"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggingId !== null) handleDrop(draggingId, lane.key);
                    }}
                  >
                    {/* Column header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[#222B29]/50">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${theme.icon}`}>{lane.icon}</span>
                        <h3 className="text-sm font-semibold text-[#C8D1CE]">{lane.label}</h3>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${theme.badge}`}>
                          {tasks.length}
                        </span>
                      </div>
                      <button
                        onClick={() => { resetForm(); setFormStatus(lane.key as any); setShowForm(true); }}
                        className="text-[#5B6F6B] hover:text-white text-sm"
                      >
                        +
                      </button>
                    </div>

                    {/* Cards */}
                    <div className="p-3 space-y-2 flex-1 overflow-y-auto">
                      {tasks.length === 0 && (
                        <div className="border-2 border-dashed border-[#222B29] rounded-lg flex flex-col items-center justify-center py-8 text-[#5B6F6B]">
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
                            onClick={() => startEdit(task)}
                            className={`bg-[#151921] hover:bg-[#1C212B] border-l-[3px] ${theme.border} rounded-lg p-3 cursor-pointer hover:border-gray-700 transition group ${
                              draggingId === task.id ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Checkbox */}
                              <button
                                onClick={(e) => toggleTaskStatus(e, task)}
                                className={`mt-0.5 shrink-0 text-sm focus:outline-none transition ${
                                  task.status === 'done' ? 'text-[#0E685E]' : 'text-[#5B6F6B] hover:text-[#E8EDEB]'
                                }`}
                              >
                                {task.status === 'done' ? '✓' : '○'}
                              </button>

                              <div className="flex-1 min-w-0">
                                {/* Title */}
                                <h4 className={`text-sm font-medium leading-snug ${
                                  task.status === 'done' ? 'line-through text-[#5B6F6B]' : 'text-[#E8EDEB]'
                                }`}>
                                  {task.title}
                                </h4>

                                {/* Description */}
                                {task.description && (
                                  <p className="text-xs text-[#5B6F6B] mt-1 line-clamp-2">{task.description}</p>
                                )}

                                {/* Tags */}
                                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${theme.badge}`}>
                                    {task.status === 'done' ? '✓ Done' : STATUS_LABELS[task.status]}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#222B29] text-[#839592] flex items-center gap-1">
                                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[task.priority]}`} />
                                    {PRIORITY_LABELS[task.priority]}
                                  </span>
                                  {cat && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#222B29] text-[#839592] flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                      {cat.name}
                                    </span>
                                  )}
                                </div>

                                {/* Metadata */}
                                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#5B6F6B]">
                                  {task.dueDate && (() => {
                                    const isExpired = task.status !== 'done' && new Date(task.dueDate).getTime() < Date.now();
                                    return (
                                      <span className={isExpired ? 'text-[#EB1740] font-medium' : ''}>
                                        {isExpired ? '⚠️ Overdue ' : 'Due '}{new Date(task.dueDate).toLocaleDateString()}
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(task.id);
                                  }}
                                  className="text-[#5B6F6B] hover:text-[#EB1740] text-xs px-1"
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
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-[#151921]/60 rounded-xl border border-[#222B29]/50 overflow-hidden animate-in fade-in duration-200">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#222B29] text-[10px] font-semibold tracking-[0.12em] text-[#5B6F6B] uppercase bg-[#151921]">
                      <th className="px-6 py-4 w-12"></th>
                      <th className="px-6 py-4">Task</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Priority</th>
                      <th className="px-6 py-4">Category</th>
                      <th className="px-6 py-4">Due Date</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222B29]/30 text-sm text-[#E8EDEB]">
                    {filteredTasks.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-[#5B6F6B]">
                          <span className="text-2xl block mb-2">☰</span>
                          No tasks match filters.
                        </td>
                      </tr>
                    )}
                    {filteredTasks.map((task) => {
                      const cat = categoryList.find((c) => c.id === task.categoryId);
                      const theme = COLORS[task.status as keyof typeof COLORS] || COLORS.todo;
                      return (
                        <tr
                          key={task.id}
                          onClick={() => startEdit(task)}
                          className={`hover:bg-[#1C212B] cursor-pointer group transition border-l-[3px] ${theme.border}`}
                        >
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={(e) => toggleTaskStatus(e, task)}
                              className={`text-base shrink-0 transition focus:outline-none ${
                                task.status === 'done' ? 'text-[#0E685E]' : 'text-[#5B6F6B] hover:text-[#E8EDEB]'
                              }`}
                            >
                              {task.status === 'done' ? '✓' : '○'}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className={`font-medium transition ${
                              task.status === 'done' ? 'line-through text-[#5B6F6B]' : 'text-[#E8EDEB]'
                            }`}>
                              {task.title}
                            </div>
                            {task.description && (
                              <div className="text-xs text-[#5B6F6B] line-clamp-1 mt-0.5">
                                {task.description}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={task.status}
                              onClick={(e) => e.stopPropagation()}
                              onChange={async (e) => {
                                await tasksApi.update(task.id, { status: e.target.value as any });
                                loadTasks();
                              }}
                              className="bg-[#0B0F14] border border-[#222B29] rounded-lg px-2.5 py-1 text-xs text-[#E8EDEB] focus:outline-none focus:border-[#0B7D7B]/50"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-[#839592]">
                              <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[task.priority]}`} />
                              <span>{PRIORITY_LABELS[task.priority]}</span>
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {cat ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-[#839592] bg-[#222B29]/50 px-2 py-0.5 rounded-full border border-[#222B29]">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                {cat.name}
                              </span>
                            ) : (
                              <span className="text-xs text-[#364442]">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-[#839592]">
                            {task.dueDate ? (() => {
                              const isExpired = task.status !== 'done' && new Date(task.dueDate).getTime() < Date.now();
                              return (
                                <span className={isExpired ? 'text-[#EB1740] font-medium' : ''}>
                                  {isExpired ? '⚠️ ' : ''}{new Date(task.dueDate).toLocaleDateString()}
                                </span>
                              );
                            })() : (
                              <span className="text-[#364442]">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(task.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-[#5B6F6B] hover:text-[#EB1740] text-sm font-medium transition px-2 py-1"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
