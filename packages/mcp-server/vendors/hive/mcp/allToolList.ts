/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { Tool } from "@modelcontextprotocol/sdk/types"

export const supportedTools :Tool[]= [
  {
    "name": "asset_platforms_browser",
    "description": "This endpoint allows you to **query all the asset platforms on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "filter": {
          "type": "string",
          "description": "apply relevant filters to results",
          "enum": [
            "nft"
          ]
        }
      }
    }
  },
  {
    "name": "coins_index",
    "description": "This endpoint allows you to **query all the metadata (image, websites, socials, description, contract address, etc.) and market data (price, ATH, exchange tickers, etc.) of a coin from the HIVE_DATASOURCE_ONE coin page based on a particular coin ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "community_data": {
          "type": "boolean",
          "description": "include community data, default: true"
        },
        "developer_data": {
          "type": "boolean",
          "description": "include developer data, default: true"
        },
        "dex_pair_format": {
          "type": "string",
          "description": "set to `symbol` to display DEX pair base and target as symbols, default: `contract_address`",
          "enum": [
            "contract_address",
            "symbol"
          ]
        },
        "localization": {
          "type": "boolean",
          "description": "include all the localized languages in the response, default: true"
        },
        "market_data": {
          "type": "boolean",
          "description": "include market data, default: true"
        },
        "sparkline": {
          "type": "boolean",
          "description": "include sparkline 7 days data, default: false"
        },
        "tickers": {
          "type": "boolean",
          "description": "include tickers data, default: true"
        }
      }
    }
  },
  {
    "name": "coins_categories_browser",
    "description": "This endpoint allows you to **query all the coins categories on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "coins_list_browser",
    "description": "This endpoint allows you to **query all the supported coins on HIVE_DATASOURCE_ONE with coins ID, name and symbol**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "include_platform": {
          "type": "boolean",
          "description": "include platform and token's contract addresses, default: false"
        },
        "status": {
          "type": "string",
          "description": "filter by status of coins, default: active",
          "enum": [
            "active",
            "inactive"
          ]
        }
      }
    }
  },
  {
    "name": "new_coins_list_browser",
    "description": "This endpoint allows you to **query the latest 200 coins that recently listed on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "coins_market_data_browser",
    "description": "This endpoint allows you to **query all the supported coins with price, market cap, volume and market related data**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "vs_currency": {
          "type": "string",
          "description": "target currency of coins and market data <br> *refers to [`/simple/supported_vs_currencies`](/reference/simple-supported-currencies)."
        },
        "category": {
          "type": "string",
          "description": "filter based on coins' category <br> *refers to [`/coins/categories/list`](/reference/coins-categories-list)."
        },
        "ids": {
          "type": "string",
          "description": "coins' IDs, comma-separated if querying more than 1 coin. <br> *refers to [`/coins/list`](/reference/coins-list)."
        },
        "include_tokens": {
          "type": "string",
          "description": "for `symbols` lookups, specify `all` to include all matching tokens <br> Default `top` returns top-ranked tokens (by market cap or volume)",
          "enum": [
            "top",
            "all"
          ]
        },
        "locale": {
          "type": "string",
          "description": "language background, default: en",
          "enum": [
            "ar",
            "bg",
            "cs",
            "da",
            "de",
            "el",
            "en",
            "es",
            "fi",
            "fr",
            "he",
            "hi",
            "hr",
            "hu",
            "id",
            "it",
            "ja",
            "ko",
            "lt",
            "nl",
            "no",
            "pl",
            "pt",
            "ro",
            "ru",
            "sk",
            "sl",
            "sv",
            "th",
            "tr",
            "uk",
            "vi",
            "zh",
            "zh-tw"
          ]
        },
        "names": {
          "type": "string",
          "description": "coins' names, comma-separated if querying more than 1 coin."
        },
        "order": {
          "type": "string",
          "description": "sort result by field, default: market_cap_desc",
          "enum": [
            "market_cap_asc",
            "market_cap_desc",
            "volume_asc",
            "volume_desc",
            "id_asc",
            "id_desc"
          ]
        },
        "page": {
          "type": "number",
          "description": "page through results, default: 1"
        },
        "per_page": {
          "type": "number",
          "description": "total results per page, default: 100 <br> Valid values: 1...250"
        },
        "precision": {
          "type": "string",
          "description": "decimal place for currency price value",
          "enum": [
            "full",
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18"
          ]
        },
        "price_change_percentage": {
          "type": "string",
          "description": "include price change percentage timeframe, comma-separated if query more than 1 price change percentage timeframe <br> Valid values: 1h, 24h, 7d, 14d, 30d, 200d, 1y"
        },
        "sparkline": {
          "type": "boolean",
          "description": "include sparkline 7 days data, default: false"
        },
        "symbols": {
          "type": "string",
          "description": "coins' symbols, comma-separated if querying more than 1 coin."
        }
      }
    }
  },
  {
    "name": "gainers_losers_browser",
    "description": "This endpoint allows you to **query the top 30 coins with largest price gain and loss by a specific time duration**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "vs_currency": {
          "type": "string",
          "description": "target currency of coins <br> *refers to [`/simple/supported_vs_currencies`](/reference/simple-supported-currencies)."
        },
        "duration": {
          "type": "string",
          "description": "filter result by time range <br> Default value: `24h`",
          "enum": [
            "1h",
            "24h",
            "7d",
            "14d",
            "30d",
            "60d",
            "1y"
          ]
        },
        "top_coins": {
          "type": "string",
          "description": "filter result by market cap ranking (top 300 to 1000) or all coins (including coins that do not have market cap) <br> Default value: `1000`",
          "enum": [
            "300",
            "500",
            "1000",
            "all"
          ]
        }
      }
    }
  },
  {
    "name": "contract_coins_browser",
    "description": "This endpoint allows you to **query all the metadata (image, websites, socials, description, contract address, etc.) and market data (price, ATH, exchange tickers, etc.) of a coin from the HIVE_DATASOURCE_ONE coin page based on an asset platform and a particular token contract address**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "contract_address": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "range_contract_coins_market_chart_browser",
    "description": "This endpoint allows you to **get the historical chart data within certain time range in UNIX along with price, market cap and 24hr volume based on asset platform and particular token contract address**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "contract_address": {
          "type": "string"
        },
        "from": {
          "type": "number",
          "description": "starting date in UNIX timestamp"
        },
        "to": {
          "type": "number",
          "description": "ending date in UNIX timestamp"
        },
        "vs_currency": {
          "type": "string",
          "description": "target currency of market data <br> *refers to [`/simple/supported_vs_currencies`](/reference/simple-supported-currencies)."
        },
        "interval": {
          "type": "string",
          "description": "data interval, leave empty for auto granularity",
          "enum": [
            "5m",
            "hourly",
            "daily"
          ]
        },
        "precision": {
          "type": "string",
          "description": "decimal place for currency price value",
          "enum": [
            "full",
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18"
          ]
        }
      }
    }
  },
  {
    "name": "coins_history_browser",
    "description": "This endpoint allows you to **query the historical data (price, market cap, 24hrs volume, ...) at a given date for a coin based on a particular coin ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "date": {
          "type": "string",
          "description": "the date of data snapshot <br> Format: `dd-mm-yyyy`"
        },
        "localization": {
          "type": "boolean",
          "description": "include all the localized languages in response, default: true"
        }
      }
    }
  },
  {
    "name": "range_coins_market_chart_browser",
    "description": "This endpoint allows you to **get the historical chart data of a coin within certain time range in UNIX along with price, market cap and 24hr volume based on particular coin ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "from": {
          "type": "number",
          "description": "starting date in UNIX timestamp "
        },
        "to": {
          "type": "number",
          "description": "ending date in UNIX timestamp"
        },
        "vs_currency": {
          "type": "string",
          "description": "target currency of market data <br> *refers to [`/simple/supported_vs_currencies`](/reference/simple-supported-currencies)."
        },
        "interval": {
          "type": "string",
          "description": "data interval, leave empty for auto granularity",
          "enum": [
            "5m",
            "hourly",
            "daily"
          ]
        },
        "precision": {
          "type": "string",
          "description": "decimal place for currency price value",
          "enum": [
            "full",
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18"
          ]
        }
      }
    }
  },
  {
    "name": "range_coins_ohlc_browser",
    "description": "This endpoint allows you to **get the OHLC chart (Open, High, Low, Close) of a coin within a range of timestamp based on particular coin ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "from": {
          "type": "number",
          "description": "starting date in UNIX timestamp"
        },
        "interval": {
          "type": "string",
          "description": "data interval",
          "enum": [
            "daily",
            "hourly"
          ]
        },
        "to": {
          "type": "number",
          "description": "ending date in UNIX timestamp"
        },
        "vs_currency": {
          "type": "string",
          "description": "target currency of price data <br> *refers to [`/simple/supported_vs_currencies`](/reference/simple-supported-currencies)."
        }
      }
    }
  },
  {
    "name": "global_browser",
    "description": "This endpoint allows you **query cryptocurrency global data including active cryptocurrencies, markets, total crypto market cap and etc**",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "id_nfts_browser",
    "description": "This endpoint allows you to **query all the NFT data (name, floor price, 24hr volume ...) based on the NFT collection ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "list_nfts_browser",
    "description": "This endpoint allows you to **query all supported NFTs with ID, contract address, name, asset platform ID and symbol on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "order": {
          "type": "string",
          "description": "use this to sort the order of responses",
          "enum": [
            "h24_volume_usd_asc",
            "h24_volume_usd_desc",
            "h24_volume_native_asc",
            "h24_volume_native_desc",
            "floor_price_native_asc",
            "floor_price_native_desc",
            "market_cap_native_asc",
            "market_cap_native_desc",
            "market_cap_usd_asc",
            "market_cap_usd_desc"
          ]
        },
        "page": {
          "type": "number",
          "description": "page through results"
        },
        "per_page": {
          "type": "number",
          "description": "total results per page <br> Valid values: 1...250"
        }
      }
    }
  },
  {
    "name": "nfts_market_chart_browser",
    "description": "This endpoint allows you **query historical market data of a NFT collection, including floor price, market cap, and 24hr volume, by number of days away from now**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "days": {
          "type": "string",
          "description": "data up to number of days <br> Valid values: any integer or max"
        }
      }
    }
  },
  {
    "name": "onchain_categories_browser",
    "description": "This endpoint allows you to **query all the supported categories on HIVE_DATASOURCE_ONE_CONSOLE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: `1`"
        },
        "sort": {
          "type": "string",
          "description": "sort the categories by field <br> Default value: `h6_volume_percentage_desc`",
          "enum": [
            "h1_volume_percentage_desc",
            "h6_volume_percentage_desc",
            "h12_volume_percentage_desc",
            "h24_tx_count_desc",
            "h24_volume_usd_desc",
            "fdv_usd_desc",
            "reserve_in_usd_desc"
          ]
        }
      }
    }
  },
  {
    "name": "pools_onchain_categories_browser",
    "description": "This endpoint allows you to **query all the pools based on the provided category ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "category_id": {
          "type": "string"
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`, `network`. <br> Example: `base_token` or `base_token,dex`"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: `1`"
        },
        "sort": {
          "type": "string",
          "description": "sort the pools by field <br> Default value: `pool_created_at_desc`",
          "enum": [
            "m5_trending",
            "h1_trending",
            "h6_trending",
            "h24_trending",
            "h24_tx_count_desc",
            "h24_volume_usd_desc",
            "pool_created_at_desc",
            "h24_price_change_percentage_desc"
          ]
        }
      }
    }
  },
  {
    "name": "onchain_networks_browser",
    "description": "This endpoint allows you to **query all the supported networks on HIVE_DATASOURCE_ONE_CONSOLE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        }
      }
    }
  },
  {
    "name": "networks_onchain_new_pools_browser",
    "description": "This endpoint allows you to **query all the latest pools across all networks on HIVE_DATASOURCE_ONE_CONSOLE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`, `network`"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        }
      }
    }
  },
  {
    "name": "network_networks_onchain_new_pools_browser",
    "description": "This endpoint allows you to **query all the latest pools based on provided network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        }
      }
    }
  },
  {
    "name": "networks_onchain_trending_pools_browser",
    "description": "This endpoint allows you to **query all the trending pools across all networks on HIVE_DATASOURCE_ONE_CONSOLE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "duration": {
          "type": "string",
          "description": "duration to sort trending list by <br> Default value: 24h",
          "enum": [
            "5m",
            "1h",
            "6h",
            "24h"
          ]
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`, `network`. <br> Example: `base_token` or `base_token,dex`"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        }
      }
    }
  },
  {
    "name": "network_networks_onchain_trending_pools_browser",
    "description": "This endpoint allows you to **query the trending pools based on the provided network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "duration": {
          "type": "string",
          "description": "duration to sort trending list by <br> Default value: 24h",
          "enum": [
            "5m",
            "1h",
            "6h",
            "24h"
          ]
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        }
      }
    }
  },
  {
    "name": "networks_onchain_dexes_browser",
    "description": "This endpoint allows you to **query all the supported decentralized exchanges (DEXs) based on the provided network on HIVE_DATASOURCE_ONE_CONSOLE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        }
      }
    }
  },
  {
    "name": "pools_networks_onchain_dexes_browser",
    "description": "This endpoint allows you to **query all the top pools based on the provided network and decentralized exchange (DEX)**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "dex": {
          "type": "string"
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        },
        "sort": {
          "type": "string",
          "description": "sort the pools by field <br> Default value: h24_tx_count_desc",
          "enum": [
            "h24_tx_count_desc",
            "h24_volume_usd_desc"
          ]
        }
      }
    }
  },
  {
    "name": "networks_onchain_pools_browser",
    "description": "This endpoint allows you to **query all the top pools based on the provided network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        },
        "sort": {
          "type": "string",
          "description": "sort the pools by field <br> Default value: h24_tx_count_desc",
          "enum": [
            "h24_tx_count_desc",
            "h24_volume_usd_desc"
          ]
        }
      }
    }
  },
  {
    "name": "address_networks_onchain_pools_browser",
    "description": "This endpoint allows you to **query the specific pool based on the provided network and pool address**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "address": {
          "type": "string"
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`"
        },
        "include_volume_breakdown": {
          "type": "boolean",
          "description": "include volume breakdown, default: false"
        }
      }
    }
  },
  {
    "name": "pools_networks_onchain_info_browser",
    "description": "This endpoint allows you to **query pool metadata (base and quote token details, image, socials, websites, description, contract address, etc.) based on a provided pool contract address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "pool_address": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "timeframe_pools_networks_onchain_ohlcv_browser",
    "description": "This endpoint allows you to **get the OHLCV chart (Open, High, Low, Close, Volume) of a pool based on the provided pool address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "pool_address": {
          "type": "string"
        },
        "timeframe": {
          "type": "string",
          "enum": [
            "day",
            "hour",
            "minute"
          ]
        },
        "token": {
          "type": "string",
          "description": "return OHLCV for token <br> use this to invert the chart <br> Available values: 'base', 'quote' or token address <br> Default value: 'base'"
        },
        "aggregate": {
          "type": "string",
          "description": "time period to aggregate each OHLCV <br> Available values (day): `1` <br> Available values (hour): `1` , `4` , `12` <br> Available values (minute): `1` , `5` , `15` <br> Default value: 1"
        },
        "before_timestamp": {
          "type": "integer",
          "description": "return OHLCV data before this timestamp (integer seconds since epoch)"
        },
        "currency": {
          "type": "string",
          "description": "return OHLCV in USD or quote token <br> Default value: usd",
          "enum": [
            "usd",
            "token"
          ]
        },
        "include_empty_intervals": {
          "type": "boolean",
          "description": "include empty intervals with no trade data, default: false"
        },
        "limit": {
          "type": "integer",
          "description": "number of OHLCV results to return, maximum 1000 <br> Default value: 100"
        }
      }
    }
  },
  {
    "name": "pools_networks_onchain_trades_browser",
    "description": "This endpoint allows you to **query the last 300 trades in the past 24 hours based on the provided pool address**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "pool_address": {
          "type": "string"
        },
        "token": {
          "type": "string",
          "description": "return trades for token <br> use this to invert the chart <br> Available values: 'base', 'quote' or token address <br> Default value: 'base'"
        },
        "trade_volume_in_usd_greater_than": {
          "type": "number",
          "description": "filter trades by trade volume in USD greater than this value <br> Default value: 0"
        }
      }
    }
  },
  {
    "name": "address_networks_onchain_tokens_browser",
    "description": "This endpoint allows you to **query specific token data based on the provided token contract address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "address": {
          "type": "string"
        },
        "include": {
          "type": "string",
          "description": "attributes to include",
          "enum": [
            "top_pools"
          ]
        }
      }
    }
  },
  {
    "name": "tokens_networks_onchain_info_browser",
    "description": "This endpoint allows you to **query token metadata (name, symbol,  HIVE_DATASOURCE_ONE ID, image, socials, websites, description, etc.) based on a provided token contract address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "address": {
          "type": "string"
        }
      }
    }
  },
  {
    "name": "tokens_networks_onchain_top_holders_browser",
    "description": "This endpoint allows you to **query top token holders based on the provided token contract address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "address": {
          "type": "string"
        },
        "holders": {
          "type": "string",
          "description": "number of top token holders to return, you may use any integer or `max` <br> Default value: 10"
        }
      }
    }
  },
  {
    "name": "tokens_networks_onchain_holders_chart_browser",
    "description": "This endpoint allows you to **get the historical token holders chart based on the provided token contract address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "token_address": {
          "type": "string"
        },
        "days": {
          "type": "string",
          "description": "number of days to return the historical token holders chart <br> Default value: 7",
          "enum": [
            "7",
            "30",
            "max"
          ]
        }
      }
    }
  },
  {
    "name": "timeframe_tokens_networks_onchain_ohlcv_browser",
    "description": "This endpoint allows you to **get the OHLCV chart (Open, High, Low, Close, Volume) of a token based on the provided token address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "token_address": {
          "type": "string"
        },
        "timeframe": {
          "type": "string",
          "enum": [
            "day",
            "hour",
            "minute"
          ]
        },
        "aggregate": {
          "type": "string",
          "description": "time period to aggregate each OHLCV <br> Available values (day): `1` <br> Available values (hour): `1` , `4` , `12` <br> Available values (minute): `1` , `5` , `15` <br> Default value: 1"
        },
        "before_timestamp": {
          "type": "integer",
          "description": "return OHLCV data before this timestamp (integer seconds since epoch)"
        },
        "currency": {
          "type": "string",
          "description": "return OHLCV in USD or quote token <br> Default value: usd",
          "enum": [
            "usd",
            "token"
          ]
        },
        "include_empty_intervals": {
          "type": "boolean",
          "description": "include empty intervals with no trade data, default: false"
        },
        "limit": {
          "type": "integer",
          "description": "number of OHLCV results to return, maximum 1000 <br> Default value: 100"
        }
      }
    }
  },
  {
    "name": "tokens_networks_onchain_pools_browser",
    "description": "This endpoint allows you to **query top pools based on the provided token contract address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "token_address": {
          "type": "string"
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        },
        "sort": {
          "type": "string",
          "description": "sort the pools by field <br> Default value: h24_volume_usd_liquidity_desc",
          "enum": [
            "h24_volume_usd_liquidity_desc",
            "h24_tx_count_desc",
            "h24_volume_usd_desc"
          ]
        }
      }
    }
  },
  {
    "name": "tokens_networks_onchain_trades_browser",
    "description": "This endpoint allows you to **query the last 300 trades in the past 24 hours, across all pools, based on the provided token contract address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "token_address": {
          "type": "string"
        },
        "trade_volume_in_usd_greater_than": {
          "type": "number",
          "description": "filter trades by trade volume in USD greater than this value <br> Default value: 0"
        }
      }
    }
  },
  {
    "name": "pools_onchain_megafilter_browser",
    "description": "This endpoint allows you to **query pools based on various filters across all networks on HIVE_DATASOURCE_ONE_CONSOLE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "buy_tax_percentage_max": {
          "type": "number",
          "description": "maximum buy tax percentage"
        },
        "buy_tax_percentage_min": {
          "type": "number",
          "description": "minimum buy tax percentage"
        },
        "buys_duration": {
          "type": "string",
          "description": "duration for buy transactions metric <br> Default value: 24h",
          "enum": [
            "5m",
            "1h",
            "6h",
            "24h"
          ]
        },
        "buys_max": {
          "type": "integer",
          "description": "maximum number of buy transactions"
        },
        "buys_min": {
          "type": "integer",
          "description": "minimum number of buy transactions"
        },
        "checks": {
          "type": "string",
          "description": "filter options for various checks, comma-separated if more than one <br> Available values: `no_honeypot`, `good_gt_score`, `on_coingecko`, `has_social`"
        },
        "dexes": {
          "type": "string",
          "description": "filter pools by DEXes, comma-separated if more than one <br> DEX ID refers to [/networks/{network}/dexes](/reference/dexes-list)"
        },
        "fdv_usd_max": {
          "type": "number",
          "description": "maximum fully diluted value in USD"
        },
        "fdv_usd_min": {
          "type": "number",
          "description": "minimum fully diluted value in USD"
        },
        "h24_volume_usd_max": {
          "type": "number",
          "description": "maximum 24hr volume in USD"
        },
        "h24_volume_usd_min": {
          "type": "number",
          "description": "minimum 24hr volume in USD"
        },
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`, `network`"
        },
        "networks": {
          "type": "string",
          "description": "filter pools by networks, comma-separated if more than one <br> Network ID refers to [/networks](/reference/networks-list)"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        },
        "pool_created_hour_max": {
          "type": "number",
          "description": "maximum pool age in hours"
        },
        "pool_created_hour_min": {
          "type": "number",
          "description": "minimum pool age in hours"
        },
        "reserve_in_usd_max": {
          "type": "number",
          "description": "maximum reserve in USD"
        },
        "reserve_in_usd_min": {
          "type": "number",
          "description": "minimum reserve in USD"
        },
        "sell_tax_percentage_max": {
          "type": "number",
          "description": "maximum sell tax percentage"
        },
        "sell_tax_percentage_min": {
          "type": "number",
          "description": "minimum sell tax percentage"
        },
        "sells_duration": {
          "type": "string",
          "description": "duration for sell transactions metric <br> Default value: 24h",
          "enum": [
            "5m",
            "1h",
            "6h",
            "24h"
          ]
        },
        "sells_max": {
          "type": "integer",
          "description": "maximum number of sell transactions"
        },
        "sells_min": {
          "type": "integer",
          "description": "minimum number of sell transactions"
        },
        "sort": {
          "type": "string",
          "description": "sort the pools by field <br> Default value: h6_trending",
          "enum": [
            "m5_trending",
            "h1_trending",
            "h6_trending",
            "h24_trending",
            "h24_tx_count_desc",
            "h24_volume_usd_desc",
            "h24_price_change_percentage_desc",
            "pool_created_at_desc"
          ]
        },
        "tx_count_duration": {
          "type": "string",
          "description": "duration for transaction count metric <br> Default value: 24h",
          "enum": [
            "5m",
            "1h",
            "6h",
            "24h"
          ]
        },
        "tx_count_max": {
          "type": "integer",
          "description": "maximum transaction count"
        },
        "tx_count_min": {
          "type": "integer",
          "description": "minimum transaction count"
        }
      }
    }
  },
  {
    "name": "pools_onchain_trending_search_browser",
    "description": "This endpoint allows you to **query all the trending search pools across all networks on HIVE_DATASOURCE_ONE_CONSOLE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`, `network`"
        },
        "pools": {
          "type": "integer",
          "description": "number of pools to return, maximum 10 <br> Default value: 4"
        }
      }
    }
  },
  {
    "name": "search_onchain_pools_browser",
    "description": "This endpoint allows you to **search for pools on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "include": {
          "type": "string",
          "description": "attributes to include, comma-separated if more than one to include <br> Available values: `base_token`, `quote_token`, `dex`"
        },
        "network": {
          "type": "string",
          "description": "network ID <br> *refers to [/networks](/reference/networks-list)"
        },
        "page": {
          "type": "integer",
          "description": "page through results <br> Default value: 1"
        },
        "query": {
          "type": "string",
          "description": "search query"
        }
      }
    }
  },
  {
    "name": "addresses_networks_simple_onchain_token_price_browser",
    "description": "This endpoint allows you to **get token price based on the provided token contract address on a network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string"
        },
        "addresses": {
          "type": "string"
        },
        "include_24hr_price_change": {
          "type": "boolean",
          "description": "include 24hr price change, default: false"
        },
        "include_24hr_vol": {
          "type": "boolean",
          "description": "include 24hr volume, default: false"
        },
        "include_market_cap": {
          "type": "boolean",
          "description": "include market capitalization, default: false"
        },
        "include_total_reserve_in_usd": {
          "type": "boolean",
          "description": "include total reserve in USD, default: false"
        },
        "mcap_fdv_fallback": {
          "type": "boolean",
          "description": "return FDV if market cap is not available, default: false"
        }
      }
    }
  },
  {
    "name": "search_browser",
    "description": "This endpoint allows you to **search for coins, categories and markets listed on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "search query"
        }
      }
    }
  },
  {
    "name": "search_trending_browser",
    "description": "This endpoint allows you **query trending search coins, NFTs and categories on HIVE_DATASOURCE_ONE in the last 24 hours**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "show_max": {
          "type": "string",
          "description": "show max number of results available for the given type <br> Available values: `coins`, `nfts`, `categories` <br> Example: `coins` or `coins,nfts,categories`"
        }
      }
    }
  },
  {
    "name": "simple_price_browser",
    "description": "This endpoint allows you to **query the prices of one or more coins by using their unique Coin API IDs**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "vs_currencies": {
          "type": "string",
          "description": "target currency of coins, comma-separated if querying more than 1 currency. <br> *refers to [`/simple/supported_vs_currencies`](/reference/simple-supported-currencies)."
        },
        "ids": {
          "type": "string",
          "description": "coins' IDs, comma-separated if querying more than 1 coin. <br> *refers to [`/coins/list`](/reference/coins-list)."
        },
        "include_24hr_change": {
          "type": "boolean",
          "description": "include 24hr change, default: false"
        },
        "include_24hr_vol": {
          "type": "boolean",
          "description": "include 24hr volume, default: false"
        },
        "include_last_updated_at": {
          "type": "boolean",
          "description": "include last updated price time in UNIX, default: false"
        },
        "include_market_cap": {
          "type": "boolean",
          "description": "include market capitalization, default: false"
        },
        "include_tokens": {
          "type": "string",
          "description": "for `symbols` lookups, specify `all` to include all matching tokens <br> Default `top` returns top-ranked tokens (by market cap or volume)",
          "enum": [
            "top",
            "all"
          ]
        },
        "names": {
          "type": "string",
          "description": "coins' names, comma-separated if querying more than 1 coin."
        },
        "precision": {
          "type": "string",
          "description": "decimal place for currency price value",
          "enum": [
            "full",
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18"
          ]
        },
        "symbols": {
          "type": "string",
          "description": "coins' symbols, comma-separated if querying more than 1 coin."
        }
      }
    }
  },
  {
    "name": "simple_supported_vs_currencies_browser",
    "description": "This endpoint allows you to **query all the supported currencies on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "id_simple_token_price_browser",
    "description": "This endpoint allows you to **query one or more token prices using their token contract addresses**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string"
        },
        "contract_addresses": {
          "type": "string",
          "description": "the contract addresses of tokens, comma-separated if querying more than 1 token's contract address"
        },
        "vs_currencies": {
          "type": "string",
          "description": "target currency of coins, comma-separated if querying more than 1 currency. <br> *refers to [`/simple/supported_vs_currencies`](/reference/simple-supported-currencies)."
        },
        "include_24hr_change": {
          "type": "boolean",
          "description": "include 24hr change <br> default: false"
        },
        "include_24hr_vol": {
          "type": "boolean",
          "description": "include 24hr volume, default: false"
        },
        "include_last_updated_at": {
          "type": "boolean",
          "description": "include last updated price time in UNIX , default: false"
        },
        "include_market_cap": {
          "type": "boolean",
          "description": "include market capitalization, default: false"
        },
        "precision": {
          "type": "string",
          "description": "decimal place for currency price value",
          "enum": [
            "full",
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18"
          ]
        }
      }
    }
  },
  {
    "name": "coin_tickers_data",
    "description": "This endpoint allows you to **query the coin tickers on both centralized exchange (CEX) and decentralized exchange (DEX) based on a particular coin ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "coin id (use /coins/list endpoint to get the coin id)"
        },
        "exchange_ids": {
          "type": "string",
          "description": "filter results by exchange_ids (comma-separated if querying more than 1 exchange)"
        },
        "include_exchange_logo": {
          "type": "boolean",
          "description": "flag to show exchange logo, default: false"
        },
        "page": {
          "type": "integer",
          "description": "page through results, default: 1"
        },
        "order": {
          "type": "string",
          "description": "valid values: trust_score_desc (default), trust_score_asc, volume_desc"
        },
        "depth": {
          "type": "boolean",
          "description": "flag to show 2% orderbook depth, default: false"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "coin_historical_chart",
    "description": "This endpoint allows you to **get the historical chart data of a coin including time in UNIX, price, market cap and 24hr volume based on particular coin ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "coin id (use /coins/list endpoint to get the coin id)"
        },
        "vs_currency": {
          "type": "string",
          "description": "target currency of coins (usd, eur, jpy, etc.)"
        },
        "days": {
          "type": "string",
          "description": "data up to number of days ago (1/7/14/30/90/180/365/max)"
        },
        "interval": {
          "type": "string",
          "description": "data interval. Automatically calculated, or specify 5m, hourly (Enterprise only)",
          "enum": [
            "5m",
            "hourly"
          ]
        },
        "precision": {
          "type": "string",
          "description": "decimal place for currency price value",
          "enum": [
            "full",
            "0",
            "1",
            "2",
            "3",
            "4",
            "5",
            "6",
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18"
          ]
        }
      },
      "required": [
        "id",
        "vs_currency",
        "days"
      ]
    }
  },
  {
    "name": "coins_categories_market_data",
    "description": "This endpoint allows you to **query all the coins categories with market data (market cap, volume, ...) on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "order": {
          "type": "string",
          "description": "sort results by field"
        }
      }
    }
  },
  {
    "name": "exchanges_data",
    "description": "This endpoint allows you to **query all the supported exchanges with exchanges' data (ID, name, country, ...) that have active trading volumes on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "per_page": {
          "type": "integer",
          "description": "total results per page, default: 100"
        },
        "page": {
          "type": "integer",
          "description": "page through results, default: 1"
        }
      }
    }
  },
  {
    "name": "exchanges_list_simple",
    "description": "This endpoint allows you to **query all the exchanges with ID and name**",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "exchange_details",
    "description": "This endpoint allows you to **query exchange's data (name, year established, country, ...), exchange volume in BTC and top 100 tickers based on exchange's ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "exchange id (use /exchanges/list endpoint to get exchange id)"
        },
        "dex_pair_format": {
          "type": "string",
          "description": "set to symbol to display DEX pair base and target as symbols, default: contract_address",
          "enum": [
            "contract_address",
            "symbol"
          ]
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "exchange_tickers_data",
    "description": "This endpoint allows you to **query exchange's tickers based on exchange's ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "exchange id (use /exchanges/list endpoint to get exchange id)"
        },
        "coin_ids": {
          "type": "string",
          "description": "filter results by coin_ids (comma-separated if querying more than 1 coin)"
        },
        "include_exchange_logo": {
          "type": "boolean",
          "description": "flag to show exchange logo, default: false"
        },
        "page": {
          "type": "integer",
          "description": "page through results, default: 1"
        },
        "depth": {
          "type": "boolean",
          "description": "flag to show 2% orderbook depth, default: false"
        },
        "order": {
          "type": "string",
          "description": "valid values: trust_score_desc (default), trust_score_asc, volume_desc, base_target"
        },
        "dex_pair_format": {
          "type": "string",
          "description": "set to symbol to display DEX pair base and target as symbols, default: contract_address",
          "enum": [
            "contract_address",
            "symbol"
          ]
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "exchange_volume_chart",
    "description": "This endpoint allows you to **query the historical volume chart data with time in UNIX and trading volume data in BTC based on exchange's ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "exchange id (use /exchanges/list endpoint to get exchange id)"
        },
        "days": {
          "type": "integer",
          "description": "data up to number of days ago (1/7/14/30/90/180/365)"
        }
      },
      "required": [
        "id",
        "days"
      ]
    }
  },
  {
    "name": "exchange_volume_chart_range",
    "description": "This endpoint allows you to **query the historical volume chart data within a specific time range with time in UNIX and trading volume data in BTC based on exchange's ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "exchange id (use /exchanges/list endpoint to get exchange id)"
        },
        "from": {
          "type": "integer",
          "description": "from date in UNIX timestamp"
        },
        "to": {
          "type": "integer",
          "description": "to date in UNIX timestamp"
        }
      },
      "required": [
        "id",
        "from",
        "to"
      ]
    }
  },
  {
    "name": "derivatives_tickers_data",
    "description": "This endpoint allows you to **query all the tickers from derivatives exchanges on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "include_tickers": {
          "type": "string",
          "description": "include all or unexpired tickers, default: unexpired",
          "enum": [
            "all",
            "unexpired"
          ]
        }
      }
    }
  },
  {
    "name": "derivatives_exchanges_data",
    "description": "This endpoint allows you to **query all the derivatives exchanges with related data (ID, name, open interest, ...) on HIVE_DATASOURCE_ONE**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "order": {
          "type": "string",
          "description": "sort results by field"
        },
        "per_page": {
          "type": "integer",
          "description": "total results per page, default: 100"
        },
        "page": {
          "type": "integer",
          "description": "page through results, default: 1"
        }
      }
    }
  },
  {
    "name": "derivative_exchange_details",
    "description": "This endpoint allows you to **query the derivatives exchange's related data (ID, name, open interest, ...) based on the exchanges' ID**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "derivatives exchange id"
        },
        "include_tickers": {
          "type": "string",
          "description": "include all or unexpired tickers, leave blank to omit",
          "enum": [
            "all",
            "unexpired"
          ]
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "derivatives_exchanges_list",
    "description": "This endpoint allows you to **query all the derivatives exchanges with ID and name**",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "btc_exchange_rates",
    "description": "This endpoint allows you to **query BTC exchange rates with other currencies**. You may use this endpoint to convert the response data, which is originally in BTC, to other currencies.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "global_defi_data",
    "description": "This endpoint allows you **query top 100 cryptocurrency global decentralized finance (DeFi) data including DeFi market cap, trading volume**",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "global_market_cap_chart",
    "description": "This endpoint allows you to **query global market cap chart data**. Get historical global market cap chart data with timestamps.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "days": {
          "type": "string",
          "description": "Data up to number of days ago (1/7/14/30/90/180/365/max)",
          "enum": [
            "1",
            "7",
            "14",
            "30",
            "90",
            "180",
            "365",
            "max"
          ]
        },
        "vs_currency": {
          "type": "string",
          "description": "Target currency of market cap data (default: usd)",
          "default": "usd"
        }
      },
      "required": [
        "days"
      ]
    }
  },
  {
    "name": "companies_crypto_treasury",
    "description": "This endpoint allows you to **query public companies Bitcoin or Ethereum holdings**. Get detailed information about public companies and their cryptocurrency treasury holdings.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "coin_id": {
          "type": "string",
          "description": "Target cryptocurrency (bitcoin or ethereum)",
          "enum": [
            "bitcoin",
            "ethereum"
          ]
        }
      },
      "required": [
        "coin_id"
      ]
    }
  },
  {
    "name": "network_trending_pools",
    "description": "This endpoint allows you to **query the trending pools based on the provided network**",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string",
          "description": "Network ID (refers to /onchain/networks)"
        },
        "duration": {
          "type": "string",
          "description": "Duration to sort trending list by (Default: 24h)",
          "enum": [
            "5m",
            "1h",
            "6h",
            "24h"
          ],
          "default": "24h"
        },
        "include": {
          "type": "string",
          "description": "Attributes to include, comma-separated (base_token, quote_token, dex)"
        },
        "page": {
          "type": "integer",
          "description": "Page through results (Default: 1)",
          "default": 1
        }
      },
      "required": [
        "network"
      ]
    }
  },
  {
    "name": "multi_pools_data",
    "description": "This endpoint allows you to **query multiple pools data based on the provided pool addresses on a network**. You can query up to 30 pool addresses per request.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string",
          "description": "Network ID (refers to /onchain/networks)"
        },
        "addresses": {
          "type": "string",
          "description": "Pool addresses, comma-separated (up to 30 addresses)"
        },
        "include": {
          "type": "string",
          "description": "Attributes to include, comma-separated (base_token, quote_token, dex)"
        }
      },
      "required": [
        "network",
        "addresses"
      ]
    }
  },
  {
    "name": "multi_tokens_data",
    "description": "This endpoint allows you to **query multiple tokens data based on the provided token contract addresses on a network**. You can query up to 50 contract addresses per request (Paid plan subscribers only).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string",
          "description": "Network ID (refers to /onchain/networks)"
        },
        "addresses": {
          "type": "string",
          "description": "Token contract addresses, comma-separated (up to 50 addresses)"
        },
        "include": {
          "type": "string",
          "description": "Attributes to include (top_pools)",
          "enum": [
            "top_pools"
          ]
        }
      },
      "required": [
        "network",
        "addresses"
      ]
    }
  },
  {
    "name": "tokens_recent_updates",
    "description": "This endpoint allows you to **query the most recently updated tokens information (metadata) across all networks**. Returns tokens with recently updated metadata such as socials, websites, descriptions, etc.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "page": {
          "type": "integer",
          "description": "Page through results (Default: 1)",
          "default": 1
        },
        "include": {
          "type": "string",
          "description": "Attributes to include, comma-separated (network)",
          "enum": [
            "network"
          ]
        }
      }
    }
  },
  {
    "name": "defi_protocols_list",
    "description": "Get a list of DeFi protocols with TVL metrics. Supports pagination with limit (max 100) and offset parameters. Default limit is 50.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum number of protocols to return (default: 50, max: 100)"
        },
        "offset": {
          "type": "number",
          "description": "Number of protocols to skip for pagination (default: 0)"
        }
      }
    }
  },
  {
    "name": "defi_protocol_details",
    "description": "Get detailed information about a specific DeFi protocol including historical TVL data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "protocol": {
          "type": "string",
          "description": "Protocol slug (e.g., \"uniswap\", \"aave\", \"compound\")"
        }
      },
      "required": [
        "protocol"
      ]
    }
  },
  {
    "name": "protocol_tvl_current",
    "description": "Get current TVL (Total Value Locked) for a specific protocol as a single number",
    "inputSchema": {
      "type": "object",
      "properties": {
        "protocol": {
          "type": "string",
          "description": "Protocol slug (e.g., \"uniswap\", \"aave\", \"compound\")"
        }
      },
      "required": [
        "protocol"
      ]
    }
  },
  {
    "name": "protocol_fees_data",
    "description": "Get fee data for a specific protocol",
    "inputSchema": {
      "type": "object",
      "properties": {
        "protocol": {
          "type": "string",
          "description": "Protocol name"
        }
      },
      "required": [
        "protocol"
      ]
    }
  },
  {
    "name": "blockchain_chains_list",
    "description": "Get a list of all blockchain networks with their current TVL",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum number of chains to return (default: 100)"
        }
      }
    }
  },
  {
    "name": "chain_tvl_history",
    "description": "Get historical TVL data for a specific blockchain",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain": {
          "type": "string",
          "description": "Chain name (e.g., \"ethereum\", \"bsc\", \"polygon\")"
        }
      },
      "required": [
        "chain"
      ]
    }
  },
  {
    "name": "chains_tvl_historical_all",
    "description": "Get historical TVL data for all chains",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "yield_pools_list",
    "description": "Get yield pools with APY data. Supports pagination (limit max 100, offset) and filtering by minTvl. Default limit is 50.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum number of pools to return (default: 50, max: 100)",
          "minimum": 1,
          "maximum": 100,
          "default": 50
        },
        "offset": {
          "type": "number",
          "description": "Number of pools to skip for pagination (default: 0)",
          "default": 0
        },
        "minTvl": {
          "type": "number",
          "description": "Minimum TVL in USD to filter pools (default: 0)",
          "default": 0
        }
      }
    }
  },
  {
    "name": "yield_pool_chart_history",
    "description": "Get historical chart data for a specific yield pool showing APY and TVL over time",
    "inputSchema": {
      "type": "object",
      "properties": {
        "poolId": {
          "type": "string",
          "description": "Pool identifier (get from yield pools list)"
        }
      },
      "required": [
        "poolId"
      ]
    }
  },
  {
    "name": "stablecoins_list",
    "description": "Get all stablecoins with their market cap and chain distribution. Results are limited to prevent oversized responses.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum number of stablecoins to return (default: 100, max: 500)",
          "minimum": 1,
          "maximum": 500,
          "default": 100
        }
      }
    }
  },
  {
    "name": "stablecoin_chains_list",
    "description": "Get list of all chains with stablecoin data and their TVL.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "stablecoin_charts_global",
    "description": "Get historical chart data for all stablecoins showing market cap over time. Response is limited to prevent MCP timeouts.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum number of recent data points to return (default: 30, max: 100)",
          "minimum": 1,
          "maximum": 100,
          "default": 30
        }
      }
    }
  },
  {
    "name": "stablecoin_charts_by_chain",
    "description": "Get historical chart data for stablecoins on a specific blockchain. Response is limited to prevent MCP timeouts.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain": {
          "type": "string",
          "description": "Chain name (e.g., \"ethereum\", \"bsc\", \"polygon\")"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of recent data points to return (default: 30, max: 100)",
          "minimum": 1,
          "maximum": 100,
          "default": 30
        }
      },
      "required": [
        "chain"
      ]
    }
  },
  {
    "name": "stablecoin_prices_current",
    "description": "Get current prices of stablecoins. Response is limited to prevent MCP timeouts.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum number of recent time entries to return (default: 5, max: 20)",
          "minimum": 1,
          "maximum": 20,
          "default": 5
        }
      }
    }
  },
  {
    "name": "options_trading_overview",
    "description": "Get options trading overview data across all chains and protocols with historical charts",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "options_trading_by_chain",
    "description": "Get options trading data for a specific blockchain",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain": {
          "type": "string",
          "description": "Chain name (e.g., \"ethereum\", \"arbitrum\", \"polygon\")"
        }
      },
      "required": [
        "chain"
      ]
    }
  },
  {
    "name": "options_protocol_summary",
    "description": "Get detailed summary for a specific options trading protocol",
    "inputSchema": {
      "type": "object",
      "properties": {
        "protocol": {
          "type": "string",
          "description": "Protocol slug (e.g., \"hegic\", \"opyn\", \"ribbon\")"
        }
      },
      "required": [
        "protocol"
      ]
    }
  },
  {
    "name": "dex_volumes_overview",
    "description": "Get DEX volumes overview across all protocols",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum number of DEXs to return (default: 100, max: 500)"
        }
      }
    }
  },
  {
    "name": "dex_volume_specific",
    "description": "Get volume data for a specific DEX with key metrics and recent chart data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "dexName": {
          "type": "string",
          "description": "DEX name (e.g., \"uniswap\", \"sushiswap\")"
        }
      },
      "required": [
        "dexName"
      ]
    }
  },
  {
    "name": "dex_volumes_chain_specific",
    "description": "Get DEX volumes overview for a specific blockchain with historical data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain": {
          "type": "string",
          "description": "Chain name (e.g., \"ethereum\", \"bsc\", \"polygon\", \"arbitrum\")"
        }
      },
      "required": [
        "chain"
      ]
    }
  },
  {
    "name": "protocol_fees_overview",
    "description": "Get protocol fees overview. Supports pagination (limit max 100, offset) and filtering by minFees. Default limit is 50.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": {
          "type": "number",
          "description": "Maximum number of protocols to return (default: 50, max: 100)",
          "minimum": 1,
          "maximum": 100
        },
        "offset": {
          "type": "number",
          "description": "Number of protocols to skip for pagination (default: 0)",
          "default": 0
        },
        "minFees": {
          "type": "number",
          "description": "Minimum 24h fees in USD to filter protocols (default: 0)",
          "default": 0
        }
      }
    }
  },
  {
    "name": "chain_fees_overview",
    "description": "Get fees overview for a specific blockchain with historical data and protocol breakdown",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain": {
          "type": "string",
          "description": "Chain name (e.g., \"ethereum\", \"bsc\", \"polygon\", \"arbitrum\")"
        }
      },
      "required": [
        "chain"
      ]
    }
  },
  {
    "name": "user_history",
    "description": "Get transaction history for a user address",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "User address (Single wallet address only)",
          "example": "0x1234..."
        },
        "chain_id": {
          "type": "string",
          "description": "Chain ID (e.g., eth, bsc, xdai)",
          "example": "eth"
        },
        "token_id": {
          "type": "string",
          "description": "Token ID to filter history (optional)",
          "example": "0x55d3..."
        },
        "start_time": {
          "type": "number",
          "description": "Timestamp, return history earlier than this time (optional)",
          "example": 1693958400
        },
        "page_count": {
          "type": "number",
          "description": "Number of entries to return (max 20)",
          "example": 10
        }
      },
      "required": [
        "id",
        "chain_id"
      ]
    }
  },
  {
    "name": "user_total_balance",
    "description": "Get net assets on multiple chains or single chain",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "User address (Single wallet address only)",
          "example": "0x1234..."
        },
        "chain_id": {
          "type": "string",
          "description": "Chain ID",
          "example": "eth"
        },
        "is_all": {
          "type": "boolean",
          "description": "If true, all tokens are returned",
          "default": true
        }
      },
      "required": [
        "id",
        "chain_id"
      ]
    }
  },
  {
    "name": "user_token_balances",
    "description": "Get token balances on all supported chains",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "User address (Single wallet address only)",
          "example": "0x1234..."
        },
        "is_all": {
          "type": "boolean",
          "description": "If true, all tokens are returned",
          "default": true
        },
        "chain_ids": {
          "type": "string",
          "description": "Comma-separated list of chain IDs",
          "example": "eth,bsc,xdai"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "get_user_protocol",
    "description": "Get user positions in a protocol",
    "inputSchema": {
      "type": "object",
      "properties": {
        "protocol_id": {
          "type": "string",
          "description": "Protocol ID (e.g., bsc_pancakeswap, curve, uniswap)",
          "example": "uniswap"
        },
        "id": {
          "type": "string",
          "description": "User address (Single wallet address only)",
          "example": "0x1234..."
        }
      },
      "required": [
        "protocol_id",
        "id"
      ]
    }
  },
  {
    "name": "get_detailed_protocol_list",
    "description": "Get user portfolios on a chain in protocol",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain_id": {
          "type": "string",
          "description": "Chain ID (e.g., eth, bsc, xdai)",
          "example": "eth"
        },
        "id": {
          "type": "string",
          "description": "User address (Single wallet address only)",
          "example": "0x1234..."
        }
      },
      "required": [
        "chain_id",
        "id"
      ]
    }
  },
  {
    "name": "get_detailed_protocol_list_on_all_chain",
    "description": "Get user portfolios on all supported chains",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "User address (Single wallet address only)",
          "example": "0x1234..."
        },
        "chain_ids": {
          "type": "string",
          "description": "List of chain IDs",
          "example": "eth,bsc,xdai"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "get_nft_list",
    "description": "Get user NFT list for a specific chain",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "User address (Single wallet address only)",
          "example": "0x1234..."
        },
        "chain_id": {
          "type": "string",
          "description": "Chain ID",
          "example": "eth"
        },
        "is_all": {
          "type": "boolean",
          "description": "If false, only verified collections are returned",
          "default": true
        }
      },
      "required": [
        "id",
        "chain_id"
      ]
    }
  },
  {
    "name": "get_all_nft",
    "description": "Get user NFT list across all chains",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "User address (Single wallet address only)",
          "example": "0x1234..."
        },
        "is_all": {
          "type": "boolean",
          "description": "If true, all tokens are returned",
          "default": true
        },
        "chain_ids": {
          "type": "string",
          "description": "List of chain IDs",
          "example": "eth,bsc,xdai"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "describe_onchain_transaction",
    "description": "Get detailed explanation of a transaction",
    "inputSchema": {
      "type": "object",
      "properties": {
        "tx": {
          "type": "object",
          "description": "Transaction object to explain",
          "properties": {
            "chainId": {
              "type": "number",
              "description": "Chain ID",
              "example": 1
            },
            "from": {
              "type": "string",
              "description": "The address the transaction is sent from",
              "example": "0x5853ed4f26a3fcea565b3fbc698bb19cdf6deb85"
            },
            "to": {
              "type": "string",
              "description": "The address the transaction is directed to",
              "example": "0x5853ed4f26a3fcea565b3fbc698bb19cdf6deb81"
            },
            "value": {
              "type": "string",
              "description": "Integer of the value send with this transaction (in hex)",
              "example": "0x16345785d8a0000"
            },
            "data": {
              "type": "string",
              "description": "The compiled code of a contract OR the hash of the invoked method signature and encoded parameters",
              "example": "0x"
            },
            "gas": {
              "type": "string",
              "description": "Integer of the gas provided for the transaction execution (in hex)",
              "example": "0x5208"
            },
            "maxFeePerGas": {
              "type": "string",
              "description": "Maximum amount you're willing to pay (in hex)",
              "example": "0x4e3b29200"
            },
            "maxPriorityFeePerGas": {
              "type": "string",
              "description": "The part of the fee that goes to the miner (in hex)",
              "example": "0x4e3b29200"
            },
            "nonce": {
              "type": "string",
              "description": "Integer of a nonce (in hex)",
              "example": "0x1"
            }
          },
          "required": [
            "chainId",
            "from",
            "to",
            "value",
            "data"
          ]
        }
      },
      "required": [
        "tx"
      ]
    }
  },
  {
    "name": "get_gas_prices",
    "description": "Get gas prices for a specific chain",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain_id": {
          "type": "string",
          "description": "Chain ID (e.g., eth, bsc, xdai)",
          "example": "eth"
        }
      },
      "required": [
        "chain_id"
      ]
    }
  },
  {
    "name": "get_nft_collection",
    "description": "Get NFT list of a specific collection",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Contract address of NFT",
          "example": "0x1234..."
        },
        "chain_id": {
          "type": "string",
          "description": "Chain ID",
          "example": "eth"
        },
        "start": {
          "type": "integer",
          "description": "Offset, default 0, max 100000",
          "default": 0
        },
        "limit": {
          "type": "integer",
          "description": "Limit size, default 20, max 100",
          "default": 20
        }
      },
      "required": [
        "id",
        "chain_id"
      ]
    }
  },
  {
    "name": "protocol_info",
    "description": "Get detailed information about a protocol",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Protocol ID (e.g., bsc_pancakeswap, curve, uniswap)",
          "example": "uniswap"
        }
      },
      "required": [
        "id"
      ]
    }
  },
  {
    "name": "protocol_list",
    "description": "Get list of protocols on a chain",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain_id": {
          "type": "string",
          "description": "Chain ID (e.g., eth, bsc, xdai)",
          "example": "eth"
        }
      },
      "required": [
        "chain_id"
      ]
    }
  },
  {
    "name": "get_token_security",
    "description": "Get comprehensive token security analysis including: honeypot detection, ownership details, trading tax, slippage, holder distribution, liquidity status, contract verification, and other security metrics. Helps identify scams, rugpulls, and high-risk tokens.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "description": "The chain ID (1=Ethereum, 56=BSC, 137=Polygon, 42161=Arbitrum, 43114=Avalanche, 10=Optimism, 25=Cronos, 250=Fantom)",
          "example": "1"
        },
        "contract_addresses": {
          "type": "string",
          "description": "Token contract address (can be comma-separated for multiple)",
          "example": "0x3567aa22cd3ab9aEf23d7e18EE0D7cf16974d7e6"
        }
      },
      "required": [
        "chainId",
        "contract_addresses"
      ]
    }
  },
  {
    "name": "get_nft_security",
    "description": "Get NFT security and authenticity analysis including: malicious behavior detection, trading platform verification, metadata authenticity, contract risks (privileged_burn, transfer_without_approval, self_destruct), and collection clone detection. Helps identify fake NFTs and scam collections.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "description": "The chain ID (1=Ethereum, 56=BSC, 137=Polygon, 42161=Arbitrum, 43114=Avalanche)",
          "example": "1"
        },
        "contract_addresses": {
          "type": "string",
          "description": "NFT contract address (can be comma-separated for multiple)",
          "example": "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D"
        }
      },
      "required": [
        "chainId",
        "contract_addresses"
      ]
    }
  },
  {
    "name": "check_malicious_address",
    "description": "Check if an address is malicious or associated with: scams, phishing, exploits, mixers, sanctioned entities, or other malicious activities. Returns cybercrime labels, blacklist status, and risk scores.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "address": {
          "type": "string",
          "description": "The blockchain address to check for malicious activity",
          "example": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        }
      },
      "required": [
        "address"
      ]
    }
  },
  {
    "name": "check_approval_security",
    "description": "Check security risks of token/NFT approval contracts including: contract verification status, malicious history, approval abuse potential, and whether the spender is a known phishing address or malicious contract.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "description": "The chain ID (1=Ethereum, 56=BSC, 137=Polygon)",
          "example": "1"
        },
        "contract_addresses": {
          "type": "string",
          "description": "Spender contract address to check",
          "example": "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
        }
      },
      "required": [
        "chainId",
        "contract_addresses"
      ]
    }
  },
  {
    "name": "get_user_approvals",
    "description": "Get comprehensive security analysis of all token and NFT approvals for a user address, showing which contracts have spending permissions. Helps identify risky approvals, potential approval exploits, and malicious spenders. Returns approved amounts, spender addresses, risk levels, and security recommendations.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chainId": {
          "type": "string",
          "description": "The chain ID (1=Ethereum, 56=BSC, 137=Polygon, 42161=Arbitrum, 43114=Avalanche, 10=Optimism, 25=Cronos, 250=Fantom)",
          "example": "1"
        },
        "address": {
          "type": "string",
          "description": "EOA (user wallet) address to check approvals for",
          "example": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        }
      },
      "required": [
        "chainId",
        "address"
      ]
    }
  },
  {
    "name": "check_dapp_security",
    "description": "Check security risks of a dApp by URL including: phishing detection, malicious contract interactions, audit status, and trust score. Helps users avoid malicious dApps and phishing sites.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "The dApp URL to check",
          "example": "https://app.uniswap.org"
        }
      },
      "required": [
        "url"
      ]
    }
  },
  {
    "name": "detect_phishing_site",
    "description": "Detect if a URL is a phishing site by checking against comprehensive phishing databases. Returns phishing status, similar legitimate sites, and risk indicators.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "url": {
          "type": "string",
          "description": "The URL to check for phishing",
          "example": "https://example-site.com"
        }
      },
      "required": [
        "url"
      ]
    }
  },
  {
    "name": "decode_abi_data",
    "description": "Decode ABI data to understand smart contract interactions, function calls, and parameters. Helps identify malicious transactions, understand approval details, and detect anomalies in contract calls.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "chain_id": {
          "type": "string",
          "description": "Chain id (ETH: 1, Cronos: 25, BSC: 56, Heco: 128, Polygon: 137, Fantom: 250, KCC: 321, Arbitrum: 42161, Avalanche: 43114)",
          "example": "1"
        },
        "contract_address": {
          "type": "string",
          "description": "Contract address - carrying the signer and contract address will help to decode more information",
          "example": "0x4cc8aa0c6ffbe18534584da9b592aa438733ee66"
        },
        "data": {
          "type": "string",
          "description": "Transaction input data (hex string starting with 0x)",
          "example": "0xa0712d680000000000000000000000000000000000000000000000000000000062fee481"
        },
        "input": {
          "type": "object",
          "description": "Optional input info object",
          "properties": {
            "signer": {
              "type": "string",
              "description": "Signer address - carrying the signer and contract address will help to decode more information",
              "example": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
            },
            "transcation_type": {
              "type": "string",
              "description": "Transaction type",
              "enum": [
                "common",
                "eth_signTypedData_v4",
                "personal_sign",
                "eth_sign"
              ],
              "example": "common"
            }
          }
        },
        "signer": {
          "type": "string",
          "description": "Signer address - carrying the signer and contract address will help to decode more information (alternative to input.signer)",
          "example": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
        },
        "transcation_type": {
          "type": "string",
          "description": "Transaction type (alternative to input.transcation_type)",
          "enum": [
            "common",
            "eth_signTypedData_v4",
            "personal_sign",
            "eth_sign"
          ],
          "example": "common"
        }
      },
      "required": [
        "chain_id",
        "data"
      ]
    }
  },
  {
    "name": "list_blockchain_networks",
    "description": "Get a list of all blockchain networks supported by HIVE_DATASOURCE_TWO",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "check_network_health",
    "description": "Get the status of a specific blockchain network",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID to get status for"
        }
      },
      "required": [
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_network_metrics",
    "description": "Get metadata and statistics for a given network",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID to get stats for"
        }
      },
      "required": [
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "retrieve_token_details",
    "description": "Get detailed information about a specific token",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the token is on"
        },
        "address": {
          "type": "string",
          "description": "The token contract address"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_multiple_tokens",
    "description": "Get detailed information about multiple tokens",
    "inputSchema": {
      "type": "object",
      "properties": {
        "ids": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "networkId": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "The network ID the token is on"
              },
              "address": {
                "type": "string",
                "description": "The token contract address"
              }
            },
            "required": [
              "networkId",
              "address"
            ],
            "additionalProperties": false,
            "description": "A token identifier consisting of network ID and address"
          }
        }
      },
      "required": [
        "ids"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "retrieve_token_pricing",
    "description": "Get real-time or historical prices for a list of tokens",
    "inputSchema": {
      "type": "object",
      "properties": {
        "inputs": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "networkId": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "The network ID the token is on"
              },
              "address": {
                "type": "string",
                "description": "The token contract address"
              },
              "poolAddress": {
                "type": "string",
                "description": "The address of the pool, when omitted the top pool is used."
              },
              "timestamp": {
                "type": "number",
                "description": "Unix timestamp"
              }
            },
            "required": [
              "networkId",
              "address"
            ],
            "additionalProperties": false,
            "description": "A token identifier consisting of network ID and address"
          }
        }
      },
      "required": [
        "inputs"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "search_tokens_by_criteria",
    "description": "Filter tokens by various criteria with automatic pagination for large results. Supports limit (max 100) and offset parameters for efficient data retrieval.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "excludeTokens": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "A list of token IDs to exclude from results (address:networkId)"
        },
        "filters": {
          "type": "object",
          "properties": {
            "buyCount1": {
              "type": "object",
              "properties": {
                "gt": {
                  "type": "number",
                  "description": "Greater than"
                },
                "gte": {
                  "type": "number",
                  "description": "Greater than or equal to"
                },
                "lt": {
                  "type": "number",
                  "description": "Less than"
                },
                "lte": {
                  "type": "number",
                  "description": "Less than or equal to"
                }
              },
              "additionalProperties": false,
              "description": "Number of buy transactions in the last hour"
            },
            "buyCount4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of buy transactions in the last 4 hours"
            },
            "buyCount5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of buy transactions in the last 5 minutes"
            },
            "buyCount12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of buy transactions in the last 12 hours"
            },
            "buyCount24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of buy transactions in the last 24 hours"
            },
            "change1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Price change in the last hour"
            },
            "change4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Price change in the last 4 hours"
            },
            "change5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Price change in the last 5 minutes"
            },
            "change12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Price change in the last 12 hours"
            },
            "change24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Price change in the last 24 hours"
            },
            "createdAt": {
              "type": "number",
              "description": "Token creation timestamp"
            },
            "creatorAddress": {
              "type": "string",
              "description": "Token creator's wallet address"
            },
            "exchangeAddress": {
              "type": "string",
              "description": "Exchange contract address"
            },
            "exchangeId": {
              "type": "string",
              "description": "Exchange identifier"
            },
            "fdv": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Fully diluted valuation"
            },
            "high1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Highest price in the last hour"
            },
            "high4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Highest price in the last 4 hours"
            },
            "high5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Highest price in the last 5 minutes"
            },
            "high12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Highest price in the last 12 hours"
            },
            "high24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Highest price in the last 24 hours"
            },
            "holders": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of token holders"
            },
            "includeScams": {
              "type": "boolean",
              "description": "Whether to include potential scam tokens"
            },
            "isVerified": {
              "$ref": "#/properties/filters/properties/includeScams",
              "description": "Whether the token is verified"
            },
            "lastTransaction": {
              "$ref": "#/properties/filters/properties/createdAt",
              "description": "Timestamp of the last transaction"
            },
            "liquidity": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Total liquidity"
            },
            "low1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Lowest price in the last hour"
            },
            "low4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Lowest price in the last 4 hours"
            },
            "low5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Lowest price in the last 5 minutes"
            },
            "low12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Lowest price in the last 12 hours"
            },
            "low24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Lowest price in the last 24 hours"
            },
            "marketCap": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Market capitalization"
            },
            "network": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Network ID"
            },
            "notableHolderCount": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of notable holders"
            },
            "potentialScam": {
              "$ref": "#/properties/filters/properties/includeScams",
              "description": "Whether the token is potentially a scam"
            },
            "priceUSD": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Current price in USD"
            },
            "sellCount1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of sell transactions in the last hour"
            },
            "sellCount4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of sell transactions in the last 4 hours"
            },
            "sellCount5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of sell transactions in the last 5 minutes"
            },
            "sellCount12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of sell transactions in the last 12 hours"
            },
            "sellCount24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Number of sell transactions in the last 24 hours"
            },
            "trendingIgnored": {
              "$ref": "#/properties/filters/properties/includeScams",
              "description": "Whether the token is ignored in trending calculations"
            },
            "txnCount1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Total transactions in the last hour"
            },
            "txnCount4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Total transactions in the last 4 hours"
            },
            "txnCount5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Total transactions in the last 5 minutes"
            },
            "txnCount12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Total transactions in the last 12 hours"
            },
            "txnCount24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Total transactions in the last 24 hours"
            },
            "uniqueBuys1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique buyers in the last hour"
            },
            "uniqueBuys4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique buyers in the last 4 hours"
            },
            "uniqueBuys5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique buyers in the last 5 minutes"
            },
            "uniqueBuys12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique buyers in the last 12 hours"
            },
            "uniqueBuys24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique buyers in the last 24 hours"
            },
            "uniqueSells1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique sellers in the last hour"
            },
            "uniqueSells4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique sellers in the last 4 hours"
            },
            "uniqueSells5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique sellers in the last 5 minutes"
            },
            "uniqueSells12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique sellers in the last 12 hours"
            },
            "uniqueSells24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique sellers in the last 24 hours"
            },
            "uniqueTransactions1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique transactions in the last hour"
            },
            "uniqueTransactions4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique transactions in the last 4 hours"
            },
            "uniqueTransactions5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique transactions in the last 5 minutes"
            },
            "uniqueTransactions12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique transactions in the last 12 hours"
            },
            "uniqueTransactions24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Unique transactions in the last 24 hours"
            },
            "volume1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Trading volume in the last hour"
            },
            "volume4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Trading volume in the last 4 hours"
            },
            "volume5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Trading volume in the last 5 minutes"
            },
            "volume12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Trading volume in the last 12 hours"
            },
            "volume24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Trading volume in the last 24 hours"
            },
            "volumeChange1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Volume change in the last hour"
            },
            "volumeChange4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Volume change in the last 4 hours"
            },
            "volumeChange5m": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Volume change in the last 5 minutes"
            },
            "volumeChange12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Volume change in the last 12 hours"
            },
            "volumeChange24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Volume change in the last 24 hours"
            }
          },
          "additionalProperties": false,
          "description": "A set of filters to apply"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of items to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of items to skip"
        },
        "phrase": {
          "type": "string",
          "description": "A phrase to search for. Can match a token contract address or partially match a token's name or symbol"
        },
        "rankings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "attribute": {
                "type": "string",
                "enum": [
                  "age",
                  "buyCount1",
                  "buyCount4",
                  "buyCount5m",
                  "buyCount12",
                  "buyCount24",
                  "buyVolume1",
                  "buyVolume4",
                  "buyVolume5m",
                  "buyVolume12",
                  "buyVolume24",
                  "change1",
                  "change4",
                  "change5m",
                  "change12",
                  "change24",
                  "circulatingMarketCap",
                  "createdAt",
                  "graduationPercent",
                  "high1",
                  "high4",
                  "high5m",
                  "high12",
                  "high24",
                  "holders",
                  "lastTransaction",
                  "launchpadCompletedAt",
                  "launchpadMigratedAt",
                  "liquidity",
                  "low1",
                  "low4",
                  "low5m",
                  "low12",
                  "low24",
                  "marketCap",
                  "notableHolderCount",
                  "priceUSD",
                  "sellCount1",
                  "sellCount4",
                  "sellCount5m",
                  "sellCount12",
                  "sellCount24",
                  "sellVolume1",
                  "sellVolume4",
                  "sellVolume5m",
                  "sellVolume12",
                  "sellVolume24",
                  "swapPct1dOldWallet",
                  "swapPct7dOldWallet",
                  "trendingScore",
                  "trendingScore1",
                  "trendingScore4",
                  "trendingScore5m",
                  "trendingScore12",
                  "trendingScore24",
                  "txnCount1",
                  "txnCount4",
                  "txnCount5m",
                  "txnCount12",
                  "txnCount24",
                  "uniqueBuys1",
                  "uniqueBuys4",
                  "uniqueBuys5m",
                  "uniqueBuys12",
                  "uniqueBuys24",
                  "uniqueSells1",
                  "uniqueSells4",
                  "uniqueSells5m",
                  "uniqueSells12",
                  "uniqueSells24",
                  "uniqueTransactions1",
                  "uniqueTransactions4",
                  "uniqueTransactions5m",
                  "uniqueTransactions12",
                  "uniqueTransactions24",
                  "volume1",
                  "volume4",
                  "volume5m",
                  "volume12",
                  "volume24",
                  "volumeChange1",
                  "volumeChange4",
                  "volumeChange5m",
                  "volumeChange12",
                  "volumeChange24",
                  "walletAgeAvg",
                  "walletAgeStd"
                ]
              },
              "direction": {
                "type": "string",
                "enum": [
                  "ASC",
                  "DESC"
                ]
              }
            },
            "required": [
              "attribute",
              "direction"
            ],
            "additionalProperties": false
          },
          "description": "A list of ranking attributes to apply"
        },
        "statsType": {
          "type": "string",
          "enum": [
            "FILTERED",
            "UNFILTERED"
          ],
          "description": "The type of statistics returned. Can be FILTERED or UNFILTERED"
        },
        "tokens": {
          "$ref": "#/properties/excludeTokens",
          "description": "A list of token IDs (address:networkId) or addresses. Can be left blank to discover new tokens"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_token_holders",
    "description": "Returns list of wallets that hold a given token, ordered by holdings descending. Also has the unique count of holders for that token.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the token is on"
        },
        "address": {
          "type": "string",
          "description": "The token contract address"
        },
        "cursor": {
          "type": "string",
          "description": "Cursor for pagination"
        },
        "sort": {
          "type": "object",
          "properties": {
            "attribute": {
              "type": "string",
              "enum": [
                "BALANCE",
                "DATE"
              ]
            },
            "direction": {
              "type": "string",
              "enum": [
                "ASC",
                "DESC"
              ]
            }
          },
          "additionalProperties": false,
          "description": "Sort options for the holders list"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "user_token_balances",
    "description": "Get token balances on all supported chains",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the wallet is on"
        },
        "walletAddress": {
          "type": "string",
          "description": "The wallet address to get balances for"
        },
        "cursor": {
          "type": "string",
          "description": "Cursor for pagination"
        },
        "filterToken": {
          "type": "string",
          "description": "Optional token to filter balances for"
        },
        "includeNative": {
          "type": "boolean",
          "description": "Include native token balances"
        }
      },
      "required": [
        "networkId",
        "walletAddress"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "calculate_top_holders_percentage",
    "description": "Get the percentage of tokens held by top 10 holders",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the token is on"
        },
        "address": {
          "type": "string",
          "description": "The token contract address"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_price_chart_data",
    "description": "Returns bar chart data to track token price changes over time. Can be queried using either a pair address or token address.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the pair or token is on"
        },
        "address": {
          "type": "string",
          "description": "The pair address or token address to get chart data for. If a token address is provided, the token's top pair will be used."
        },
        "resolution": {
          "type": "string",
          "description": "The time frame for each candle. Available options are 1, 5, 15, 30, 60, 240, 720, 1D, 7D"
        },
        "from": {
          "type": "number",
          "description": "Unix timestamp"
        },
        "to": {
          "$ref": "#/properties/from"
        },
        "countback": {
          "type": "number"
        },
        "currencyCode": {
          "type": "string"
        },
        "quoteToken": {
          "type": "string",
          "enum": [
            "token0",
            "token1"
          ],
          "description": "The token of interest (token0 or token1)"
        },
        "removeEmptyBars": {
          "type": "boolean"
        },
        "removeLeadingNullValues": {
          "$ref": "#/properties/removeEmptyBars"
        },
        "statsType": {
          "type": "string",
          "enum": [
            "FILTERED",
            "UNFILTERED"
          ],
          "description": "The type of statistics returned. Can be FILTERED or UNFILTERED"
        },
        "symbolType": {
          "type": "string",
          "enum": [
            "POOL",
            "TOKEN"
          ]
        }
      },
      "required": [
        "networkId",
        "address",
        "resolution",
        "from",
        "to"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_token_chart_urls",
    "description": "Chart images for token pairs",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the pair is on"
        },
        "pairAddress": {
          "type": "string",
          "description": "The pair contract address"
        },
        "quoteToken": {
          "type": "string",
          "enum": [
            "token0",
            "token1"
          ],
          "description": "The token of interest (token0 or token1)"
        }
      },
      "required": [
        "networkId",
        "pairAddress"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_newest_token_contracts",
    "description": "Get a list of the latests token contracts deployed. Note: This endpoint is only available on Ethereum, Optimum, Base, and Arbitrum networks (network IDs 1, 10, 8453, and 42161).",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkFilter": {
          "type": "array",
          "items": {
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "The network ID"
          }
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of items to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of items to skip"
        }
      },
      "required": [
        "networkFilter"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_token_mini_charts",
    "description": "Get a list of token simple chart data (sparklines) for the given tokens",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the tokens are on"
        },
        "addresses": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "The token contract address"
          },
          "description": "Array of token contract addresses"
        }
      },
      "required": [
        "networkId",
        "addresses"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "retrieve_token_transactions",
    "description": "Get transactions for a token pair",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "description": "A cursor for use in pagination"
        },
        "direction": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "description": "The direction to sort the events by"
        },
        "limit": {
          "type": "number",
          "description": "The maximum number of events to return"
        },
        "query": {
          "type": "object",
          "properties": {
            "address": {
              "type": "string",
              "description": "The pair contract address to filter by. If you pass a token address in here, it will instead find the top pair for that token and use that."
            },
            "amountNonLiquidityToken": {
              "type": "object",
              "properties": {
                "gt": {
                  "type": "number",
                  "description": "Greater than"
                },
                "gte": {
                  "type": "number",
                  "description": "Greater than or equal to"
                },
                "lt": {
                  "type": "number",
                  "description": "Less than"
                },
                "lte": {
                  "type": "number",
                  "description": "Less than or equal to"
                }
              },
              "additionalProperties": false,
              "description": "Filter by amount of non-liquidity token"
            },
            "eventDisplayType": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "Burn",
                  "Buy",
                  "Collect",
                  "CollectProtocol",
                  "Mint",
                  "Sell",
                  "Sync"
                ]
              },
              "description": "Filter by event display type"
            },
            "eventType": {
              "type": "string",
              "enum": [
                "Burn",
                "Collect",
                "CollectProtocol",
                "Mint",
                "PoolBalanceChanged",
                "Swap",
                "Sync"
              ],
              "description": "Filter by event type"
            },
            "maker": {
              "type": "string",
              "description": "Filter by maker address"
            },
            "networkId": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "The network ID to filter by"
            },
            "priceBaseToken": {
              "$ref": "#/properties/query/properties/amountNonLiquidityToken",
              "description": "Filter by price in base token"
            },
            "priceBaseTokenTotal": {
              "$ref": "#/properties/query/properties/amountNonLiquidityToken",
              "description": "Filter by total price in base token"
            },
            "priceUsd": {
              "$ref": "#/properties/query/properties/amountNonLiquidityToken",
              "description": "Filter by price in USD"
            },
            "priceUsdTotal": {
              "$ref": "#/properties/query/properties/amountNonLiquidityToken",
              "description": "Filter by total price in USD"
            },
            "quoteToken": {
              "type": "string",
              "enum": [
                "token0",
                "token1"
              ],
              "description": "Filter by quote token"
            },
            "timestamp": {
              "type": "object",
              "properties": {
                "from": {
                  "type": "number",
                  "description": "Start timestamp"
                },
                "to": {
                  "type": "number",
                  "description": "End timestamp"
                }
              },
              "required": [
                "from",
                "to"
              ],
              "additionalProperties": false,
              "description": "Filter by timestamp range"
            }
          },
          "required": [
            "address",
            "networkId"
          ],
          "additionalProperties": false,
          "description": "Query parameters for filtering token events"
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_wallet_token_activity",
    "description": "Get a list of token events for a given wallet address",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "description": "A cursor for use in pagination"
        },
        "direction": {
          "type": "string",
          "enum": [
            "ASC",
            "DESC"
          ],
          "description": "The direction to sort the events by"
        },
        "limit": {
          "type": "number",
          "description": "The maximum number of events to return"
        },
        "query": {
          "type": "object",
          "properties": {
            "eventType": {
              "type": "string",
              "enum": [
                "Burn",
                "Collect",
                "CollectProtocol",
                "Mint",
                "PoolBalanceChanged",
                "Swap",
                "Sync"
              ],
              "description": "The specific event type to filter by"
            },
            "maker": {
              "type": "string",
              "description": "The specific wallet address to filter by"
            },
            "networkId": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "The network ID to filter by"
            },
            "priceUsdTotal": {
              "type": "object",
              "properties": {
                "gt": {
                  "type": "number",
                  "description": "Greater than"
                },
                "gte": {
                  "type": "number",
                  "description": "Greater than or equal to"
                },
                "lt": {
                  "type": "number",
                  "description": "Less than"
                },
                "lte": {
                  "type": "number",
                  "description": "Less than or equal to"
                }
              },
              "additionalProperties": false,
              "description": "The total amount of quoteToken involved in the swap in USD"
            },
            "timestamp": {
              "type": "object",
              "properties": {
                "from": {
                  "type": "number",
                  "description": "Start timestamp"
                },
                "to": {
                  "type": "number",
                  "description": "End timestamp"
                }
              },
              "required": [
                "from",
                "to"
              ],
              "additionalProperties": false,
              "description": "The time range to filter by"
            },
            "tokenAddress": {
              "type": "string",
              "description": "The token involved in the event"
            }
          },
          "required": [
            "maker"
          ],
          "additionalProperties": false,
          "description": "Query parameters for filtering token events"
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_trading_pair_metrics",
    "description": "Get bucketed stats for a given token within a pair",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the pair is on"
        },
        "address": {
          "type": "string",
          "description": "The pair contract address"
        },
        "duration": {
          "type": "string",
          "enum": [
            "day1",
            "day30",
            "hour1",
            "hour4",
            "hour12",
            "min5",
            "min15",
            "week1"
          ],
          "description": "The duration for stats"
        },
        "bucketCount": {
          "type": "number",
          "description": "The number of aggregated values to receive. Note: Each duration has predetermined bucket sizes. The first n-1 buckets are historical. The last bucket is a snapshot of current data."
        },
        "timestamp": {
          "type": "number"
        },
        "tokenOfInterest": {
          "type": "string",
          "enum": [
            "token0",
            "token1"
          ]
        },
        "statsType": {
          "type": "string",
          "enum": [
            "FILTERED",
            "UNFILTERED"
          ],
          "description": "The type of statistics returned. Can be FILTERED or UNFILTERED"
        }
      },
      "required": [
        "networkId",
        "address",
        "duration"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_multiple_pairs_metrics",
    "description": "Get bucketed stats for a given token within a list of pairs",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the pairs are on"
        },
        "pairAddresses": {
          "type": "array",
          "items": {
            "type": "string",
            "description": "The pair contract address"
          },
          "description": "Array of pair contract addresses"
        },
        "duration": {
          "type": "string",
          "enum": [
            "day1",
            "day30",
            "hour1",
            "hour4",
            "hour12",
            "min5",
            "min15",
            "week1"
          ],
          "description": "The duration for stats"
        },
        "bucketCount": {
          "type": "number",
          "description": "The number of aggregated values to receive. Note: Each duration has predetermined bucket sizes. The first n-1 buckets are historical. The last bucket is a snapshot of current data."
        }
      },
      "required": [
        "networkId",
        "pairAddresses",
        "duration"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "search_filter_pairs",
    "description": "Get a list of pairs based on various filters like volume, price, liquidity, etc.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "object",
          "properties": {
            "buyCount1": {
              "type": "object",
              "properties": {
                "gt": {
                  "type": "number",
                  "description": "Greater than"
                },
                "gte": {
                  "type": "number",
                  "description": "Greater than or equal to"
                },
                "lt": {
                  "type": "number",
                  "description": "Less than"
                },
                "lte": {
                  "type": "number",
                  "description": "Less than or equal to"
                }
              },
              "additionalProperties": false,
              "description": "Filter for numeric values with comparison operators"
            },
            "buyCount4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "buyCount12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "buyCount24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "createdAt": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "exchangeAddress": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "highPrice1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "highPrice4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "highPrice12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "highPrice24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "lastTransaction": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "liquidity": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "lockedLiquidityPercentage": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "lowPrice1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "lowPrice4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "lowPrice12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "lowPrice24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "network": {
              "type": "array",
              "items": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "The network ID"
              }
            },
            "potentialScam": {
              "type": "boolean"
            },
            "price": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "priceChange1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "priceChange4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "priceChange12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "priceChange24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "sellCount1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "sellCount4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "sellCount12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "sellCount24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "tokenAddress": {
              "type": "array",
              "items": {
                "type": "string",
                "description": "The token contract address"
              },
              "description": "Array of token contract addresses"
            },
            "trendingIgnored": {
              "$ref": "#/properties/filters/properties/potentialScam"
            },
            "txnCount1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "txnCount4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "txnCount12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "txnCount24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueBuys1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueBuys4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueBuys12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueBuys24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueSells1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueSells4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueSells12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueSells24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueTransactions1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueTransactions4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueTransactions12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "uniqueTransactions24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "volumeChange1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "volumeChange4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "volumeChange12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "volumeChange24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "volumeUSD1": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "volumeUSD4": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "volumeUSD12": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            },
            "volumeUSD24": {
              "$ref": "#/properties/filters/properties/buyCount1",
              "description": "Filter for numeric values with comparison operators"
            }
          },
          "additionalProperties": false
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of items to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of items to skip"
        },
        "pairs": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            {
              "type": "string"
            }
          ]
        },
        "phrase": {
          "type": "string"
        },
        "rankings": {
          "anyOf": [
            {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "attribute": {
                    "type": "string",
                    "enum": [
                      "buyCount1",
                      "buyCount4",
                      "buyCount12",
                      "buyCount24",
                      "buyVolumeUSD1",
                      "buyVolumeUSD4",
                      "buyVolumeUSD12",
                      "buyVolumeUSD24",
                      "createdAt",
                      "highPrice1",
                      "highPrice4",
                      "highPrice12",
                      "highPrice24",
                      "lastTransaction",
                      "liquidity",
                      "lockedLiquidityPercentage",
                      "lowPrice1",
                      "lowPrice4",
                      "lowPrice12",
                      "lowPrice24",
                      "marketCap",
                      "price",
                      "priceChange1",
                      "priceChange4",
                      "priceChange12",
                      "priceChange24",
                      "sellCount1",
                      "sellCount4",
                      "sellCount12",
                      "sellCount24",
                      "sellVolumeUSD1",
                      "sellVolumeUSD4",
                      "sellVolumeUSD12",
                      "sellVolumeUSD24",
                      "swapPct1dOldWallet",
                      "swapPct7dOldWallet",
                      "trendingScore",
                      "trendingScore1",
                      "trendingScore4",
                      "trendingScore5m",
                      "trendingScore12",
                      "trendingScore24",
                      "txnCount1",
                      "txnCount4",
                      "txnCount12",
                      "txnCount24",
                      "uniqueBuys1",
                      "uniqueBuys4",
                      "uniqueBuys12",
                      "uniqueBuys24",
                      "uniqueSells1",
                      "uniqueSells4",
                      "uniqueSells12",
                      "uniqueSells24",
                      "uniqueTransactions1",
                      "uniqueTransactions4",
                      "uniqueTransactions12",
                      "uniqueTransactions24",
                      "volumeChange1",
                      "volumeChange4",
                      "volumeChange12",
                      "volumeChange24",
                      "volumeUSD1",
                      "volumeUSD4",
                      "volumeUSD12",
                      "volumeUSD24",
                      "walletAgeAvg",
                      "walletAgeStd"
                    ]
                  },
                  "direction": {
                    "type": "string",
                    "enum": [
                      "ASC",
                      "DESC"
                    ]
                  }
                },
                "required": [
                  "attribute",
                  "direction"
                ],
                "additionalProperties": false
              }
            },
            {
              "type": "object",
              "properties": {
                "attribute": {
                  "type": "string",
                  "enum": [
                    "buyCount1",
                    "buyCount4",
                    "buyCount12",
                    "buyCount24",
                    "buyVolumeUSD1",
                    "buyVolumeUSD4",
                    "buyVolumeUSD12",
                    "buyVolumeUSD24",
                    "createdAt",
                    "highPrice1",
                    "highPrice4",
                    "highPrice12",
                    "highPrice24",
                    "lastTransaction",
                    "liquidity",
                    "lockedLiquidityPercentage",
                    "lowPrice1",
                    "lowPrice4",
                    "lowPrice12",
                    "lowPrice24",
                    "marketCap",
                    "price",
                    "priceChange1",
                    "priceChange4",
                    "priceChange12",
                    "priceChange24",
                    "sellCount1",
                    "sellCount4",
                    "sellCount12",
                    "sellCount24",
                    "sellVolumeUSD1",
                    "sellVolumeUSD4",
                    "sellVolumeUSD12",
                    "sellVolumeUSD24",
                    "swapPct1dOldWallet",
                    "swapPct7dOldWallet",
                    "trendingScore",
                    "trendingScore1",
                    "trendingScore4",
                    "trendingScore5m",
                    "trendingScore12",
                    "trendingScore24",
                    "txnCount1",
                    "txnCount4",
                    "txnCount12",
                    "txnCount24",
                    "uniqueBuys1",
                    "uniqueBuys4",
                    "uniqueBuys12",
                    "uniqueBuys24",
                    "uniqueSells1",
                    "uniqueSells4",
                    "uniqueSells12",
                    "uniqueSells24",
                    "uniqueTransactions1",
                    "uniqueTransactions4",
                    "uniqueTransactions12",
                    "uniqueTransactions24",
                    "volumeChange1",
                    "volumeChange4",
                    "volumeChange12",
                    "volumeChange24",
                    "volumeUSD1",
                    "volumeUSD4",
                    "volumeUSD12",
                    "volumeUSD24",
                    "walletAgeAvg",
                    "walletAgeStd"
                  ]
                },
                "direction": {
                  "type": "string",
                  "enum": [
                    "ASC",
                    "DESC"
                  ]
                }
              },
              "required": [
                "attribute",
                "direction"
              ],
              "additionalProperties": false
            }
          ]
        },
        "statsType": {
          "type": "string",
          "enum": [
            "FILTERED",
            "UNFILTERED"
          ],
          "description": "The type of statistics returned. Can be FILTERED or UNFILTERED"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_pair_information",
    "description": "Get metadata for a pair of tokens, including price, volume, and liquidity stats over various timeframes.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the pair is on"
        },
        "address": {
          "type": "string",
          "description": "The pair contract address"
        },
        "quoteToken": {
          "type": "string",
          "enum": [
            "token0",
            "token1"
          ],
          "description": "The token of interest (token0 or token1)"
        },
        "statsType": {
          "type": "string",
          "enum": [
            "FILTERED",
            "UNFILTERED"
          ],
          "description": "The type of statistics returned. Can be FILTERED or UNFILTERED"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "list_token_pairs",
    "description": "Get a list of pairs for a token",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the token is on"
        },
        "address": {
          "type": "string",
          "description": "The token contract address"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of pairs to return (default: 10)"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_token_pairs_details",
    "description": "Get pairs with metadata for a specific token",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the token is on"
        },
        "address": {
          "type": "string",
          "description": "The token contract address"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of pairs to return (default: 10)"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "retrieve_liquidity_information",
    "description": "Get liquidity metadata for a pair, including both unlocked and locked liquidity data",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the pair is on"
        },
        "address": {
          "type": "string",
          "description": "The pair contract address"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "fetch_liquidity_lock_details",
    "description": "Get liquidity locks for a pair, including details about locked amounts, lock duration, and owner information",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the pair is on"
        },
        "address": {
          "type": "string",
          "description": "The pair contract address"
        },
        "cursor": {
          "type": "string",
          "description": "Cursor for pagination"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "search_exchange_platforms",
    "description": "Get a list of exchanges based on various filters like volume, transactions, active users, etc.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "filters": {
          "type": "object",
          "properties": {
            "address": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "The list of exchange contract addresses to filter by"
            },
            "dailyActiveUsers": {
              "type": "object",
              "properties": {
                "gt": {
                  "type": "number",
                  "description": "Greater than"
                },
                "gte": {
                  "type": "number",
                  "description": "Greater than or equal to"
                },
                "lt": {
                  "type": "number",
                  "description": "Less than"
                },
                "lte": {
                  "type": "number",
                  "description": "Less than or equal to"
                }
              },
              "additionalProperties": false,
              "description": "The total unique daily active users"
            },
            "monthlyActiveUsers": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The total unique monthly active users (30 days)"
            },
            "network": {
              "type": "array",
              "items": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "The network ID"
              },
              "description": "The list of network IDs to filter by"
            },
            "txnCount1": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The number of transactions on the exchange in the past hour"
            },
            "txnCount4": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The number of transactions on the exchange in the past 4 hours"
            },
            "txnCount12": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The number of transactions on the exchange in the past 12 hours"
            },
            "txnCount24": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The number of transactions on the exchange in the past 24 hours"
            },
            "volumeNBT1": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The trade volume in the network's base token in the past hour"
            },
            "volumeNBT4": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The trade volume in the network's base token in the past 4 hours"
            },
            "volumeNBT12": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The trade volume in the network's base token in the past 12 hours"
            },
            "volumeNBT24": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The trade volume in the network's base token in the past 24 hours"
            },
            "volumeUSD1": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The trade volume in USD in the past hour"
            },
            "volumeUSD4": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The trade volume in USD in the past 4 hours"
            },
            "volumeUSD12": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The trade volume in USD in the past 12 hours"
            },
            "volumeUSD24": {
              "$ref": "#/properties/filters/properties/dailyActiveUsers",
              "description": "The trade volume in USD in the past 24 hours"
            }
          },
          "additionalProperties": false
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of items to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of items to skip"
        },
        "phrase": {
          "type": "string",
          "description": "A phrase to search for. Can match an exchange address or ID (address:networkId), or partially match an exchange name"
        },
        "rankings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "attribute": {
                "type": "string",
                "enum": [
                  "dailyActiveUsers",
                  "monthlyActiveUsers",
                  "txnCount1",
                  "txnCount4",
                  "txnCount12",
                  "txnCount24",
                  "volumeNBT1",
                  "volumeNBT4",
                  "volumeNBT12",
                  "volumeNBT24",
                  "volumeUSD1",
                  "volumeUSD4",
                  "volumeUSD12",
                  "volumeUSD24"
                ]
              },
              "direction": {
                "type": "string",
                "enum": [
                  "ASC",
                  "DESC"
                ]
              }
            },
            "required": [
              "attribute",
              "direction"
            ],
            "additionalProperties": false
          },
          "description": "A list of ranking attributes to apply"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "network_exchanges_list",
    "description": "Get a list of exchanges on a specific network",
    "inputSchema": {
      "type": "object",
      "properties": {
        "showNameless": {
          "type": "boolean",
          "description": "Whether to show exchanges without names"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "pair_chart_metadata",
    "description": "Returns charting metadata for a given pair. Used for implementing a Trading View datafeed.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "symbol": {
          "type": "string",
          "description": "The ID of the pair in format 'address:networkId' (e.g., '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc:1')"
        },
        "currencyCode": {
          "type": "string",
          "description": "The currency to use for the response. Can be 'USD' (default) or 'TOKEN'"
        }
      },
      "required": [
        "symbol"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "event_labels_list",
    "description": "Get a list of event labels that can be used to categorize events",
    "inputSchema": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "The ID to get event labels for"
        },
        "cursor": {
          "type": "string",
          "description": "Cursor for pagination"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of items to return"
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "wallets_search_filter",
    "description": "Search and filter blockchain wallets based on various criteria.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "excludeLabels": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "filters": {},
        "includeLabels": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "limit": {
          "type": "number"
        },
        "offset": {
          "type": "number"
        },
        "rankings": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "attribute": {
                "type": "string",
                "enum": [
                  "averageProfitUsdPerTrade1d",
                  "averageProfitUsdPerTrade1w",
                  "averageProfitUsdPerTrade1y",
                  "averageProfitUsdPerTrade30d",
                  "averageSwapAmountUsd1d",
                  "averageSwapAmountUsd1w",
                  "averageSwapAmountUsd1y",
                  "averageSwapAmountUsd30d",
                  "botScore",
                  "firstTransactionAt",
                  "lastTransactionAt",
                  "nativeTokenBalance",
                  "realizedProfitPercentage1d",
                  "realizedProfitPercentage1w",
                  "realizedProfitPercentage1y",
                  "realizedProfitPercentage30d",
                  "realizedProfitUsd1d",
                  "realizedProfitUsd1w",
                  "realizedProfitUsd1y",
                  "realizedProfitUsd30d",
                  "scammerScore",
                  "swaps1d",
                  "swaps1w",
                  "swaps1y",
                  "swaps30d",
                  "swapsAll1d",
                  "swapsAll1w",
                  "swapsAll1y",
                  "swapsAll30d",
                  "uniqueTokens1d",
                  "uniqueTokens1w",
                  "uniqueTokens1y",
                  "uniqueTokens30d",
                  "volumeUsd1d",
                  "volumeUsd1w",
                  "volumeUsd1y",
                  "volumeUsd30d",
                  "volumeUsdAll1d",
                  "volumeUsdAll1w",
                  "volumeUsdAll1y",
                  "volumeUsdAll30d",
                  "winRate1d",
                  "winRate1w",
                  "winRate1y",
                  "winRate30d"
                ]
              },
              "direction": {
                "type": "string",
                "enum": [
                  "ASC",
                  "DESC"
                ]
              }
            },
            "required": [
              "attribute",
              "direction"
            ],
            "additionalProperties": false
          }
        },
        "wallets": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "token_wallets_filter",
    "description": "Filter wallets that hold or trade a specific token.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "excludeLabels": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "filters": {},
        "filtersV2": {},
        "includeLabels": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "limit": {
          "type": "number"
        },
        "networkId": {
          "type": "number"
        },
        "offset": {
          "type": "number"
        },
        "phrase": {
          "type": "string"
        },
        "rankings": {
          "type": "array"
        },
        "tokenId": {
          "type": "string"
        },
        "walletAddress": {
          "type": "string"
        },
        "wallets": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "wallet_detailed_stats",
    "description": "Get comprehensive statistics for a wallet.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID"
        },
        "walletAddress": {
          "type": "string",
          "description": "The wallet address"
        },
        "timestamp": {
          "type": "number",
          "description": "Unix timestamp"
        },
        "includeNetworkBreakdown": {
          "type": "boolean"
        }
      },
      "required": [
        "walletAddress"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "wallet_chart_data",
    "description": "Generate chart data for wallet.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID"
        },
        "range": {
          "type": "object",
          "properties": {
            "start": {
              "type": "number",
              "description": "Unix timestamp"
            },
            "end": {
              "$ref": "#/properties/range/properties/start"
            }
          },
          "required": [
            "start",
            "end"
          ],
          "additionalProperties": false
        },
        "resolution": {
          "type": "string",
          "description": "Available options are `1S`, `5S`, `15S`, `30S`, `1`, `5`, `15`, `30`, `60`, `240`, `720`, `1D`, `7D`."
        },
        "walletAddress": {
          "type": "string",
          "description": "The wallet address"
        }
      },
      "required": [
        "range",
        "resolution",
        "walletAddress"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_pool_details",
    "description": "Get detailed information about a specific NFT pool including pool balance, spot price, NFT assets, fees, and trading statistics. Supports AMM NFT marketplaces like Sudoswap.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "address": {
          "type": "string",
          "description": "The NFT pool address"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID where the pool exists"
        }
      },
      "required": [
        "address",
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_pool_events_data",
    "description": "Get transaction events for NFT pools across all AMM NFT marketplaces. Returns detailed event data including swaps, deposits, withdrawals, price updates, and pool management activities.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID to get events for"
        },
        "collectionAddress": {
          "type": "string",
          "description": "Filter by NFT collection address"
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "eventTypes": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "ASSET_RECIPIENT_CHANGE",
              "DELTA_UPDATE",
              "FEE_UPDATE",
              "NEW_POOL",
              "NEW_POOL_V2",
              "NFT_DEPOSIT",
              "NFT_DEPOSIT_V2",
              "NFT_WITHDRAWAL",
              "NFT_WITHDRAWAL_V2",
              "OWNERSHIP_TRANSFERRED",
              "SPOT_PRICE_UPDATE",
              "SPOT_PRICE_UPDATE_V2",
              "SWAP_NFT_IN_POOL",
              "SWAP_NFT_IN_POOL_V2",
              "SWAP_NFT_OUT_POOL",
              "SWAP_NFT_OUT_POOL_V2",
              "TOKEN_DEPOSIT",
              "TOKEN_DEPOSIT_V2",
              "TOKEN_WITHDRAWAL",
              "TOKEN_WITHDRAWAL_V2"
            ]
          },
          "description": "Filter by event types"
        },
        "exchangeAddress": {
          "type": "string",
          "description": "Filter by exchange address"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of events to return"
        },
        "poolAddress": {
          "type": "string",
          "description": "Filter by specific pool address"
        },
        "timestamp": {
          "type": "object",
          "properties": {
            "from": {
              "type": "number",
              "description": "Unix timestamp"
            },
            "to": {
              "$ref": "#/properties/timestamp/properties/from",
              "description": "Unix timestamp"
            }
          },
          "additionalProperties": false,
          "description": "Filter by timestamp range"
        }
      },
      "required": [
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_collection_pool_stats",
    "description": "Get aggregated pool statistics and metadata for a specific NFT collection on a given AMM NFT exchange. Returns collection-wide liquidity, volume, fees, and floor price data.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "collectionAddress": {
          "type": "string",
          "description": "The NFT collection address"
        },
        "exchangeAddress": {
          "type": "string",
          "description": "The exchange address"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID"
        }
      },
      "required": [
        "collectionAddress",
        "exchangeAddress",
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "exchange_nft_collections",
    "description": "Get all NFT collections that have liquidity pools on a specific AMM NFT exchange. Returns collection metadata, liquidity statistics, and trading metrics for each collection.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchangeAddress": {
          "type": "string",
          "description": "The exchange address"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID"
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of collections to return"
        }
      },
      "required": [
        "exchangeAddress",
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "collection_exchange_pools",
    "description": "Get all liquidity pools for a specific NFT collection on a given AMM NFT exchange. Returns detailed pool information including balances, pricing, assets, and trading statistics.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "collectionAddress": {
          "type": "string",
          "description": "The NFT collection address"
        },
        "exchangeAddress": {
          "type": "string",
          "description": "The exchange address"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID"
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of pools to return"
        }
      },
      "required": [
        "collectionAddress",
        "exchangeAddress",
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "owner_nft_pools",
    "description": "Get all NFT liquidity pools owned by a specific wallet address across AMM NFT marketplaces. Returns detailed pool information including assets, balances, and performance metrics.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID"
        },
        "ownerAddress": {
          "type": "string",
          "description": "The owner's wallet address"
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "exchangeAddress": {
          "type": "string",
          "description": "Filter by specific exchange address"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of pools to return"
        }
      },
      "required": [
        "networkId",
        "ownerAddress"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_collections_search",
    "description": "Search and filter NFT collections based on various criteria including volume, floor price, trading activity, and metadata. All parameters are optional - use filters for advanced criteria.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "collections": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "List of collection addresses to filter by"
        },
        "filters": {
          "description": "NftCollectionFilters object for advanced filtering"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of collections to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of items to skip for pagination"
        },
        "phrase": {
          "type": "string",
          "description": "Search phrase to match collection names"
        },
        "rankings": {
          "type": "array",
          "description": "Ranking criteria for sorting results"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_pool_collections_search",
    "description": "Search and filter NFT collections that have liquidity pools on AMM NFT marketplaces. Returns collections with pool statistics and trading metrics. All parameters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "filters": {
          "description": "NftPoolCollectionFilters object for advanced filtering"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of collections to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of items to skip for pagination"
        },
        "phrase": {
          "type": "string",
          "description": "Search phrase to match collection names"
        },
        "rankings": {
          "type": "array",
          "description": "Ranking criteria for sorting results"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nfts_search_advanced",
    "description": "Search for NFTs across collections and marketplaces with advanced filtering options. Returns comprehensive NFT data including metadata, pricing, and trading history. All parameters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "filterWashTrading": {
          "type": "boolean",
          "description": "Whether to filter out wash trading"
        },
        "include": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "Asset",
                "Collection"
              ]
            },
            {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "Asset",
                  "Collection"
                ]
              }
            }
          ],
          "description": "Types of NFT data to include in search"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of results to return"
        },
        "networkFilter": {
          "type": "array",
          "items": {
            "type": "number",
            "exclusiveMinimum": 0,
            "description": "The network ID"
          },
          "description": "List of network IDs to search within"
        },
        "search": {
          "type": "string",
          "description": "Search query string"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_pools_search",
    "description": "Search and filter NFT liquidity pools based on various criteria including liquidity, volume, pool type, and performance metrics. All parameters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "filters": {
          "description": "NftPoolFilters object for advanced filtering"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of pools to return"
        },
        "offset": {
          "type": "number",
          "description": "Number of items to skip for pagination"
        },
        "phrase": {
          "type": "string",
          "description": "Search phrase to match pool details"
        },
        "rankings": {
          "anyOf": [
            {
              "type": "object",
              "properties": {
                "attribute": {
                  "type": "string",
                  "enum": [
                    "balanceNBT",
                    "balanceUSD",
                    "expenseNBT24",
                    "expenseNBTAll",
                    "expenseUSD24",
                    "expenseUSDAll",
                    "nftBalance",
                    "nftVolume24",
                    "nftVolumeAll",
                    "nftsBought24",
                    "nftsBoughtAll",
                    "nftsSold24",
                    "nftsSoldAll",
                    "offerNBT",
                    "offerUSD",
                    "poolFeesNBT24",
                    "poolFeesNBTAll",
                    "poolFeesUSD24",
                    "poolFeesUSDAll",
                    "protocolFeesNBT24",
                    "protocolFeesNBTAll",
                    "protocolFeesUSD24",
                    "protocolFeesUSDAll",
                    "revenueNBT24",
                    "revenueNBTAll",
                    "revenueUSD24",
                    "revenueUSDAll",
                    "sellNBT",
                    "sellUSD",
                    "volumeNBT24",
                    "volumeNBTAll",
                    "volumeUSD24",
                    "volumeUSDAll"
                  ],
                  "description": "The attribute to rank NFT pools by"
                },
                "direction": {
                  "type": "string",
                  "enum": [
                    "ASC",
                    "DESC"
                  ],
                  "description": "The direction to apply to the ranking attribute"
                }
              },
              "required": [
                "direction"
              ],
              "additionalProperties": false
            },
            {
              "type": "array",
              "items": {
                "$ref": "#/properties/rankings/anyOf/0"
              }
            }
          ],
          "description": "Ranking criteria for sorting results - can be a single ranking or array of rankings"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_collection_assets",
    "description": "Get individual NFT assets from a collection with detailed metadata including attributes, media, and token-specific information. Address and networkId are required.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "address": {
          "type": "string",
          "description": "Collection contract address (required)"
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "fetchMissingAssets": {
          "type": "boolean",
          "description": "Whether to fetch missing asset metadata"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of assets to return"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Network ID (required)"
        },
        "tokenIds": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Specific token IDs to fetch"
        }
      },
      "required": [
        "address",
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_collection_detailed_stats",
    "description": "Get bucketed statistical data for NFT collections over time including volume, price movements, and trading metrics across specified time periods. CollectionAddress and networkId are required.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "bucketCount": {
          "type": "number",
          "description": "Number of time buckets for statistics"
        },
        "collectionAddress": {
          "type": "string",
          "description": "Collection contract address (required)"
        },
        "durations": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "day1",
                "day30",
                "hour1",
                "hour4",
                "hour12",
                "week1"
              ]
            },
            {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "day1",
                  "day30",
                  "hour1",
                  "hour4",
                  "hour12",
                  "week1"
                ]
              }
            }
          ],
          "description": "Time durations for statistics"
        },
        "grouping": {
          "type": "string",
          "description": "Grouping strategy for statistics"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Network ID (required)"
        },
        "timestamp": {
          "type": "number",
          "description": "Timestamp for historical data"
        }
      },
      "required": [
        "collectionAddress",
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_collection_events",
    "description": "Get transaction events for NFT collections across marketplaces including sales, transfers, mints, and other activities. NetworkId is required, other filters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "address": {
          "type": "string",
          "description": "Collection contract address"
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "exchangeAddress": {
          "type": "string",
          "description": "Exchange address to filter by"
        },
        "includeTransfers": {
          "type": "boolean",
          "description": "Whether to include transfer events"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of events to return"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Network ID (required)"
        },
        "poolAddress": {
          "type": "string",
          "description": "Pool address to filter by"
        },
        "timestamp": {
          "type": "object",
          "properties": {
            "from": {
              "type": "number",
              "description": "Unix timestamp"
            },
            "to": {
              "$ref": "#/properties/timestamp/properties/from",
              "description": "Unix timestamp"
            }
          },
          "additionalProperties": false,
          "description": "Timestamp range filter"
        },
        "tokenId": {
          "type": "string",
          "description": "Specific token ID to filter by"
        }
      },
      "required": [
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_contracts_metadata",
    "description": "Get enhanced contract information for NFT collections including metadata, social links, and labels. Provide a list of contract addresses and network IDs.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "contracts": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "address": {
                "type": "string"
              },
              "networkId": {
                "type": "number",
                "exclusiveMinimum": 0,
                "description": "The network ID"
              }
            },
            "required": [
              "address",
              "networkId"
            ],
            "additionalProperties": false
          },
          "description": "List of contract addresses and network IDs"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "parallel_assets_search",
    "description": "Search and filter Parallel trading card game assets with advanced filtering and matching criteria. Returns card metadata, game stats, and pricing information. All parameters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "filters": {
          "description": "ParallelAssetFilters object for advanced filtering"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of assets to return"
        },
        "match": {
          "description": "ParallelAssetMatchers for matching criteria"
        },
        "offset": {
          "type": "number",
          "description": "Number of items to skip for pagination"
        },
        "phrase": {
          "type": "string",
          "description": "Search phrase for asset names"
        },
        "rankings": {
          "type": "array",
          "description": "Ranking criteria for sorting results"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "parallel_card_changes",
    "description": "Get changes made to Parallel trading card metadata over time including updates to stats, artwork, and game mechanics. All parameters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of changes to return"
        },
        "parallelId": {
          "type": "number",
          "description": "Specific Parallel card ID"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "prime_pool_assets_data",
    "description": "Get assets in Prime ecosystem pools including liquidity pool compositions and asset details. NetworkId is required, other parameters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of assets to return"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Network ID (required)"
        },
        "poolContractAddress": {
          "type": "string",
          "description": "Specific pool contract address to filter by"
        },
        "poolId": {
          "type": "string",
          "description": "Specific pool ID to filter by"
        },
        "walletAddress": {
          "type": "string",
          "description": "Specific wallet address to filter by"
        }
      },
      "required": [
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "prime_pool_events_data",
    "description": "Get transaction events for Prime ecosystem pools including liquidity changes, swaps, and pool management activities. NetworkId is required, other parameters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "eventTypes": {
          "anyOf": [
            {
              "type": "string",
              "enum": [
                "CACHE",
                "CACHING_PAUSED",
                "CLAIM",
                "EMERGENCY_WITHDRAW",
                "END_TIMESTAMP_UPDATED",
                "ETH_REWARDS_ADDED",
                "ETH_REWARDS_SET",
                "LOG_POOL_ADDITION",
                "LOG_POOL_SET_ALLOC_POINT",
                "LOG_SET_PER_SECOND",
                "LOG_UPDATE_POOL",
                "POOL_DISCOVERED",
                "REWARD_DECREASE",
                "REWARD_INCREASE",
                "TIME_CACHE_PERIOD_UPDATED",
                "WITHDRAW"
              ]
            },
            {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "CACHE",
                  "CACHING_PAUSED",
                  "CLAIM",
                  "EMERGENCY_WITHDRAW",
                  "END_TIMESTAMP_UPDATED",
                  "ETH_REWARDS_ADDED",
                  "ETH_REWARDS_SET",
                  "LOG_POOL_ADDITION",
                  "LOG_POOL_SET_ALLOC_POINT",
                  "LOG_SET_PER_SECOND",
                  "LOG_UPDATE_POOL",
                  "POOL_DISCOVERED",
                  "REWARD_DECREASE",
                  "REWARD_INCREASE",
                  "TIME_CACHE_PERIOD_UPDATED",
                  "WITHDRAW"
                ]
              }
            }
          ],
          "description": "Types of events to include - can be a single event type or array of event types"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of events to return"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Network ID (required)"
        },
        "poolContractAddress": {
          "type": "string",
          "description": "Specific pool contract address to filter by"
        },
        "poolId": {
          "type": "string",
          "description": "Specific pool ID to filter by"
        },
        "walletAddress": {
          "type": "string",
          "description": "Specific wallet address to filter by"
        }
      },
      "required": [
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "prime_pools_info",
    "description": "Get information about Prime ecosystem pools including pool statistics, liquidity, and performance metrics. Address and networkId are required.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "address": {
          "type": "string",
          "description": "Pool address (required)"
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of pools to return"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Network ID (required)"
        }
      },
      "required": [
        "address",
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "nft_collection_holders",
    "description": "Get holders of a specific NFT collection ordered by holdings with detailed balance information. CollectionAddress and networkId are required.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "collectionAddress": {
          "type": "string",
          "description": "Collection contract address (required)"
        },
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Network ID (required)"
        }
      },
      "required": [
        "collectionAddress",
        "networkId"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "wallet_nft_collections_data",
    "description": "Get NFT collections held by a specific wallet including collection metadata and holding quantities. Input requires walletAddress.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "input": {
          "type": "object",
          "properties": {
            "cursor": {
              "type": "string",
              "description": "Pagination cursor"
            },
            "walletAddress": {
              "type": "string",
              "description": "Wallet address (required)"
            }
          },
          "required": [
            "walletAddress"
          ],
          "additionalProperties": false,
          "description": "WalletNftCollectionsInput object (required)"
        }
      },
      "required": [
        "input"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "wallet_collection_assets",
    "description": "Get specific NFT assets held by a wallet from a particular collection including token metadata and ownership details. Input requires collectionId in format 'collectionAddress:networkId' and walletAddress.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "input": {
          "type": "object",
          "properties": {
            "collectionId": {
              "type": "string",
              "description": "Collection ID in format collectionAddress:networkId (required)"
            },
            "cursor": {
              "type": "string",
              "description": "Pagination cursor"
            },
            "walletAddress": {
              "type": "string",
              "description": "Wallet address (required)"
            }
          },
          "required": [
            "collectionId",
            "walletAddress"
          ],
          "additionalProperties": false,
          "description": "WalletNftCollectionAssetsInput object (required)"
        }
      },
      "required": [
        "input"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "token_lifecycle_events",
    "description": "Get mint and burn events for a specific token including amounts, timestamps, and supply changes. Address and networkId are required.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        },
        "limit": {
          "type": "number",
          "description": "Maximum number of events to return"
        },
        "query": {
          "type": "object",
          "properties": {
            "address": {
              "type": "string",
              "description": "Token contract address (required)"
            },
            "networkId": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Network ID (required)"
            }
          },
          "required": [
            "address",
            "networkId"
          ],
          "additionalProperties": false,
          "description": "Query parameters for token lifecycle events"
        }
      },
      "required": [
        "query"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "token_top_traders_stats",
    "description": "Get the top traders for a specific token over a specified time period including trading volumes, profits, and transaction counts. TokenAddress, networkId, and tradingPeriod are required.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "input": {
          "type": "object",
          "properties": {
            "limit": {
              "type": "number",
              "description": "Number of traders to return"
            },
            "networkId": {
              "type": "number",
              "exclusiveMinimum": 0,
              "description": "Network ID (required)"
            },
            "offset": {
              "type": "number",
              "description": "Offset for pagination"
            },
            "tokenAddress": {
              "type": "string",
              "description": "Token contract address (required)"
            },
            "tradingPeriod": {
              "type": "string",
              "enum": [
                "DAY",
                "MONTH",
                "WEEK",
                "YEAR"
              ],
              "description": "Trading period (DAY, WEEK, MONTH, YEAR)"
            }
          },
          "required": [
            "networkId",
            "tokenAddress",
            "tradingPeriod"
          ],
          "additionalProperties": false,
          "description": "Input parameters for token top traders query"
        }
      },
      "required": [
        "input"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "token_liquidity_metadata",
    "description": "Get liquidity metadata for all pairs of a given token",
    "inputSchema": {
      "type": "object",
      "properties": {
        "networkId": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "The network ID the token is on"
        },
        "address": {
          "type": "string",
          "description": "The token contract address"
        }
      },
      "required": [
        "networkId",
        "address"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "community_notes_data",
    "description": "Get community gathered notes and annotations. Returns community-contributed information and insights.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "description": "Cursor for pagination"
        },
        "filter": {},
        "limit": {
          "type": "number",
          "description": "Maximum number of items to return"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "prime_token_holders",
    "description": "Get holders of Prime tokens with detailed balance information, USD values, and token metadata. All parameters are optional.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "cursor": {
          "type": "string",
          "description": "Pagination cursor"
        }
      },
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  },
  {
    "name": "discover_topic_influencers",
    "description": "Get the top creators for a social topic",
    "inputSchema": {
      "type": "object",
      "properties": {
        "topic": {
          "type": "string",
          "description": "The cryptocurrency symbol or topic to get creators for (e.g., BTC, ETH, DOGE)",
          "example": "BTC"
        }
      },
      "required": [
        "topic"
      ]
    }
  },
  {
    "name": "fetch_topic_news_articles",
    "description": "Get the top news posts for a social topic. Top news is determined by the metrics related to the social posts that mention the news posts.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "topic": {
          "type": "string",
          "description": "The cryptocurrency symbol or topic to get news for (e.g., BTC, ETH, DOGE)",
          "example": "BTC"
        }
      },
      "required": [
        "topic"
      ]
    }
  },
  {
    "name": "analyze_topic_social_posts",
    "description": "Get the top posts for a social topic. If start time is provided the result will be the top posts by interactions for the time range. If start is not provided it will be the most recent top posts by interactions from the last 24 hours.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "topic": {
          "type": "string",
          "description": "The cryptocurrency symbol or topic to get posts for (e.g., BTC, ETH, DOGE)",
          "example": "BTC"
        },
        "start": {
          "type": "string",
          "description": "Start timestamp (Unix timestamp in seconds)",
          "example": "1640995200"
        },
        "end": {
          "type": "string",
          "description": "End timestamp (Unix timestamp in seconds)",
          "example": "1641081600"
        }
      },
      "required": [
        "topic"
      ]
    }
  },
  {
    "name": "retrieve_topic_metrics",
    "description": "Get summary information for a social topic. The output is a 24 hour aggregation social activity with metrics comparing the latest 24 hours to the previous 24 hours.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "topic": {
          "type": "string",
          "description": "The cryptocurrency symbol or topic to get information for (e.g., BTC, ETH, DOGE)",
          "example": "BTC"
        }
      },
      "required": [
        "topic"
      ]
    }
  },
  {
    "name": "list_trending_topics",
    "description": "Get a list of trending social topics.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "analyze_category_overview",
    "description": "Get summary information for a social category",
    "inputSchema": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "description": "The category to get information for",
          "example": "DeFi"
        }
      },
      "required": [
        "category"
      ]
    }
  },
  {
    "name": "discover_category_topics",
    "description": "Get the top topics for a social category",
    "inputSchema": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "description": "The category to get topics for",
          "example": "DeFi"
        }
      },
      "required": [
        "category"
      ]
    }
  },
  {
    "name": "fetch_category_social_content",
    "description": "Get the top posts for a social topic. If start time is provided the result will be the top posts by interactions for the time range. If start is not provided it will be the most recent top posts by interactions from the last 24 hours.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "description": "The category to get posts for",
          "example": "DeFi"
        },
        "start": {
          "type": "string",
          "description": "Start timestamp (Unix timestamp in seconds)",
          "example": "1640995200"
        },
        "end": {
          "type": "string",
          "description": "End timestamp (Unix timestamp in seconds)",
          "example": "1641081600"
        }
      },
      "required": [
        "category"
      ]
    }
  },
  {
    "name": "retrieve_category_news_feed",
    "description": "Get the top news posts for a category. Top news is determined by the metrics related to the social posts that mention the news posts.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "description": "The category to get news for",
          "example": "DeFi"
        }
      },
      "required": [
        "category"
      ]
    }
  },
  {
    "name": "list_category_influencers",
    "description": "Get the top creators for a social category",
    "inputSchema": {
      "type": "object",
      "properties": {
        "category": {
          "type": "string",
          "description": "The category to get creators for",
          "example": "DeFi"
        }
      },
      "required": [
        "category"
      ]
    }
  },
  {
    "name": "browse_trending_categories",
    "description": "Get a list of trending social categories.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "rank_social_influencers",
    "description": "Get a list of trending social creators over all of social based on interactions. To get lists of creators by category or topic see the topics and categories endpoints.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "fetch_creator_profile",
    "description": "Get detail information on a specific creator",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string",
          "description": "The social network (e.g., twitter, youtube)",
          "example": "twitter"
        },
        "id": {
          "type": "string",
          "description": "The creator ID on the network",
          "example": "elonmusk"
        }
      },
      "required": [
        "network",
        "id"
      ]
    }
  },
  {
    "name": "track_creator_performance",
    "description": "Get time series data on a creator.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string",
          "description": "The social network (e.g., twitter, youtube)",
          "example": "twitter"
        },
        "id": {
          "type": "string",
          "description": "The creator ID on the network",
          "example": "elonmusk"
        },
        "bucket": {
          "type": "string",
          "description": "Time bucket for data aggregation"
        },
        "interval": {
          "type": "string",
          "description": "Time interval for the data points"
        },
        "start": {
          "type": "string",
          "description": "Start timestamp (Unix timestamp in seconds)",
          "example": "1640995200"
        },
        "end": {
          "type": "string",
          "description": "End timestamp (Unix timestamp in seconds)",
          "example": "1641081600"
        }
      },
      "required": [
        "network",
        "id"
      ]
    }
  },
  {
    "name": "analyze_creator_content",
    "description": "Get the top posts for a specific creator.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "network": {
          "type": "string",
          "description": "The social network (e.g., twitter, youtube)",
          "example": "twitter"
        },
        "id": {
          "type": "string",
          "description": "The creator ID on the network",
          "example": "elonmusk"
        },
        "start": {
          "type": "string",
          "description": "Start timestamp (Unix timestamp in seconds)",
          "example": "1640995200"
        },
        "end": {
          "type": "string",
          "description": "End timestamp (Unix timestamp in seconds)",
          "example": "1641081600"
        }
      },
      "required": [
        "network",
        "id"
      ]
    }
  },
  {
    "name": "retrieve_post_analytics",
    "description": "Get details of a post",
    "inputSchema": {
      "type": "object",
      "properties": {
        "post_type": {
          "type": "string",
          "description": "The type of post (e.g., twitter, youtube)",
          "example": "twitter"
        },
        "post_id": {
          "type": "string",
          "description": "The ID of the post",
          "example": "1234567890"
        }
      },
      "required": [
        "post_type",
        "post_id"
      ]
    }
  },
  {
    "name": "monitor_post_engagement",
    "description": "Get interactions over time for a post. If a post is older than 365 days the time series will be returned as daily interactions, otherwise it hourly interactions",
    "inputSchema": {
      "type": "object",
      "properties": {
        "post_type": {
          "type": "string",
          "description": "The type of post (e.g., twitter, youtube)",
          "example": "twitter"
        },
        "post_id": {
          "type": "string",
          "description": "The ID of the post",
          "example": "1234567890"
        }
      },
      "required": [
        "post_type",
        "post_id"
      ]
    }
  },
  {
    "name": "scan_crypto_market_metrics",
    "description": "Get a general snapshot of HIVE_DATASOURCE_THREE metrics on the entire list of tracked coins. This version is heavily cached and up to 1 hour behind. It is designed as a lightweight mechanism for monitoring the universe of available assets, either in aggregate or relative to each other. Metrics include Galaxy Score™, AltRank™, price, volatility, 24h percent change, market cap, social mentions, social interactions, social contributors, social dominance, and categories. Use the coins/list/v2 endpoint for data updated every few seconds.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "sort": {
          "type": "string",
          "description": "Sort field for the results"
        },
        "filter": {
          "type": "string",
          "description": "Filter criteria for the results"
        },
        "limit": {
          "type": "number",
          "description": "Number of results to return"
        },
        "desc": {
          "type": "boolean",
          "description": "Sort in descending order"
        },
        "page": {
          "type": "string",
          "description": "Page number for pagination"
        }
      }
    }
  },
  {
    "name": "analyze_coin_performance",
    "description": "Get market data on a coin or token. Specify the coin to be queried by providing the numeric ID or the symbol of the coin in the input parameter, which can be found by calling the /coins/list endpoint.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "coin": {
          "type": "string",
          "description": "The coin symbol or ID to get details for (e.g., BTC, ETH)",
          "example": "BTC"
        }
      },
      "required": [
        "coin"
      ]
    }
  },
  {
    "name": "fetch_coin_metadata",
    "description": "Get meta information for a cryptocurrency project. This includes information such as the website, social media links, and other information.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "coin": {
          "type": "string",
          "description": "The coin symbol or ID to get meta information for (e.g., BTC, ETH)",
          "example": "BTC"
        }
      },
      "required": [
        "coin"
      ]
    }
  },
  {
    "name": "browse_supported_stocks",
    "description": "Lists all stocks supported by HIVE_DATASOURCE_THREE. Includes the \"topic\" endpoint to use to get social data from this asset as a social topic.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "retrieve_stock_analytics",
    "description": "Get market data on a stock. Specify the coin to be queried by providing the numeric ID or the symbol of the coin in the input parameter, which can be found by calling the /coins/list endpoint.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "stock": {
          "type": "string",
          "description": "The stock symbol or ID to get details for (e.g., AAPL, TSLA)",
          "example": "AAPL"
        }
      },
      "required": [
        "stock"
      ]
    }
  },
  {
    "name": "explore_nft_collections",
    "description": "Lists all nft collections supported by HIVE_DATASOURCE_THREE. Includes the \"topic\" endpoint to use to get social data from this nft collection as a social topic.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "analyze_nft_collection",
    "description": "Get market data on an nft collection. Specify the nft to be queried by providing the numeric ID or the slug of the nft in the input parameter, which can be found by calling the /public/nfts/list endpoint.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "nft": {
          "type": "string",
          "description": "The NFT collection slug or ID to get details for",
          "example": "cryptopunks"
        }
      },
      "required": [
        "nft"
      ]
    }
  },
  {
    "name": "track_nft_market_trends",
    "description": "Get market time series data on an nft collection. Specify the nft to be queried by providing the numeric ID or slug of the nft collection in the input parameter, which can be found by calling the /public/nfts/list endpoint.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "nft": {
          "type": "string",
          "description": "The NFT collection slug or ID to get time series data for",
          "example": "cryptopunks"
        }
      },
      "required": [
        "nft"
      ]
    }
  },
  {
    "name": "monitor_system_updates",
    "description": "Updates to potential changes to historical time series data. Search term changes only impact the most recent 72 hours (hourly) or 3 days (daily) data. \"full historical\" is a change that may impact the full history of data. Each change provides a description of what is impacted and why.",
    "inputSchema": {
      "type": "object",
      "properties": {}
    }
  },
  {
    "name": "exchange_markets_browser",
    "description": "Fetch all available markets/trading pairs from an exchange",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        }
      },
      "required": [
        "exchange"
      ]
    }
  },
  {
    "name": "exchange_currencies_browser",
    "description": "Fetch all available currencies from an exchange",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        }
      },
      "required": [
        "exchange"
      ]
    }
  },
  {
    "name": "trading_pair_ticker_data",
    "description": "Fetch ticker data (price, volume, etc.) for a specific trading pair",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (e.g., BTC/USDT, ETH/USD)",
          "example": "BTC/USDT"
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  },
  {
    "name": "multiple_tickers_data",
    "description": "Fetch ticker data for multiple trading pairs",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        },
        "symbols": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Array of trading pair symbols (optional, fetches all if not provided)",
          "example": [
            "BTC/USDT",
            "ETH/USDT"
          ]
        }
      },
      "required": [
        "exchange"
      ]
    }
  },
  {
    "name": "trading_pair_orderbook_data",
    "description": "Fetch order book (bids and asks) for a trading pair",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (e.g., BTC/USDT, ETH/USD)",
          "example": "BTC/USDT"
        },
        "limit": {
          "type": "number",
          "description": "Number of order book entries to return",
          "example": 10
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  },
  {
    "name": "trading_pair_recent_trades",
    "description": "Fetch recent trades for a trading pair",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (e.g., BTC/USDT, ETH/USD)",
          "example": "BTC/USDT"
        },
        "since": {
          "type": "number",
          "description": "Timestamp in milliseconds to fetch trades since",
          "example": 1693958400000
        },
        "limit": {
          "type": "number",
          "description": "Number of trades to return",
          "example": 100
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  },
  {
    "name": "trading_pair_candlestick_data",
    "description": "Fetch OHLCV (candlestick) data for a trading pair",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (e.g., BTC/USDT, ETH/USD)",
          "example": "BTC/USDT"
        },
        "timeframe": {
          "type": "string",
          "description": "Timeframe (e.g., 1m, 5m, 15m, 1h, 4h, 1d)",
          "example": "1h",
          "default": "1m"
        },
        "since": {
          "type": "number",
          "description": "Timestamp in milliseconds to fetch candles since",
          "example": 1693958400000
        },
        "limit": {
          "type": "number",
          "description": "Number of candles to return",
          "example": 100
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  },
  {
    "name": "perpetual_funding_rate_current",
    "description": "Fetch current funding rate for a perpetual futures contract",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, bybit, okx)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (e.g., BTC/USDT:USDT)",
          "example": "BTC/USDT:USDT"
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  },
  {
    "name": "perpetual_funding_rate_history",
    "description": "Fetch funding rate history for perpetual futures contracts",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, bybit, okx)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (optional, fetches all if not provided)",
          "example": "BTC/USDT:USDT"
        },
        "since": {
          "type": "number",
          "description": "Timestamp in milliseconds to fetch history since",
          "example": 1693958400000
        },
        "limit": {
          "type": "number",
          "description": "Number of funding rate entries to return",
          "example": 100
        }
      },
      "required": [
        "exchange"
      ]
    }
  },
  {
    "name": "multiple_pairs_best_prices",
    "description": "Fetch best bid/ask prices for multiple trading pairs",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        },
        "symbols": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Array of trading pair symbols (optional, fetches all if not provided)",
          "example": [
            "BTC/USDT",
            "ETH/USDT"
          ]
        }
      },
      "required": [
        "exchange"
      ]
    }
  },
  {
    "name": "exchange_system_status",
    "description": "Fetch the exchange system status to check if it is operating normally",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        }
      },
      "required": [
        "exchange"
      ]
    }
  },
  {
    "name": "exchange_server_time",
    "description": "Fetch the current exchange server time",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        }
      },
      "required": [
        "exchange"
      ]
    }
  },
  {
    "name": "level2_orderbook_data",
    "description": "Fetch level 2 (aggregated) order book for faster performance",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, coinbase, kraken)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (e.g., BTC/USDT, ETH/USD)",
          "example": "BTC/USDT"
        },
        "limit": {
          "type": "number",
          "description": "Number of order book entries to return",
          "example": 10
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  },
  {
    "name": "perpetual_funding_rates_all",
    "description": "Fetch funding rates for multiple or all perpetual futures contracts",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, bybit, okx)",
          "example": "binance"
        },
        "symbols": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Array of trading pair symbols (optional, fetches all if not provided)",
          "example": [
            "BTC/USDT:USDT",
            "ETH/USDT:USDT"
          ]
        }
      },
      "required": [
        "exchange"
      ]
    }
  },
  {
    "name": "derivatives_index_candlestick",
    "description": "Fetch index price OHLCV data for derivatives",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, bybit, okx)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Index symbol (e.g., BTC/USDT)",
          "example": "BTC/USDT"
        },
        "timeframe": {
          "type": "string",
          "description": "Timeframe (e.g., 1m, 5m, 15m, 1h, 4h, 1d)",
          "example": "1h",
          "default": "1m"
        },
        "since": {
          "type": "number",
          "description": "Timestamp in milliseconds to fetch candles since",
          "example": 1693958400000
        },
        "limit": {
          "type": "number",
          "description": "Number of candles to return",
          "example": 100
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  },
  {
    "name": "derivatives_mark_candlestick",
    "description": "Fetch mark price OHLCV data for derivatives",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, bybit, okx)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (e.g., BTC/USDT:USDT)",
          "example": "BTC/USDT:USDT"
        },
        "timeframe": {
          "type": "string",
          "description": "Timeframe (e.g., 1m, 5m, 15m, 1h, 4h, 1d)",
          "example": "1h",
          "default": "1m"
        },
        "since": {
          "type": "number",
          "description": "Timestamp in milliseconds to fetch candles since",
          "example": 1693958400000
        },
        "limit": {
          "type": "number",
          "description": "Number of candles to return",
          "example": 100
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  },
  {
    "name": "perpetual_premium_index_data",
    "description": "Fetch premium index OHLCV data for perpetual contracts",
    "inputSchema": {
      "type": "object",
      "properties": {
        "exchange": {
          "type": "string",
          "description": "Exchange ID (e.g., binance, bybit, okx)",
          "example": "binance"
        },
        "symbol": {
          "type": "string",
          "description": "Trading pair symbol (e.g., BTC/USDT:USDT)",
          "example": "BTC/USDT:USDT"
        },
        "timeframe": {
          "type": "string",
          "description": "Timeframe (e.g., 1m, 5m, 15m, 1h, 4h, 1d)",
          "example": "1h",
          "default": "1m"
        },
        "since": {
          "type": "number",
          "description": "Timestamp in milliseconds to fetch candles since",
          "example": 1693958400000
        },
        "limit": {
          "type": "number",
          "description": "Number of candles to return",
          "example": 100
        }
      },
      "required": [
        "exchange",
        "symbol"
      ]
    }
  }
]