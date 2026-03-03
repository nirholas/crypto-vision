/**
 * Typed fetch utilities to avoid TypeScript's unknown return from response.json()
 */

export async function fetchJson<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
  return data as T;
}

export async function fetchJsonSafe<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      return { data: null, error: new Error(`HTTP ${response.status}: ${response.statusText}`) };
    }
    const data = await response.json();
    return { data: data as T, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export async function fetchWithTimeout<T>(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs = 10000, ...fetchOptions } = options || {};
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
