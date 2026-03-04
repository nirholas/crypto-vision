"""
Crypto Data Aggregator Python SDK v2

Supports all v2 API endpoints with type hints.

Usage:
    from crypto_api_v2 import CryptoAPI
    
    # With API key
    api = CryptoAPI(api_key='cda_xxx...')
    
    # Get market data
    coins = api.get_coins(page=1, per_page=50)
    btc = api.get_coin('bitcoin')
    trending = api.get_trending()
    
    # GraphQL query
    result = api.graphql('''
        {
            coins(page: 1) { coins { id name price } }
        }
    ''')
    
    # Batch requests
    results = api.batch([
        {'endpoint': 'coins', 'params': {'page': 1}},
        {'endpoint': 'global'},
        {'endpoint': 'trending'},
    ])
"""

import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, Dict, Any, List, Union
from dataclasses import dataclass


class CryptoAPIError(Exception):
    """Base exception for CryptoAPI SDK."""
    
    def __init__(self, message: str, code: str = 'UNKNOWN', status: int = 0, details: Any = None):
        super().__init__(message)
        self.code = code
        self.status = status
        self.details = details


class RateLimitError(CryptoAPIError):
    """Raised when rate limit is exceeded."""
    
    def __init__(self, retry_after: int = 60):
        super().__init__('Rate limit exceeded', 'RATE_LIMITED', 429)
        self.retry_after = retry_after


class PaymentRequiredError(CryptoAPIError):
    """Raised when x402 payment is required."""
    
    def __init__(self, payment_info: Optional[str] = None):
        super().__init__('Payment required', 'PAYMENT_REQUIRED', 402)
        self.payment_info = payment_info


@dataclass
class RateLimitInfo:
    """Rate limit information from last request."""
    remaining: int
    limit: int
    reset_at: int


