/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { Buffer } from 'buffer';
import { env } from '../env.js';

export interface PaginationMetadata {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  pageToken?: string;
}

export interface PaginatedResponse<T> {
  data: T;
  metadata: PaginationMetadata & {
    arrayField?: string;
  };
}

export interface ProcessedResponse {
  [key: string]: any;
  content?: any[];
  metadata?: PaginationMetadata & {
    arrayField?: string;
  };
}

export class ResponseProcessor {
  private static generateNextPageToken(page: number): string {
    const token = Buffer.from(`page_${page}`).toString('base64');
    console.log('[Pagination] Generated token:', { page, token });
    return token;
  }

  private static decodePageToken(token: string): number {
    console.log('[Pagination] Decoding token:', token);
    try {
      const decoded = Buffer.from(token, 'base64').toString();
      console.log('[Pagination] Decoded token string:', decoded);
      const page = parseInt(decoded.replace('page_', ''));
      console.log('[Pagination] Parsed page number:', page);
      return isNaN(page) ? 1 : page;
    } catch (error) {
      console.log('[Pagination] Error decoding token:', error);
      return 1;
    }
  }

  private static shouldPaginateArray(array: any[]): boolean {
    const should = array.length > env.items_per_page;
    console.log('[Pagination] Should paginate array?', { 
      arrayLength: array.length, 
      itemsPerPage: env.items_per_page,
      shouldPaginate: should 
    });
    return should;
  }

  private static shouldPaginateObject(obj: any): boolean {
    const should = Object.keys(obj).length > env.items_per_page;
    console.log('[Pagination] Should paginate object?', {
      objectKeys: Object.keys(obj).length,
      itemsPerPage: env.items_per_page,
      shouldPaginate: should
    });
    return should;
  }

  private static paginateObject(
    obj: { [key: string]: any },
    pageToken?: string
  ): { items: { [key: string]: any }; metadata: PaginationMetadata } {
    console.log('[Pagination] Starting object pagination', { pageToken });
    const entries = Object.entries(obj);
    const totalItems = entries.length;
    const totalPages = Math.ceil(totalItems / env.items_per_page);
    const currentPage = pageToken
      ? this.decodePageToken(pageToken)
      : 1;
    
    console.log('[Pagination] Object pagination state:', { totalItems, totalPages, currentPage });
    
    const startIndex = (currentPage - 1) * env.items_per_page;
    const endIndex = startIndex + env.items_per_page;
    const hasNextPage = endIndex < totalItems;

    const paginatedEntries = entries.slice(startIndex, endIndex);
    const paginatedObject = Object.fromEntries(paginatedEntries);

    console.log('[Pagination] Object pagination result:', {
      startIndex,
      endIndex,
      hasNextPage,
      paginatedEntriesLength: paginatedEntries.length
    });

    return {
      items: paginatedObject,
      metadata: {
        totalItems,
        itemsPerPage: env.items_per_page,
        currentPage,
        totalPages,
        hasNextPage,
        ...(hasNextPage && {
          pageToken: this.generateNextPageToken(currentPage + 1),
        }),
      }
    };
  }

  private static paginateArray<T>(
    array: T[],
    pageToken?: string
  ): { items: T[]; metadata: PaginationMetadata } {
    console.log('[Pagination] Starting array pagination', { 
      arrayLength: array.length,
      pageToken 
    });
    const totalItems = array.length;
    const totalPages = Math.ceil(totalItems / env.items_per_page);
    const currentPage = pageToken
      ? this.decodePageToken(pageToken)
      : 1;
    
    console.log('[Pagination] Array pagination state:', { totalItems, totalPages, currentPage });
    
    const startIndex = (currentPage - 1) * env.items_per_page;
    const endIndex = startIndex + env.items_per_page;
    const hasNextPage = endIndex < totalItems;

    const paginatedItems = array.slice(startIndex, endIndex);
    console.log('[Pagination] Array pagination result:', {
      startIndex,
      endIndex,
      hasNextPage,
      itemsCount: paginatedItems.length
    });

    return {
      items: paginatedItems,
      metadata: {
        totalItems,
        itemsPerPage: env.items_per_page,
        currentPage,
        totalPages,
        hasNextPage,
        ...(hasNextPage && {
          pageToken: this.generateNextPageToken(currentPage + 1),
        }),
      }
    };
  }

