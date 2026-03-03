/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { TatumApiResponse, ToolExecutionContext } from './types.js';

export class TatumApiClient {
  private readonly client: AxiosInstance;
  private readonly context: ToolExecutionContext;

  constructor(context: ToolExecutionContext) {
    this.context = context;
    this.client = axios.create({
      baseURL: context.baseUrl,
      timeout: context.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.context.apiKey
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Only log server errors (5xx), not client errors or network issues
        if (error.response?.status >= 500) {
          console.error('API server error:', error.response?.status, error.response?.statusText);
        }
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  }

  public async executeRequest(
    method: string,
    path: string,
    parameters: Record<string, any> = {}
  ): Promise<TatumApiResponse> {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    
    if (!method || !path || !validMethods.includes(method.toUpperCase())) {
      return {
        error: 'Invalid method or path',
        status: 400,
        statusText: 'Bad Request'
      };
    }
    try {
      const config: AxiosRequestConfig = {
        method: method.toLowerCase() as any,
        url: this.buildUrl(path, parameters),
      };

      // Handle request body for POST/PUT requests
      if (['POST', 'PUT'].includes(method.toUpperCase())) {
        config.data = parameters;
      }

      const response: AxiosResponse = await this.client.request(config);

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error: any) {
      return {
        error: error.response?.data?.message ?? error.response?.statusText ?? error.message ?? 'Request failed',
        status: error.response?.status ?? 0,
        statusText: error.response?.statusText ?? 'Error'
      };
    }
  }

  private buildUrl(path: string, parameters: Record<string, any>): string {
    let url = path;
    const queryParams: string[] = [];
    const usedParams = new Set<string>();

    if (url.includes('{xApiKey}') && !parameters.xApiKey) {
      parameters.xApiKey = this.context.apiKey;
    }

    Object.keys(parameters).forEach(key => {
      const placeholder = `{${key}}`;
      if (url.includes(placeholder)) {
        url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(parameters[key]));
        usedParams.add(key);
      }
    });

    Object.keys(parameters).forEach(key => {
      if (!usedParams.has(key) && parameters[key] !== undefined && parameters[key] !== null) {
        queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`);
      }
    });

    if (queryParams.length > 0) {
      url += (url.includes('?') ? '&' : '?') + queryParams.join('&');
    }

    return url;
  }

}