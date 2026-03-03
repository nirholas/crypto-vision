/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
interface EnvConfig {
  // Algorand Configuration
  algorand_network: string;
  algorand_algod_api: string;
  algorand_algod: string;
  algorand_indexer_api: string;
  algorand_indexer: string;
  algorand_algod_port: string;
  algorand_indexer_port: string;
  algorand_token: string;
  algorand_agent_wallet: string;

  // NFDomains Configuration
  nfd_api_url: string;
  nfd_api_key: string;

  // Tinyman Configuration
  tinyman_active: string;

  // Vestige Configuration
  vestige_active: string;
  vestige_api_url: string;
  vestige_api_key: string;

  // Ultrade Configuration
  ultrade_active: string;
  ultrade_api_url: string;


  // Pagination Configuration
  items_per_page: number;
  
}

export const env: EnvConfig = {
  // Algorand Configuration
  algorand_network: process.env.ALGORAND_NETWORK || 'testnet',
  algorand_algod_api: process.env.ALGORAND_ALGOD_API || 'https://testnet-api.algonode.cloud/v2',
  algorand_algod: process.env.ALGORAND_ALGOD || 'https://testnet-api.algonode.cloud',
  algorand_indexer_api: process.env.ALGORAND_INDEXER_API || 'https://testnet-idx.algonode.cloud/v2',
  algorand_indexer: process.env.ALGORAND_INDEXER || 'https://testnet-idx.algonode.cloud',
  algorand_algod_port: process.env.ALGORAND_ALGOD_PORT || '',
  algorand_indexer_port: process.env.ALGORAND_INDEXER_PORT || '',
  algorand_token: process.env.ALGORAND_TOKEN || '',
  algorand_agent_wallet: process.env.ALGORAND_AGENT_WALLET || process.env.ALGORAND_AGENT_WALLET_ACTIVE || '',

  // NFDomains Configuration
  nfd_api_url: process.env.NFD_API_URL || 'https://api.nf.domains',
  nfd_api_key: process.env.NFD_API_KEY || '',

  tinyman_active: process.env.TINYMAN_ACTIVE || 'false',
  // Vestige Configuration
  vestige_active: process.env.VESTIGE_ACTIVE || 'false',
  vestige_api_url: process.env.VESTIGE_API_URL || 'https://api.vestigelabs.org',
  vestige_api_key: process.env.VESTIGE_API_KEY || '',

  // Ultrade Configuration
  ultrade_active: process.env.ULTRADE_ACTIVE || 'false',
  ultrade_api_url: process.env.ULTRADE_API_URL || 'https://api.testnet.ultrade.org',


  // Pagination Configuration
  items_per_page: parseInt(process.env.ITEMS_PER_PAGE || '5', 10)
};
