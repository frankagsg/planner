// Thin fetch wrapper with:
//  - JSON handling + typed errors
//  - localStorage read-through cache for offline resilience (GET only)
//  - an online/offline signal other modules can subscribe to.

const CACHE_PREFIX = 'wp:cache:';

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type Listener = (online: boolean) => void;
const listeners = new Set<Listener>();
let online = true;

export function onConnectivity(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setOnline(v: boolean) {
  if (v !== online) {
    online = v;
    listeners.forEach((l) => l(v));
  }
}
export function isOnline() {
  return online;
}

function cacheKey(path: string) {
  return CACHE_PREFIX + path;
}

export function readCache<T>(path: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(path));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(path: string, data: unknown) {
  try {
    localStorage.setItem(cacheKey(path), JSON.stringify(data));
  } catch {
    /* storage full / disabled — ignore */
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  opts: { cache?: boolean } = {}
): Promise<T> {
  const url = path.startsWith('/api') ? path : `/api${path}`;
  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setOnline(true);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const data = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      throw new ApiError(res.status, data?.error || res.statusText, data?.details);
    }
    if (method === 'GET' && opts.cache) writeCache(url, data);
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Network failure → mark offline and serve cache for cacheable GETs.
    setOnline(false);
    if (method === 'GET' && opts.cache) {
      const cached = readCache<T>(url);
      if (cached !== null) return cached;
    }
    throw new ApiError(0, 'offline');
  }
}

export const api = {
  get: <T>(path: string, cache = false) => request<T>('GET', path, undefined, { cache }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
