/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { env } from '../../../env.js';

export const nfdTools = [
  {
    name: 'api_nfd_get_nfd',
    description: 'Get a specific NFD by name or by its application ID',
    inputSchema: {
      type: 'object',
      properties: {
        nameOrID: {
          type: 'string',
          description: 'Name of NFD or application ID'
        },
        view: {
          type: 'string',
          enum: ['tiny', 'brief', 'full'],
          description: 'View of data to return'
        },
        poll: {
          type: 'boolean',
          description: 'Use if polling waiting for state change'
        },
        nocache: {
          type: 'boolean',
          description: 'Set to true to return a never-cached result'
        }
      },
      required: ['nameOrID']
    }
  },
  {
    name: 'api_nfd_get_nfds_for_addresses',
    description: 'Get NFDs for specific addresses',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of addresses to look up'
        },
        limit: {
          type: 'integer',
          description: 'Limit the number of results'
        },
        view: {
          type: 'string',
          enum: ['tiny', 'thumbnail', 'brief', 'full'],
          description: 'View of data to return'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'api_nfd_get_nfd_activity',
    description: 'Get activity/changes for NFDs',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Array of NFD names to get activity for'
        },
        type: {
          type: 'string',
          enum: ['changes'],
          description: 'Type of activity to retrieve'
        },
        afterTime: {
          type: 'string',
          format: 'date-time',
          description: 'Get activity after this time'
        },
        limit: {
          type: 'integer',
          description: 'Limit the number of results'
        },
        sort: {
          type: 'string',
          enum: ['timeDesc', 'timeAsc'],
          description: 'Sort order'
        }
      },
      required: ['name']
    }
  },
  {
    name: 'api_nfd_get_nfd_analytics',
    description: 'Get analytics data for NFDs',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'NFD name to filter on'
        },
        buyer: {
          type: 'string',
          description: 'Buyer address to filter on'
        },
        seller: {
          type: 'string',
          description: 'Seller address to filter on'
        },
        event: {
          type: 'array',
          items: {
            type: 'string'
          },
          description: 'Events to filter on'
        },
        requireBuyer: {
          type: 'boolean',
          description: 'Whether buyer must be present'
        },
        includeOwner: {
          type: 'boolean',
          description: 'Whether to include current owner'
        },
        excludeNFDAsSeller: {
          type: 'boolean',
          description: 'Whether to exclude NFDomains as seller'
        },
        category: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['curated', 'premium', 'common']
          }
        },
        minPrice: {
          type: 'integer',
          description: 'Minimum price'
        },
        maxPrice: {
          type: 'integer',
          description: 'Maximum price'
        },
        limit: {
          type: 'integer',
          description: 'Limit the number of results'
        },
        offset: {
          type: 'integer',
          description: 'Offset for pagination'
        },
        sort: {
          type: 'string',
          enum: ['timeDesc', 'priceAsc', 'priceDesc'],
          description: 'Sort order'
        }
      }
    }
  },
  {
    name: 'api_nfd_browse_nfds',
    description: 'Browse NFDs with various filters',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name to filter on'
        },
        category: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['curated', 'premium', 'common']
          }
        },
        saleType: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['auction', 'buyItNow']
          }
        },
        state: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['reserved', 'forSale', 'owned', 'expired']
          }
        },
        owner: {
          type: 'string',
          description: 'Owner address to filter on'
        },
        minPrice: {
          type: 'integer',
          description: 'Minimum price'
        },
        maxPrice: {
          type: 'integer',
          description: 'Maximum price'
        },
        limit: {
          type: 'integer',
          description: 'Limit the number of results'
        },
        offset: {
          type: 'integer',
          description: 'Offset for pagination'
        },
        sort: {
          type: 'string',
          enum: ['createdDesc', 'timeChangedDesc', 'soldDesc', 'priceAsc', 'priceDesc', 'highestSaleDesc', 'saleTypeAsc'],
          description: 'Sort order'
        },
        view: {
          type: 'string',
          enum: ['tiny', 'brief', 'full'],
          description: 'View of data to return'
        }
      }
    }
  },
  {
    name: 'api_nfd_search_nfds',
    description: 'Search NFDs with various filters',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name to search for'
        },
        category: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['curated', 'premium', 'common']
          }
        },
        saleType: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['auction', 'buyItNow']
          }
        },
        state: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['reserved', 'forSale', 'owned', 'expired']
          }
        },
        owner: {
          type: 'string',
          description: 'Owner address to filter on'
        },
        minPrice: {
          type: 'integer',
          description: 'Minimum price'
        },
        maxPrice: {
          type: 'integer',
          description: 'Maximum price'
        },
        limit: {
          type: 'integer',
          description: 'Limit the number of results'
        },
        offset: {
          type: 'integer',
          description: 'Offset for pagination'
        },
        sort: {
          type: 'string',
          enum: ['createdDesc', 'timeChangedDesc', 'soldDesc', 'priceAsc', 'priceDesc', 'highestSaleDesc', 'saleTypeAsc'],
          description: 'Sort order'
        },
        view: {
          type: 'string',
          enum: ['tiny', 'brief', 'full'],
          description: 'View of data to return'
        }
      }
    }
  }
];

