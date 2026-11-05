// In-Memory Client-side Request Cache
const requestCache = new Map<string, { data: any; expiry: number }>();

export const API_BASE_URL = '/api';

export class ApiError extends Error {
  code: string;
  status: number;
  retryAfter?: number;

  constructor(message: string, code: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

async function requestWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your network connection and try again.', 'TIMEOUT', 408);
    }
    if (!navigator.onLine) {
      throw new ApiError('You appear to be offline. Please connect to the internet.', 'OFFLINE', 0);
    }
    throw new ApiError('Unable to connect to service. Network error occurred.', 'NETWORK_ERROR', 0);
  }
}

export async function fetchWithCache<T>(
  endpoint: string,
  options: RequestInit = {},
  cacheTtlMs = 15000,
  token?: string | null
): Promise<T> {
  const cacheKey = `${endpoint}_${token || 'public'}`;

  // Check cache for GET requests
  if ((!options.method || options.method === 'GET') && cacheTtlMs > 0) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return cached.data as T;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await requestWithTimeout(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 60;
    throw new ApiError(
      `Rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`,
      'RATE_LIMITED',
      429,
      retryAfter
    );
  }

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      json.message || `Request failed with status ${response.status}`,
      json.error || 'SERVER_ERROR',
      response.status
    );
  }

  // Cache successful GET responses
  if ((!options.method || options.method === 'GET') && cacheTtlMs > 0) {
    requestCache.set(cacheKey, { data: json, expiry: Date.now() + cacheTtlMs });
  }

  return json as T;
}

export function invalidateClientCache(endpointPrefix?: string) {
  if (!endpointPrefix) {
    requestCache.clear();
    return;
  }
  for (const key of requestCache.keys()) {
    if (key.includes(endpointPrefix)) {
      requestCache.delete(key);
    }
  }
}
