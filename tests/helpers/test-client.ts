/**
 * Test Client — HTTP client with auth helpers for integration/E2E tests.
 *
 * Wraps fetch() with:
 * - Automatic API key injection
 * - Configurable timeout & abort
 * - JSON helpers
 * - Base URL management
 */

/** Configuration for creating a test client. */
export interface TestClientConfig {
  /** Server base URL, e.g. http://localhost:54321 */
  baseUrl: string;
  /** API key for X-API-Key header */
  apiKey?: string;
  /** Default timeout per request in ms (default: 15 000) */
  timeout?: number;
}

/** Typed response wrapper. */
export interface TypedResponse<T = unknown> {
  status: number;
  headers: Headers;
  body: T;
  raw: Response;
  ok: boolean;
}

export class TestClient {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly defaultTimeout: number;

  constructor(config: TestClientConfig) {
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey ?? "";
    this.defaultTimeout = config.timeout ?? 15_000;
  }

  /** Build headers with optional overrides. */
  private buildHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (this.apiKey && !headers.has("X-API-Key")) {
      headers.set("X-API-Key", this.apiKey);
    }
    return headers;
  }

  /** Perform a GET request. */
  async get<T = unknown>(
    path: string,
    options?: { headers?: HeadersInit; timeout?: number },
  ): Promise<TypedResponse<T>> {
    return this.request<T>("GET", path, undefined, options);
  }

  /** Perform a POST request with a JSON body. */
  async post<T = unknown>(
    path: string,
    body: unknown,
    options?: { headers?: HeadersInit; timeout?: number },
  ): Promise<TypedResponse<T>> {
    return this.request<T>("POST", path, body, options);
  }

  /** Perform a PUT request with a JSON body. */
  async put<T = unknown>(
    path: string,
    body: unknown,
    options?: { headers?: HeadersInit; timeout?: number },
  ): Promise<TypedResponse<T>> {
    return this.request<T>("PUT", path, body, options);
  }

  /** Perform a DELETE request. */
  async delete<T = unknown>(
    path: string,
    options?: { headers?: HeadersInit; timeout?: number },
  ): Promise<TypedResponse<T>> {
    return this.request<T>("DELETE", path, undefined, options);
  }

  /** Perform a PATCH request with a JSON body. */
  async patch<T = unknown>(
    path: string,
    body: unknown,
    options?: { headers?: HeadersInit; timeout?: number },
  ): Promise<TypedResponse<T>> {
    return this.request<T>("PATCH", path, body, options);
  }

  /** Create a new client with a different API key (or no key). */
  withApiKey(apiKey: string): TestClient {
    return new TestClient({
      baseUrl: this.baseUrl,
      apiKey,
      timeout: this.defaultTimeout,
    });
  }

  /** Create a new client with no API key for unauthenticated requests. */
  withoutAuth(): TestClient {
    return new TestClient({
      baseUrl: this.baseUrl,
      apiKey: "",
      timeout: this.defaultTimeout,
    });
  }

  /** Core request method. */
  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    options?: { headers?: HeadersInit; timeout?: number },
  ): Promise<TypedResponse<T>> {
    const controller = new AbortController();
    const timeoutMs = options?.timeout ?? this.defaultTimeout;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers = this.buildHeaders(options?.headers);

    const init: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body !== undefined) {
      if (!headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }
      init.body = JSON.stringify(body);
    }

    try {
      const raw = await fetch(`${this.baseUrl}${path}`, init);
      const contentType = raw.headers.get("content-type") ?? "";

      let responseBody: T;
      if (contentType.includes("application/json")) {
        responseBody = (await raw.json()) as T;
      } else {
        responseBody = (await raw.text()) as unknown as T;
      }

      return {
        status: raw.status,
        headers: raw.headers,
        body: responseBody,
        raw,
        ok: raw.ok,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Create a test client for the given base URL and API key.
 * Convenience factory for common use cases.
 */
export function createTestClient(
  baseUrl: string,
  apiKey?: string,
): TestClient {
  return new TestClient({ baseUrl, apiKey });
}
