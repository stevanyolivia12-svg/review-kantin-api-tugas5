import type {
  AuthSession,
  AuthUser,
  AuditLog,
  Flag,
  Like,
  ManagedUser,
  MenuItem,
  MenuItemInput,
  PageMeta,
  Review,
  Stall,
  StallInput,
  StallList,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiEnvelope<T> {
  status: string;
  data: T;
  meta?: PageMeta;
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
}

async function request<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    token?: string | null;
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abortFromCaller();
  else options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeoutId = window.setTimeout(
    () => controller.abort(new DOMException('Permintaan melewati batas waktu.', 'TimeoutError')),
    REQUEST_TIMEOUT_MS,
  );

  try {
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      if (controller.signal.reason instanceof DOMException && controller.signal.reason.name === 'TimeoutError') {
        throw new Error('Permintaan terlalu lama. Periksa koneksi internet atau server, lalu coba lagi.');
      }
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new Error('Backend tidak dapat dihubungi. Pastikan server API sedang berjalan.');
    }

    let payload: ApiEnvelope<T>;
    try {
      payload = (await response.json()) as ApiEnvelope<T>;
    } catch {
      if (controller.signal.reason instanceof DOMException && controller.signal.reason.name === 'TimeoutError') {
        throw new Error('Permintaan terlalu lama. Periksa koneksi internet atau server, lalu coba lagi.');
      }
      throw new ApiError('Backend mengirim respons yang tidak dapat dibaca.', response.status);
    }

    if (!response.ok) {
      const validation = payload.errors?.map((item) => item.message).filter(Boolean).join(' ');
      throw new ApiError(
        validation || payload.message || `Permintaan gagal (${response.status}).`,
        response.status,
      );
    }

    return payload;
  } finally {
    window.clearTimeout(timeoutId);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function listStalls(
  params: { page: number; limit: number; search?: string; category?: string },
  token?: string | null,
  signal?: AbortSignal,
): Promise<StallList> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);

  const response = await request<Stall[]>(`/stalls?${query}`, { token, signal });
  if (!response.meta) throw new ApiError('Respons daftar warung tidak memiliki informasi halaman.', 200);
  return { data: response.data, meta: response.meta };
}

export async function listAllStalls(token?: string | null): Promise<Stall[]> {
  const first = await listStalls({ page: 1, limit: 100 }, token);
  const pages = Math.ceil(first.meta.total / first.meta.limit);
  if (pages <= 1) return first.data;

  const remaining = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      listStalls({ page: index + 2, limit: 100 }, token),
    ),
  );
  return [first.data, ...remaining.map((page) => page.data)].flat();
}

export async function getStall(id: string, token?: string | null): Promise<Stall> {
  const response = await request<Stall>(`/stalls/${encodeURIComponent(id)}`, { token });
  return response.data;
}

export async function createStall(input: StallInput, token: string): Promise<Stall> {
  const response = await request<Stall>('/stalls', { method: 'POST', token, body: input });
  return response.data;
}

export async function updateStall(id: number, input: StallInput, token: string): Promise<Stall> {
  const response = await request<Stall>(`/stalls/${id}`, { method: 'PUT', token, body: input });
  return response.data;
}

export async function deleteStall(id: number, token: string): Promise<Stall> {
  const response = await request<Stall>(`/stalls/${id}`, { method: 'DELETE', token });
  return response.data;
}

export async function login(email: string, password: string): Promise<AuthSession> {
  const response = await request<AuthSession>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  return response.data;
}

export async function logout(token: string): Promise<void> {
  await request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST', token });
}

export async function register(name: string, email: string, password: string): Promise<AuthSession> {
  const response = await request<AuthSession>('/auth/register', {
    method: 'POST',
    body: { name, email, password },
  });
  return response.data;
}

export async function getCurrentUser(token: string): Promise<AuthUser> {
  const response = await request<AuthUser>('/auth/me', { token });
  return response.data;
}

export async function listMenus(): Promise<MenuItem[]> {
  const response = await request<MenuItem[]>('/menu-items');
  return response.data;
}

export async function getStallMenus(stallId: number): Promise<MenuItem[]> {
  const response = await request<MenuItem[]>(`/stalls/${stallId}/menus`);
  return response.data;
}

export async function createMenu(input: MenuItemInput, token: string): Promise<MenuItem> {
  const response = await request<MenuItem>('/menu-items', { method: 'POST', token, body: input });
  return response.data;
}

export async function updateMenu(id: number, input: MenuItemInput, token: string): Promise<MenuItem> {
  const response = await request<MenuItem>(`/menu-items/${id}`, { method: 'PUT', token, body: input });
  return response.data;
}

export async function deleteMenu(id: number, token: string): Promise<MenuItem> {
  const response = await request<MenuItem>(`/menu-items/${id}`, { method: 'DELETE', token });
  return response.data;
}

export async function listReviews(stallId?: number): Promise<Review[]> {
  const query = stallId ? `?stallId=${stallId}` : '';
  const response = await request<Review[]>(`/reviews${query}`);
  return response.data;
}

export async function createReview(
  input: { stallId: number; rating: number; comment: string | null },
  token: string,
): Promise<Review> {
  const response = await request<Review>('/reviews', { method: 'POST', token, body: input });
  return response.data;
}

export async function deleteReview(id: number, token: string): Promise<Review> {
  const response = await request<Review>(`/reviews/${id}`, { method: 'DELETE', token });
  return response.data;
}

export async function listMyLikes(token: string): Promise<Like[]> {
  const response = await request<Like[]>('/likes', { token });
  return response.data;
}

export async function createLike(reviewId: number, token: string): Promise<Like> {
  const response = await request<Like>('/likes', { method: 'POST', token, body: { reviewId } });
  return response.data;
}

export async function deleteLike(id: number, token: string): Promise<Like> {
  const response = await request<Like>(`/likes/${id}`, { method: 'DELETE', token });
  return response.data;
}

export async function createFlag(
  input: { reviewId: number; reason: string | null },
  token: string,
): Promise<Flag> {
  const response = await request<Flag>('/flags', { method: 'POST', token, body: input });
  return response.data;
}

export async function listFlags(token: string, status?: Flag['status']): Promise<Flag[]> {
  const query = status ? `?status=${status}` : '';
  const response = await request<Flag[]>(`/flags${query}`, { token });
  return response.data;
}

export async function updateFlag(
  id: number,
  status: Flag['status'],
  token: string,
): Promise<Flag> {
  const response = await request<Flag>(`/flags/${id}`, { method: 'PUT', token, body: { status } });
  return response.data;
}

export async function listUsers(token: string): Promise<ManagedUser[]> {
  const response = await request<ManagedUser[]>('/users', { token });
  return response.data;
}

export async function createManagedUser(
  input: { name: string; email: string; password: string; role: ManagedUser['role'] },
  token: string,
): Promise<ManagedUser> {
  const response = await request<ManagedUser>('/users', { method: 'POST', token, body: input });
  return response.data;
}

export interface AuditLogFilters {
  page: number;
  pageSize: number;
  action?: string;
  targetTable?: string;
  targetId?: number;
  userId?: number;
  from?: string;
  to?: string;
}

export interface AuditLogPage {
  items: AuditLog[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function listAuditLogs(
  token: string,
  filters: AuditLogFilters,
  signal?: AbortSignal,
): Promise<AuditLogPage> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const response = await request<AuditLogPage>(`/audit-logs?${query}`, { token, signal });
  return response.data;
}

export async function getAuditLog(id: number, token: string): Promise<AuditLog> {
  const response = await request<AuditLog>(`/audit-logs/${id}`, { token });
  return response.data;
}
