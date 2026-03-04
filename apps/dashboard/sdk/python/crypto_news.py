"""
Free Crypto News Python SDK

Free tier available - no API key required for basic endpoints.
API key enables higher rate limits and premium endpoints.

Usage:
    from crypto_news import CryptoNews
    
    # Free usage (100 requests/day on premium endpoints)
    news = CryptoNews()
    
    # With API key (higher limits)
    news = CryptoNews(api_key='cda_free_xxx...')
    
    articles = news.get_latest(limit=10)
    
    for article in articles:
        print(f"{article['title']} - {article['source']}")
"""

import urllib.request
import urllib.parse
import json
from typing import Optional, List, Dict, Any


class CryptoNewsError(Exception):
    """Base exception for CryptoNews SDK."""
    pass


class PaymentRequiredError(CryptoNewsError):
    """Raised when x402 payment is required."""
    def __init__(self, message: str, payment_required: Optional[str] = None):
        super().__init__(message)
        self.payment_required = payment_required


class RateLimitError(CryptoNewsError):
    """Raised when rate limit is exceeded."""
    def __init__(self, message: str, retry_after: Optional[int] = None):
        super().__init__(message)
        self.retry_after = retry_after


class CryptoNews:
    """Free Crypto News API client."""
    
    BASE_URL = "https://free-crypto-news.vercel.app"
    
    def __init__(
        self,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout: int = 30
    ):
        """
        Initialize the client.
        
        Args:
            base_url: Optional custom API URL (for self-hosted instances)
            api_key: Optional API key for authenticated requests
            timeout: Request timeout in seconds (default: 30)
        """
        self.base_url = base_url or self.BASE_URL
        self.api_key = api_key
        self.timeout = timeout
        self.last_rate_limit: Optional[Dict[str, Any]] = None
    
    def set_api_key(self, api_key: str) -> None:
        """Set API key for authenticated requests."""
        self.api_key = api_key
    
    def get_rate_limit_info(self) -> Optional[Dict[str, Any]]:
        """Get rate limit info from last request."""
        return self.last_rate_limit
    
    def _request(self, endpoint: str, payment: Optional[str] = None) -> Dict[str, Any]:
        """Make API request."""
        url = f"{self.base_url}{endpoint}"
        
        headers = {
            'Accept': 'application/json',
            'User-Agent': 'CryptoNewsSDK-Python/1.0',
        }
        
        # Add API key if available
        if self.api_key:
            headers['X-API-Key'] = self.api_key
        
        # Add x402 payment header if provided
        if payment:
            headers['X-PAYMENT'] = payment
        
        request = urllib.request.Request(url, headers=headers)
        
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                # Parse rate limit headers
                remaining = response.headers.get('X-RateLimit-Remaining')
                limit = response.headers.get('X-RateLimit-Limit')
                reset_at = response.headers.get('X-RateLimit-Reset')
                if remaining and limit:
                    self.last_rate_limit = {
                        'remaining': int(remaining),
                        'limit': int(limit),
                        'reset_at': int(reset_at) if reset_at else None,
                    }
                
                return json.loads(response.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 402:
                payment_required = e.headers.get('X-PAYMENT-REQUIRED')
                raise PaymentRequiredError('Payment required', payment_required)
            elif e.code == 429:
                reset_at = e.headers.get('X-RateLimit-Reset')
                raise RateLimitError(
                    'Rate limit exceeded',
                    int(reset_at) if reset_at else None
                )
            else:
                raise CryptoNewsError(f'HTTP {e.code}: {e.reason}')
    
    def get_latest(self, limit: int = 10, source: Optional[str] = None) -> List[Dict]:
        """
        Get latest crypto news.
        
        Args:
            limit: Max articles (1-50)
            source: Filter by source (coindesk, theblock, decrypt, etc.)
        
        Returns:
            List of news articles
        """
        endpoint = f"/api/news?limit={limit}"
        if source:
            endpoint += f"&source={source}"
        return self._request(endpoint)["articles"]
    
    def search(self, keywords: str, limit: int = 10) -> List[Dict]:
        """
        Search news by keywords.
        
        Args:
            keywords: Comma-separated search terms
            limit: Max results (1-30)
        
        Returns:
            List of matching articles
        """
        encoded = urllib.parse.quote(keywords)
        return self._request(f"/api/search?q={encoded}&limit={limit}")["articles"]
    
    def get_defi(self, limit: int = 10) -> List[Dict]:
        """Get DeFi-specific news."""
        return self._request(f"/api/defi?limit={limit}")["articles"]
    
    def get_bitcoin(self, limit: int = 10) -> List[Dict]:
        """Get Bitcoin-specific news."""
        return self._request(f"/api/bitcoin?limit={limit}")["articles"]
    
    def get_breaking(self, limit: int = 5) -> List[Dict]:
        """Get breaking news (last 2 hours)."""
        return self._request(f"/api/breaking?limit={limit}")["articles"]
    
    def get_sources(self) -> List[Dict]:
        """Get list of all news sources."""
        return self._request("/api/sources")["sources"]
    
    def get_trending(self, limit: int = 10, hours: int = 24) -> Dict:
        """Get trending topics with sentiment."""
        return self._request(f"/api/trending?limit={limit}&hours={hours}")
    
    def get_stats(self) -> Dict:
        """Get API statistics and analytics."""
        return self._request("/api/stats")
    
    def get_health(self) -> Dict:
        """Check API health status."""
        return self._request("/api/health")
    
    def analyze(self, limit: int = 20, topic: Optional[str] = None, sentiment: Optional[str] = None) -> Dict:
        """Get news with topic classification and sentiment analysis."""
        endpoint = f"/api/analyze?limit={limit}"
        if topic:
            endpoint += f"&topic={urllib.parse.quote(topic)}"
        if sentiment:
            endpoint += f"&sentiment={sentiment}"
        return self._request(endpoint)
    
    def get_archive(self, date: Optional[str] = None, query: Optional[str] = None, limit: int = 50) -> Dict:
        """Get archived historical news."""
        params = [f"limit={limit}"]
        if date:
            params.append(f"date={date}")
        if query:
            params.append(f"q={urllib.parse.quote(query)}")
        return self._request(f"/api/archive?{'&'.join(params)}")
    
    def get_origins(self, query: Optional[str] = None, category: Optional[str] = None, limit: int = 20) -> Dict:
        """Find original sources of news."""
        params = [f"limit={limit}"]
        if query:
            params.append(f"q={urllib.parse.quote(query)}")
        if category:
            params.append(f"category={category}")
        return self._request(f"/api/origins?{'&'.join(params)}")
    
    def get_portfolio(self, coins: list, limit: int = 10, include_prices: bool = True) -> Dict:
        """Get portfolio news with optional prices from CoinGecko."""
        coins_param = ','.join(coins) if isinstance(coins, list) else coins
        return self._request(f"/api/portfolio?coins={urllib.parse.quote(coins_param)}&limit={limit}&prices={str(include_prices).lower()}")

    # ═══════════════════════════════════════════════════════════════
    # PREMIUM / AUTHENTICATED ENDPOINTS
    # ═══════════════════════════════════════════════════════════════

    def get_usage(self) -> Dict:
        """
        Get API key usage statistics (requires API key).
        
        Returns:
            Dict with tier, usage_today, usage_month, limit, remaining, reset_at
        """
        if not self.api_key:
            raise CryptoNewsError('API key required. Call set_api_key() first.')
        return self._request('/api/v1/usage')

    def get_premium_coin(self, coin_id: str, payment: Optional[str] = None) -> Dict:
        """
        Get premium coin data (requires API key or x402 payment).
        
        Args:
            coin_id: CoinGecko coin ID
            payment: Optional x402 payment header
        """
        return self._request(f'/api/v1/coins/{coin_id}', payment=payment)

    def get_premium_coins(
        self,
        page: int = 1,
        per_page: int = 100,
        order: str = 'market_cap_desc',
        ids: Optional[str] = None,
        payment: Optional[str] = None
    ) -> Dict:
        """
        Get premium coins list (requires API key or x402 payment).
        
        Args:
            page: Page number
            per_page: Results per page (max 250)
            order: Sort order
            ids: Comma-separated coin IDs
            payment: Optional x402 payment header
        """
        params = [f'page={page}', f'per_page={per_page}', f'order={order}']
        if ids:
            params.append(f'ids={urllib.parse.quote(ids)}')
        return self._request(f'/api/v1/coins?{"&".join(params)}', payment=payment)

    def get_historical(
        self,
        coin_id: str,
        days: int = 30,
        payment: Optional[str] = None
    ) -> Dict:
        """
        Get historical price data (requires API key or x402 payment).
        
        Args:
            coin_id: CoinGecko coin ID
            days: Number of days of history
            payment: Optional x402 payment header
        """
        return self._request(f'/api/v1/historical/{coin_id}?days={days}', payment=payment)

    def export_data(
        self,
        coin_id: str,
        format: str = 'json',
        days: int = 30,
        payment: Optional[str] = None
    ) -> Dict:
        """
        Export data (requires API key or x402 payment).
        
        Args:
            coin_id: CoinGecko coin ID
            format: Output format ('json' or 'csv')
            days: Number of days
            payment: Optional x402 payment header
        """
        return self._request(
            f'/api/v1/export?coin={coin_id}&format={format}&days={days}',
            payment=payment
        )


# Convenience functions
def get_crypto_news(limit: int = 10) -> List[Dict]:
    """Quick function to get latest news."""
    return CryptoNews().get_latest(limit)

def search_crypto_news(keywords: str, limit: int = 10) -> List[Dict]:
    """Quick function to search news."""
    return CryptoNews().search(keywords, limit)

def get_trending_topics(limit: int = 10) -> List[Dict]:
    """Quick function to get trending topics."""
    return CryptoNews().get_trending(limit)["trending"]


if __name__ == "__main__":
    # Demo
    print("📰 Latest Crypto News\n" + "=" * 50)
    news = CryptoNews()
    for article in news.get_latest(5):
        print(f"\n📌 {article['title']}")
        print(f"   🔗 {article['link']}")
        print(f"   📰 {article['source']} • {article['timeAgo']}")
    
    print("\n\n📊 Trending Topics\n" + "=" * 50)
    trending = news.get_trending(5)
    for topic in trending["trending"]:
        emoji = "🟢" if topic["sentiment"] == "bullish" else "🔴" if topic["sentiment"] == "bearish" else "⚪"
        print(f"{emoji} {topic['topic']}: {topic['count']} mentions")