interface NFDProperties {
  internal?: Record<string, string>;
  userDefined?: Record<string, string>;
  verified?: Record<string, string>;
}

interface NFDRecord {
  name: string;
  appID?: number;
  asaID?: number;
  avatarOutdated?: boolean;
  caAlgo?: string[];
  category?: 'curated' | 'premium' | 'common';
  currentAsOfBlock?: number;
  depositAccount?: string;
  expired?: boolean;
  metaTags?: string[];
  nfdAccount?: string;
  owner?: string;
  parentAppID?: number;
  properties?: NFDProperties;
  reservedFor?: string;
  saleType?: 'auction' | 'buyItNow';
  sellAmount?: number;
  seller?: string;
  sigNameAddress?: string;
  state?: 'available' | 'minting' | 'reserved' | 'forSale' | 'owned' | 'expired';
  tags?: string[];
  timeChanged?: string;
  timeCreated?: string;
  timeExpires?: string;
  timePurchased?: string;
  unverifiedCa?: Record<string, string[]>;
  unverifiedCaAlgo?: string[];
}



async function getNFD(
  params: { nameOrID: string; view?: 'tiny' | 'brief' | 'full'; poll?: boolean; nocache?: boolean }
): Promise<NFDRecord> {
  try {
    const searchParams = new URLSearchParams();
    if (params.view) searchParams.append('view', params.view);
    if (params.poll) searchParams.append('poll', params.poll.toString());
    if (params.nocache) searchParams.append('nocache', params.nocache.toString());
    
    const response = await fetch(`${env.nfd_api_url}/nfd/${params.nameOrID}?${searchParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get NFD: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function getNFDsForAddressesV2(
  params: {
    address: string[];
    limit?: number;
    view?: 'tiny' | 'thumbnail' | 'brief' | 'full';
  }
): Promise<Record<string, NFDRecord[]>> {
  try {
    const searchParams = new URLSearchParams();
    params.address.forEach(addr => searchParams.append('address', addr));
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.view) searchParams.append('view', params.view);
    
    const response = await fetch(`${env.nfd_api_url}/nfd/v2/address?${searchParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get NFDs for addresses: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function searchNFDsV2(
  params: {
    name?: string;
    category?: ('curated' | 'premium' | 'common')[];
    saleType?: ('auction' | 'buyItNow')[];
    state?: ('reserved' | 'forSale' | 'owned' | 'expired')[];
    parentAppID?: number;
    length?: string[];
    traits?: ('emoji' | 'pristine' | 'segment')[];
    owner?: string;
    reservedFor?: string;
    prefix?: string;
    substring?: string;
    vproperty?: string;
    vvalue?: string;
    minPrice?: number;
    maxPrice?: number;
    changedAfter?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    view?: 'tiny' | 'brief' | 'full';
  }
): Promise<{ total: number; nfds: NFDRecord[] }> {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v.toString()));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const response = await fetch(`${env.nfd_api_url}/nfd/v2/search?${searchParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to search NFDs: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function browseNFDs(
  params: {
    name?: string;
    category?: ('curated' | 'premium' | 'common')[];
    saleType?: ('auction' | 'buyItNow')[];
    state?: ('reserved' | 'forSale' | 'owned' | 'expired')[];
    parentAppID?: number;
    length?: string[];
    traits?: ('emoji' | 'pristine' | 'segment')[];
    owner?: string;
    reservedFor?: string;
    prefix?: string;
    substring?: string;
    vproperty?: string;
    vvalue?: string;
    minPrice?: number;
    maxPrice?: number;
    changedAfter?: string;
    limit?: number;
    offset?: number;
    sort?: string;
    view?: 'tiny' | 'brief' | 'full';
  }
): Promise<NFDRecord[]> {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v.toString()));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const response = await fetch(`${env.nfd_api_url}/nfd/browse?${searchParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to browse NFDs: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function getNFDActivity(
  params: {
    name: string[];
    type?: 'changes';
    afterTime?: string;
    limit?: number;
    sort?: 'timeDesc' | 'timeAsc';
  }
): Promise<{
  block: number;
  changes: Record<string, string>;
  name: string;
  timeChanged: string;
}[]> {
  try {
    const searchParams = new URLSearchParams();
    params.name.forEach(n => searchParams.append('name', n));
    if (params.type) searchParams.append('type', params.type);
    if (params.afterTime) searchParams.append('afterTime', params.afterTime);
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.sort) searchParams.append('sort', params.sort);
    
    const response = await fetch(`${env.nfd_api_url}/nfd/activity?${searchParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get NFD activity: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function getNFDAnalytics(
  params: {
    name?: string;
    buyer?: string;
    seller?: string;
    event?: string[];
    requireBuyer?: boolean;
    includeOwner?: boolean;
    excludeNFDAsSeller?: boolean;
    category?: string[];
    saleType?: string[];
    length?: string[];
    traits?: string[];
    parentAppID?: number;
    minPrice?: number;
    maxPrice?: number;
    afterTime?: string;
    limit?: number;
    offset?: number;
    sort?: 'timeDesc' | 'priceAsc' | 'priceDesc';
  }
): Promise<{
  total: number;
  results: {
    data: {
      block: number;
      buyer?: string;
      carryCost?: number;
      category?: string;
      currentOwner?: string;
      event: string;
      groupID?: string;
      metaTags?: string[];
      name: string;
      newExpTime?: string;
      note?: string;
      oneYearRenewalPrice?: number;
      saleType?: string;
      seller?: string;
    };
    price: number;
    priceUsd?: number;
    timestamp: string;
  }[];
}> {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v.toString()));
        } else {
          searchParams.append(key, value.toString());
        }
      }
    });
    
    const response = await fetch(`${env.nfd_api_url}/nfd/analytics?${searchParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to get NFD analytics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleNFDTools(name: string, args: any): Promise<any> {
  try {
    let result;
    switch (name) {
      case 'api_nfd_get_nfd': {
        result = await getNFD(args);
        break;
      }
      case 'api_nfd_get_nfds_for_addresses': {
        result = await getNFDsForAddressesV2(args);
        break;
      }
      case 'api_nfd_get_nfd_activity': {
        result = await getNFDActivity(args);
        break;
      }
      case 'api_nfd_get_nfd_analytics': {
        result = await getNFDAnalytics(args);
        break;
      }
      case 'api_nfd_browse_nfds': {
        result = await browseNFDs(args);
        break;
      }
      case 'api_nfd_search_nfds': {
        result = await searchNFDsV2(args);
        break;
      }
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
    return result
  } catch (error) {
    if (error instanceof McpError) {
      throw error;
    }
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to handle NFD tool: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
