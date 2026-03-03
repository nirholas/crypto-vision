/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { TatumApiClient } from '../api-client.js';

// Hardcoded Data API Tools
export const DATA_TOOLS = [
  {
    name: 'get_metadata',
    description: 'Fetch metadata of NFTs or multitokens by token address and IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'The blockchain to work with.',
          example: 'ethereum-mainnet'
        },
        tokenAddress: {
          type: 'string',
          description: 'The blockchain address of the NFT to get metadata for.',
          example: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623'
        },
        tokenIds: {
          type: 'string',
          description: 'The IDs of the tokens to get metadata for. It is possible to enter list of multiple IDs as a comma separated string.'
        }
      },
      required: ['chain', 'tokenAddress', 'tokenIds']
    }
  },
  {
    name: 'get_wallet_balance_by_time',
    description: 'Get native wallet balances at specific time or block.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'The blockchain to work with.',
          example: 'ethereum-mainnet'
        },
        addresses: {
          type: 'string',
          description: 'The blockchain public wallet addresses. It is possible to enter list of up to 10 addresses as a comma separated string.'
        },
        blockNumber: {
          type: 'string',
          description: 'Block number.'
        },
        time: {
          type: 'string',
          description: 'Time when block is processed.'
        },
        unix: {
          type: 'number',
          description: 'Unix timestamp when block is processed.'
        }
      },
      required: ['chain', 'addresses']
    }
  },
  {
    name: 'get_wallet_portfolio',
    description: 'Get detailed portfolio of native, fungible, and NFT tokens for a wallet.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'The blockchain to work with.',
          example: 'ethereum-mainnet'
        },
        addresses: {
          type: 'string',
          description: 'The blockchain public wallet addresses. Only one address is allowed.'
        },
        tokenTypes: {
          type: 'string',
          description: 'The option to select only specific token types. Use [native], [fungible] (ERC-20), [nft,multitoken] (includes ERC-721 and ERC-1155)',
          enum: ['native', 'fungible', 'nft,multitoken']
        },
        excludeMetadata: {
          type: 'string',
          description: 'The option to exclude metadata from the response.'
        },
        pageSize: {
          type: 'string',
          description: 'The number of items per page (default is 50).',
          example: '10'
        },
        offset: {
          type: 'string',
          description: 'The offset to obtain next page of the data.',
          example: '0'
        }
      },
      required: ['chain', 'addresses', 'tokenTypes']
    }
  },
  {
    name: 'get_owners',
    description: 'Get all addresses owning a specific NFT, multitoken, or ERC-20.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'The blockchain to work with.',
          example: 'ethereum-mainnet'
        },
        tokenAddress: {
          type: 'string',
          description: 'The blockchain address of the token (NFT collection or any fungible token).',
          example: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623'
        },
        tokenId: {
          type: 'string',
          description: 'The ID of a specific NFT token.'
        },
        pageSize: {
          type: 'string',
          description: 'The number of items per page (default is 50).',
          example: '10'
        },
        offset: {
          type: 'string',
          description: 'The offset to obtain next page of the data.',
          example: '0'
        }
      },
      required: ['chain', 'tokenAddress']
    }
  },
  {
    name: 'check_owner',
    description: 'Check if a wallet owns a specific token or NFT.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'The blockchain to work with.',
          example: 'ethereum-mainnet'
        },
        address: {
          type: 'string',
          description: 'The blockchain address of the wallet.',
          example: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623'
        },
        tokenAddress: {
          type: 'string',
          description: 'The blockchain address of the token (NFT collection or any fungible token).',
          example: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623'
        },
        tokenId: {
          type: 'string',
          description: 'The ID of a specific NFT token.'
        }
      },
      required: ['chain', 'address', 'tokenAddress']
    }
  },
  {
    name: 'get_transaction_history',
    description: 'Get all transactions for a wallet with optional filters.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'The blockchain to work with.',
          example: 'ethereum-mainnet'
        },
        addresses: {
          type: 'string',
          description: 'The blockchain public wallet addresses. Only one address is allowed.'
        },
        transactionTypes: {
          type: 'string',
          description: 'The option to filter transaction based on types. It is possible to enter list of multiple types as a comma separated string. Use fungible (ERC-20), nft (ERC-721 and ERC-1155), multitoken (ERC-1155) or native.',
          enum: ['fungible', 'nft', 'multitoken', 'native']
        },
        transactionSubtype: {
          type: 'string',
          description: 'The option to filter transaction based on subtype.',
          enum: ['incoming', 'outgoing', 'zero-transfer']
        },
        tokenAddress: {
          type: 'string',
          description: 'Address of a token (smart contract).',
          example: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623'
        },
        tokenId: {
          type: 'string',
          description: 'ID of a token.'
        },
        blockFrom: {
          type: 'string',
          description: 'Transactions from this block onwards will be included. If blockTo is not specified, it is automatically calculated as blockFrom + 1000.'
        },
        blockTo: {
          type: 'string',
          description: 'Transactions up to this block will be included. If blockFrom is not specified, it is automatically calculated as blockTo - 1000.'
        },
        pageSize: {
          type: 'string',
          description: 'The number of items per page (default is 50).',
          example: '10'
        },
        offset: {
          type: 'string',
          description: 'The offset to obtain next page of the data.',
          example: '0'
        },
        cursor: {
          type: 'string',
          description: 'The cursor to obtain previous page or next page of the data. Available only for Tezos blockchain.'
        },
        sort: {
          type: 'string',
          description: 'Sorting of the transactions. ASC - oldest first, DESC - newest first.',
          enum: ['ASC', 'DESC']
        }
      },
      required: ['chain']
    }
  },
  {
    name: 'get_block_by_time',
    description: 'Get block number closest to a given time or timestamp.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'The blockchain to work with.',
          example: 'ethereum-mainnet'
        },
        time: {
          type: 'string',
          description: 'Time when block is processed.'
        },
        unix: {
          type: 'number',
          description: 'Unix timestamp when block is processed.'
        }
      },
      required: ['chain']
    }
  },
  {
    name: 'get_tokens',
    description: 'Get metadata for any token, including NFTs and multitokens.',
    inputSchema: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'The blockchain to work with.',
          example: 'ethereum-mainnet'
        },
        tokenAddress: {
          type: 'string',
          description: 'The blockchain address of the token (NFT collection or any fungible token) or \'native\' keyword to get information about the native currency of the chain.',
          example: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623'
        },
        tokenId: {
          type: 'string',
          description: 'The ID of a specific NFT token.'
        }
      },
      required: ['chain', 'tokenAddress']
    }
  },
  {
    name: 'check_malicious_address',
    description: 'Check if a blockchain address is flagged as malicious.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Blockchain Address to check',
          example: '0xba30E5F9Bb24caa003E9f2f0497Ad287FDF95623'
        }
      },
      required: ['address']
    }
  },
  {
    name: 'get_exchange_rate',
    description: 'Get current exchange rate for a specific cryptocurrency symbol.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'The cryptocurrency symbol to get exchange rate for.',
          example: 'ETH'
        },
        basePair: {
          type: 'string',
          description: 'The base pair to get exchange rate for.',
          example: 'USD'
        }
      },
      required: ['symbol', 'basePair']
    }
  }
];