  private static shouldSkipPagination(obj: any, key: string): boolean {
    // Skip pagination for application global-state and other special arrays
    if (obj.id && obj.params && key === 'global-state') {
      return true;
    }
    return false;
  }

  static processResponse(response: any, pageToken?: string): any {
    console.log('[ResponseProcessor] Processing response', { 
      type: Array.isArray(response) ? 'array' : typeof response,
      pageToken
    });
    // Handle array responses
    if (Array.isArray(response)) {
      const arrayResponse = response as any[];
      const { items, metadata } = this.paginateArray(arrayResponse, pageToken);
      const wrappedResponse = {
        data: items,
        metadata
      };
      console.log('[ResponseProcessor] Array response result:', {
        itemsCount: items.length,
        metadata
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(wrappedResponse, null, 2)
        }]
      };
    }
  
    // Handle object responses with array values
    if (typeof response === 'object' && response !== null) {
      console.log('[ResponseProcessor] Processing object response');
      // Create a deep copy to avoid modifying the original object
      const processed = JSON.parse(JSON.stringify(response));
      let paginatedField: string | undefined;
      let paginationMetadata: PaginationMetadata | undefined;
      
      // Process each property of the object
      for (const key in processed) {
        console.log('[ResponseProcessor] Processing field:', key);
        if (Array.isArray(processed[key])) {
          if (this.shouldPaginateArray(processed[key])) {
            const result = this.paginateArray(processed[key], pageToken);
            processed[key] = result.items;
            if (result.metadata) {
              paginatedField = key;
              paginationMetadata = result.metadata;
            }
          }
        } else if (typeof processed[key] === 'object' && processed[key] !== null) {
          // Check if the object needs pagination
          if (this.shouldPaginateObject(processed[key])) {
            const result = this.paginateObject(processed[key], pageToken);
            processed[key] = result.items;
            if (result.metadata) {
              paginatedField = key;
              paginationMetadata = result.metadata;
            }
          }
          // Recursively process nested objects
          const nestedResult = this.processResponse(processed[key], pageToken);
          
          // If the nested processing returned content with a wrapped response
          if (nestedResult.content && nestedResult.content[0] && nestedResult.content[0].text) {
            try {
              const parsedNested = JSON.parse(nestedResult.content[0].text);
              // If the nested result has data/metadata structure, preserve it
              if (parsedNested.data) {
                processed[key] = parsedNested;
              } else {
                processed[key] = parsedNested;
              }
            } catch (e) {
              processed[key] = nestedResult.content[0].text;
            }
          }
        }
      }

      // If any array was paginated, wrap the response
      if (paginationMetadata) {
        const wrappedResponse = {
          data: processed,
          metadata: {
            ...paginationMetadata,
            arrayField: paginatedField
          }
        };
        console.log('[ResponseProcessor] Object response result with pagination:', {
          paginatedField,
          metadata: paginationMetadata
        });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(wrappedResponse, null, 2)
          }]
        };
      }
  
      // If no pagination occurred, wrap in data property for consistency
      const wrappedResponse = {
        data: processed
      };
      console.log('[ResponseProcessor] Object response result without pagination');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(wrappedResponse, null, 2)
        }]
      };
    }
  
    // Return other values wrapped in data property
    const wrappedResponse = {
      data: response
    };
    console.log('[ResponseProcessor] Simple value response');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(wrappedResponse, null, 2)
      }]
    };
  }

  // Higher-order function to wrap resource tool handlers
  static wrapResourceHandler<T extends (...args: any[]) => Promise<any>>(
    handler: T
  ): T {
    return ((...args: Parameters<T>) => {
      return handler(...args);
    }) as T;
  }
}