class CryptoAPI:
    """Crypto Data Aggregator API v2 client."""
    
    BASE_URL = "https://crypto-data-aggregator.vercel.app"
    API_VERSION = "v2"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 30
    ):
        """
        Initialize the client.
        
        Args:
            api_key: API key for authenticated requests
            base_url: Optional custom API URL
            timeout: Request timeout in seconds (default: 30)
        """
        self.base_url = base_url or self.BASE_URL
        self.api_key = api_key
        self.timeout = timeout
        self.last_rate_limit: Optional[RateLimitInfo] = None
    
    def set_api_key(self, api_key: str) -> None:
        """Set API key for authenticated requests."""
        self.api_key = api_key
    
    def get_rate_limit_info(self) -> Optional[RateLimitInfo]:
        """Get rate limit info from last request."""
        return self.last_rate_limit
    
    def _request(
        self,
        endpoint: str,
        method: str = 'GET',
        body: Optional[Dict[str, Any]] = None,
        payment: Optional[str] = None
    ) -> Dict[str, Any]:
        """Make API request."""
        url = f"{self.base_url}/api/{self.API_VERSION}{endpoint}"
        
        headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'CryptoAPI-SDK-Python/2.0',
        }
        
        if self.api_key:
            headers['X-API-Key'] = self.api_key
        
        if payment:
            headers['X-PAYMENT'] = payment
        
        data = None
        if body:
            data = json.dumps(body).encode('utf-8')
        
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                # Parse rate limit headers
                remaining = response.headers.get('X-RateLimit-Remaining')
                limit = response.headers.get('X-RateLimit-Limit')
                reset_at = response.headers.get('X-RateLimit-Reset')
                
                if remaining and limit:
                    self.last_rate_limit = RateLimitInfo(
                        remaining=int(remaining),
                        limit=int(limit),
                        reset_at=int(reset_at) * 1000 if reset_at else 0
                    )
                
                return json.loads(response.read().decode('utf-8'))
                
        except urllib.error.HTTPError as e:
            # Parse error response
            try:
                error_data = json.loads(e.read().decode('utf-8'))
            except:
                error_data = {'error': str(e)}
            
            if e.code == 402:
                raise PaymentRequiredError(e.headers.get('X-Payment-Required'))
            
            if e.code == 429:
                retry_after = int(e.headers.get('Retry-After', 60))
                raise RateLimitError(retry_after)
            
            raise CryptoAPIError(
                error_data.get('error', 'Request failed'),
                error_data.get('code', 'UNKNOWN'),
                e.code,
                error_data.get('details')
            )
        
        except urllib.error.URLError as e:
            raise CryptoAPIError(f'Connection error: {e.reason}', 'CONNECTION_ERROR')
    
    def _build_query(self, params: Dict[str, Any]) -> str:
        """Build query string from params dict."""
        filtered = {k: v for k, v in params.items() if v is not None}
        if not filtered:
            return ''
        return '?' + urllib.parse.urlencode(filtered)
    
    # ===========================================================================
    # MARKET DATA
    # ===========================================================================
    
    def get_coins(
        self,
        page: int = 1,
        per_page: int = 100,
        order: str = 'market_cap_desc',
        ids: Optional[str] = None,
        sparkline: bool = False
    ) -> Dict[str, Any]:
        """
        Get list of coins with market data.
        
        Args:
            page: Page number (default: 1)
            per_page: Results per page, max 250 (default: 100)
            order: Sort order (default: 'market_cap_desc')
            ids: Comma-separated coin IDs to filter
            sparkline: Include 7-day sparkline data
        
        Returns:
            API response with coins data
        """
        query = self._build_query({
            'page': page,
            'per_page': per_page,
            'order': order,
            'ids': ids,
            'sparkline': str(sparkline).lower() if sparkline else None,
        })
        return self._request(f'/coins{query}')
    
    def get_coin(self, id: str) -> Dict[str, Any]:
        """
        Get detailed info for a specific coin.
        
        Args:
            id: Coin ID (e.g., 'bitcoin', 'ethereum')
        
        Returns:
            API response with coin details
        """
        return self._request(f'/coin/{urllib.parse.quote(id)}')
    
    def get_global(self) -> Dict[str, Any]:
        """
        Get global market data.
        
        Returns:
            Global market statistics including total market cap and dominance
        """
        return self._request('/global')
    
    def get_ticker(
        self,
        symbol: Optional[str] = None,
        symbols: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get real-time ticker data.
        
        Args:
            symbol: Single symbol (e.g., 'BTC')
            symbols: Comma-separated symbols
        
        Returns:
            Ticker data with prices and changes
        """
        query = self._build_query({'symbol': symbol, 'symbols': symbols})
        return self._request(f'/ticker{query}')
    
    # ===========================================================================
    # HISTORICAL DATA
    # ===========================================================================
    
    def get_historical(self, id: str, days: int = 30) -> Dict[str, Any]:
        """
        Get historical price data.
        
        Args:
            id: Coin ID
            days: Number of days (1, 7, 14, 30, 90, 180, 365)
        
        Returns:
            Historical prices, market caps, and volumes
        """
        query = self._build_query({'days': days})
        return self._request(f'/historical/{urllib.parse.quote(id)}{query}')
    
    # ===========================================================================
    # DEFI & GAS
    # ===========================================================================
    
    def get_defi(
        self,
        limit: int = 50,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get DeFi protocol data.
        
        Args:
            limit: Number of protocols (default: 50)
            category: Filter by category (e.g., 'DEX', 'Lending')
        
        Returns:
            DeFi protocols with TVL data
        """
        query = self._build_query({'limit': limit, 'category': category})
        return self._request(f'/defi{query}')
    
    def get_gas(self, network: str = 'all') -> Dict[str, Any]:
        """
        Get gas prices.
        
        Args:
            network: Network (all, ethereum, bitcoin)
        
        Returns:
            Gas prices for selected networks
        """
        query = self._build_query({'network': network})
        return self._request(f'/gas{query}')
    
    # ===========================================================================
    # ANALYTICS
    # ===========================================================================
    
    def get_trending(self) -> Dict[str, Any]:
        """
        Get trending coins.
        
        Returns:
            Currently trending cryptocurrencies
        """
        return self._request('/trending')
    
    def search(self, query: str) -> Dict[str, Any]:
        """
        Search for coins.
        
        Args:
            query: Search query (min 2 characters)
        
        Returns:
            Matching coins and exchanges
        """
        return self._request(f'/search?q={urllib.parse.quote(query)}')
    
    def get_volatility(self, ids: Optional[str] = None) -> Dict[str, Any]:
        """
        Get volatility metrics.
        
        Args:
            ids: Comma-separated coin IDs
        
        Returns:
            Volatility metrics including Sharpe ratio and risk levels
        """
        query = self._build_query({'ids': ids})
        return self._request(f'/volatility{query}')
    
    # ===========================================================================
    # BATCH & GRAPHQL
    # ===========================================================================
    
    def batch(self, requests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Execute multiple API calls in one request.
        
        Args:
            requests: List of request objects with 'endpoint' and optional 'params'
        
        Returns:
            Results for all requests
        
        Example:
            results = api.batch([
                {'endpoint': 'coins', 'params': {'page': 1}},
                {'endpoint': 'global'},
                {'endpoint': 'trending'},
            ])
        """
        return self._request('/batch', method='POST', body={'requests': requests})
    
    def graphql(
        self,
        query: str,
        variables: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute a GraphQL query.
        
        Args:
            query: GraphQL query string
            variables: Optional query variables
        
        Returns:
            GraphQL response with data and/or errors
        
        Example:
            result = api.graphql('''
                {
                    coins(page: 1, perPage: 10) {
                        coins { id name price marketCap }
                    }
                    global { totalMarketCap btcDominance }
                }
            ''')
        """
        body = {'query': query}
        if variables:
            body['variables'] = variables
        return self._request('/graphql', method='POST', body=body)
    
    # ===========================================================================
    # WEBHOOKS
    # ===========================================================================
    
    def list_webhooks(self) -> Dict[str, Any]:
        """
        List webhook subscriptions.
        
        Returns:
            List of configured webhooks
        """
        return self._request('/webhooks')
    
    def create_webhook(
        self,
        url: str,
        events: List[str],
        secret: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a webhook subscription.
        
        Args:
            url: Webhook URL
            events: Events to subscribe to
            secret: Optional secret for signature verification
        
        Returns:
            Created webhook details
        """
        body = {'url': url, 'events': events}
        if secret:
            body['secret'] = secret
        return self._request('/webhooks', method='POST', body=body)
    
    def delete_webhook(self, id: str) -> Dict[str, Any]:
        """
        Delete a webhook.
        
        Args:
            id: Webhook ID
        
        Returns:
            Deletion confirmation
        """
        return self._request(f'/webhooks?id={urllib.parse.quote(id)}', method='DELETE')
    
    # ===========================================================================
    # UTILITIES
    # ===========================================================================
    
    def health(self) -> Dict[str, Any]:
        """Check API health status."""
        return self._request('/health')
    
    def info(self) -> Dict[str, Any]:
        """Get API documentation info."""
        return self._request('')
    
    def openapi(self) -> Dict[str, Any]:
        """Get OpenAPI specification."""
        return self._request('/openapi.json')


# Convenience functions for quick usage

def get_bitcoin_price() -> float:
    """Quick helper to get current Bitcoin price."""
    api = CryptoAPI()
    result = api.get_coin('bitcoin')
    return result.get('data', {}).get('price', 0)


def get_ethereum_price() -> float:
    """Quick helper to get current Ethereum price."""
    api = CryptoAPI()
    result = api.get_coin('ethereum')
    return result.get('data', {}).get('price', 0)


def get_top_coins(limit: int = 10) -> List[Dict[str, Any]]:
    """Quick helper to get top coins by market cap."""
    api = CryptoAPI()
    result = api.get_coins(per_page=limit)
    return result.get('data', [])
