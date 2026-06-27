const API_BASE = '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Auth ──
export const auth = {
  register: (data: { email: string; name: string; password: string }) =>
    request<{ user: { id: number; email: string; name: string }; token: string }>('/auth/register', { method: 'POST', body: data }),
  login: (data: { email: string; password: string }) =>
    request<{ user: { id: number; email: string; name: string }; token: string }>('/auth/login', { method: 'POST', body: data }),
  me: () => request<{ user: { id: number; email: string; name: string } }>('/auth/me'),
  searchUsers: (q: string) => request<{ users: { id: number; name: string; email: string }[] }>(`/auth/users?q=${encodeURIComponent(q)}`),
};

// ── Tasks ──
export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'on_hold' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  startDate: string | null;
  dueDate: string | null;
  categoryId: number | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
  position: number;
}

export interface Worknote {
  id: number;
  taskId: number;
  content: string;
  createdAt: string;
}

export const tasks = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ tasks: Task[] }>(`/tasks${qs}`);
  },
  get: (id: number) => request<{ task: Task }>(`/tasks/${id}`),
  create: (data: Partial<Task>) => request<{ task: Task }>('/tasks', { method: 'POST', body: data }),
  update: (id: number, data: Partial<Task>) => request<{ task: Task }>(`/tasks/${id}`, { method: 'PATCH', body: data }),
  delete: (id: number) => request<{ success: boolean }>(`/tasks/${id}`, { method: 'DELETE' }),
  getWorknotes: (taskId: number) => request<{ worknotes: Worknote[] }>(`/tasks/${taskId}/worknotes`),
  postWorknote: (taskId: number, content: string) =>
    request<{ worknote: Worknote }>(`/tasks/${taskId}/worknotes`, { method: 'POST', body: { content } }),
  reorder: (taskId: number, status: string, targetTaskId?: number) =>
    request<{ success: boolean }>('/tasks/reorder', { method: 'POST', body: { taskId, status, targetTaskId } }),
  getAssignees: (taskId: number) => request<{ assignees: { id: number; name: string; email: string }[] }>(`/tasks/${taskId}/assignees`),
  assign: (taskId: number, assigneeId: number) =>
    request<{ assignment: { id: number; taskId: number; userId: number } }>(`/tasks/${taskId}/assign`, { method: 'POST', body: { assigneeId } }),
  unassign: (taskId: number, assigneeId: number) =>
    request<{ success: boolean }>(`/tasks/${taskId}/assign/${assigneeId}`, { method: 'DELETE' }),
};

// ── Categories ──
export interface Category {
  id: number;
  name: string;
  color: string;
  userId: number;
  createdAt: string;
}

export const categories = {
  list: () => request<{ categories: Category[] }>('/categories'),
  create: (data: { name: string; color?: string }) =>
    request<{ category: Category }>('/categories', { method: 'POST', body: data }),
  update: (id: number, data: { name?: string; color?: string }) =>
    request<{ category: Category }>(`/categories/${id}`, { method: 'PATCH', body: data }),
  delete: (id: number) => request<{ success: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
};