export class DataService {
  constructor(private apiClient: TatumApiClient) {}

  async getMetadata(args: any): Promise<any> {
    const url = `/v4/data/metadata`;
    const parameters = {
      chain: args.chain,
      tokenAddress: args.tokenAddress,
      tokenIds: args.tokenIds
    };
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async getWalletBalanceByTime(args: any): Promise<any> {
    const url = `/v4/data/wallet/balance/time`;
    const parameters: any = {
      chain: args.chain,
      addresses: args.addresses
    };
    if (args.blockNumber) parameters.blockNumber = args.blockNumber;
    if (args.time) parameters.time = args.time;
    if (args.unix) parameters.unix = args.unix;
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async getWalletPortfolio(args: any): Promise<any> {
    const url = `/v4/data/wallet/portfolio`;
    const parameters: any = {
      chain: args.chain,
      addresses: args.addresses,
      tokenTypes: args.tokenTypes
    };
    if (args.excludeMetadata !== undefined) parameters.excludeMetadata = args.excludeMetadata;
    if (args.pageSize) parameters.pageSize = args.pageSize;
    if (args.offset) parameters.offset = args.offset;
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async getOwners(args: any): Promise<any> {
    const url = `/v4/data/owners`;
    const parameters: any = {
      chain: args.chain,
      tokenAddress: args.tokenAddress
    };
    if (args.tokenId) parameters.tokenId = args.tokenId;
    if (args.pageSize) parameters.pageSize = args.pageSize;
    if (args.offset) parameters.offset = args.offset;
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async checkOwner(args: any): Promise<any> {
    const url = `/v4/data/owners/address`;
    const parameters: any = {
      chain: args.chain,
      address: args.address,
      tokenAddress: args.tokenAddress
    };
    if (args.tokenId) parameters.tokenId = args.tokenId;
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async getTransactionHistory(args: any): Promise<any> {
    const url = `/v4/data/transactions`;
    const parameters: any = {
      chain: args.chain
    };
    if (args.addresses) parameters.addresses = args.addresses;
    if (args.transactionTypes) parameters.transactionTypes = args.transactionTypes;
    if (args.transactionSubtype) parameters.transactionSubtype = args.transactionSubtype;
    if (args.tokenAddress) parameters.tokenAddress = args.tokenAddress;
    if (args.tokenId) parameters.tokenId = args.tokenId;
    if (args.blockFrom) parameters.blockFrom = args.blockFrom;
    if (args.blockTo) parameters.blockTo = args.blockTo;
    if (args.pageSize) parameters.pageSize = args.pageSize;
    if (args.offset) parameters.offset = args.offset;
    if (args.cursor) parameters.cursor = args.cursor;
    if (args.sort) parameters.sort = args.sort;
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async getBlockByTime(args: any): Promise<any> {
    const url = `/v4/data/block/time`;
    const parameters: any = {
      chain: args.chain
    };
    if (args.time) parameters.time = args.time;
    if (args.unix) parameters.unix = args.unix;
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async getTokens(args: any): Promise<any> {
    const url = `/v4/data/tokens`;
    const parameters: any = {
      chain: args.chain,
      tokenAddress: args.tokenAddress
    };
    if (args.tokenId) parameters.tokenId = args.tokenId;
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async checkMaliciousAddress(args: any): Promise<any> {
    const url = `/v3/security/address/{address}`;
    const parameters = {
      address: args.address
    };
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }

  async getExchangeRate(args: any): Promise<any> {
    const url = `/v3/tatum/rate/${args.symbol}`;
    const parameters = {
      basePair: args.basePair
    };
    
    return await this.apiClient.executeRequest('GET', url, parameters);
  }
}