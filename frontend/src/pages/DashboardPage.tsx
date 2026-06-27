import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { tasks as tasksApi, categories as categoriesApi, type Task, type Category } from '../api/client';

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-gray-600',
  medium: 'bg-blue-500',
  high: 'bg-orange-500',
  urgent: 'bg-red-500',
};

const STATUS_OPTIONS = ['todo', 'in_progress', 'done'] as const;
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'] as const;

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [taskList, setTaskList] = useState<Task[]>([]);
  const [categoryList, setCategoryList] = useState<Category[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [formPriority, setFormPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number | ''>('');

  // Category form
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#6366f1');

  const loadTasks = async () => {
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (filterPriority) params.priority = filterPriority;
    if (filterCategory) params.categoryId = filterCategory;
    const data = await tasksApi.list(params);
    setTaskList(data.tasks);
  };

  const loadCategories = async () => {
    const data = await categoriesApi.list();
    setCategoryList(data.categories);
  };

  useEffect(() => {
    loadTasks();
    loadCategories();
  }, [filterStatus, filterPriority, filterCategory]);

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

      <div className="max-w-5xl mx-auto p-6">
        {/* Filters + Actions */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All priorities</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">All categories</option>
            {categoryList.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="ml-auto bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 rounded-lg text-sm font-medium transition"
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

        {/* Task List */}
        <div className="space-y-2">
          {taskList.length === 0 && (
            <p className="text-gray-500 text-center py-12">No tasks yet. Create one!</p>
          )}
          {taskList.map((task) => {
            const cat = categoryList.find((c) => c.id === task.categoryId);
            return (
              <div
                key={task.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[task.priority]}`} />
                      <h3 className={`font-medium ${task.status === 'done' ? 'line-through text-gray-500' : ''}`}>
                        {task.title}
                      </h3>
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-500 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full bg-gray-800 capitalize`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      <span className="capitalize">{task.priority}</span>
                      {cat && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                      )}
                      {task.dueDate && (
                        <span>
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => startEdit(task)}
                      className="text-gray-500 hover:text-white text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-gray-500 hover:text-red-400 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
