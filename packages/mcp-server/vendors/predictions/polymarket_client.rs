//! Polymarket API client
//!
//! @author nich
//! @website https://x.com/nichxbt
//! @github https://github.com/nirholas
//! @license Apache-2.0

use crate::config::Config;
use crate::error::{PolymarketError, Result};
use crate::models::*;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct CacheEntry<T> {
    pub data: T,
    pub timestamp: Instant,
}

impl<T> CacheEntry<T> {
    pub fn new(data: T) -> Self {
        Self {
            data,
            timestamp: Instant::now(),
        }
    }

    pub fn is_expired(&self, ttl: Duration) -> bool {
        self.timestamp.elapsed() > ttl
    }
}

#[derive(Debug)]
pub struct PolymarketClient {
    client: Client,
    base_url: String,
    config: Arc<Config>,
    market_cache: Arc<RwLock<HashMap<String, CacheEntry<Vec<Market>>>>>,
    single_market_cache: Arc<RwLock<HashMap<String, CacheEntry<Market>>>>,
}

impl PolymarketClient {
    pub fn new_with_config(config: &Arc<Config>) -> Result<Self> {
        let client_builder = Client::builder()
            .timeout(config.api_timeout())
            .gzip(true)
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(30))
            .tcp_keepalive(Duration::from_secs(60));

        let client_builder = if let Some(ref api_key) = config.api.api_key {
            let mut headers = reqwest::header::HeaderMap::new();
            let auth_value =
                reqwest::header::HeaderValue::from_str(&format!("Bearer {api_key}"))
                    .map_err(|e| PolymarketError::config_error(format!("Invalid API key: {e}")))?;
            headers.insert(reqwest::header::AUTHORIZATION, auth_value);
            client_builder.default_headers(headers)
        } else {
            client_builder
        };

        let client = client_builder.build().map_err(|e| {
            PolymarketError::config_error(format!("Failed to build HTTP client: {e}"))
        })?;

        Ok(Self {
            client,
            base_url: config.api.base_url.clone(),
            config: config.clone(),
            market_cache: Arc::new(RwLock::new(HashMap::new())),
            single_market_cache: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    async fn make_request_with_retry<T: for<'de> serde::Deserialize<'de>>(
        &self,
        url: &str,
    ) -> Result<T> {
        let mut last_error = None;
        let max_retries = self.config.api.max_retries;
        let mut connection_failures = 0;
        const MAX_CONNECTION_FAILURES: u32 = 3;

        for attempt in 1..=max_retries {
            match self.client.get(url).send().await {
                Ok(response) => {
                    connection_failures = 0;

                    if response.status().is_success() {
                        match response.text().await {
                            Ok(text) => match serde_json::from_str::<T>(&text) {
                                Ok(data) => return Ok(data),
                                Err(e) => {
                                    last_error = Some(PolymarketError::deserialization_error(
                                        format!("JSON parsing error: {e}"),
                                    ));
                                }
                            },
                            Err(e) => {
                                last_error = Some(PolymarketError::network_error(format!(
                                    "Response reading error: {e}"
                                )));
                            }
                        }
                    } else {
                        let status = response.status();
                        let text = response.text().await.unwrap_or_default();

                        if status.as_u16() == 429 {
                            tokio::time::sleep(Duration::from_secs(60)).await;
                        }

                        last_error = Some(PolymarketError::api_error(
                            format!("HTTP error: {text}"),
                            Some(status.as_u16()),
                        ));
                    }
                }
                Err(e) => {
                    connection_failures += 1;

                    if connection_failures >= MAX_CONNECTION_FAILURES {
                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }

                    last_error = Some(PolymarketError::network_error(format!(
                        "Request error: {e}"
                    )));
                }
            }

            if attempt < max_retries {
                let base_delay = self.config.retry_delay();
                let backoff_multiplier = if connection_failures > 0 {
                    2 * connection_failures
                } else {
                    1 << attempt
                };
                let jitter = fastrand::f64() * 0.1;
                let delay_ms = (f64::from(base_delay.as_millis() as u32)
                    * f64::from(backoff_multiplier)
                    * (1.0 + jitter)) as u64;
                let delay = Duration::from_millis(delay_ms.min(30000));

                tokio::time::sleep(delay).await;
            }
        }

        let error = last_error
            .unwrap_or_else(|| PolymarketError::network_error("All retry attempts failed"));
        Err(error)
    }

    /// Fetches markets from the Polymarket API with optional filtering parameters.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The API request fails
    /// - The response cannot be deserialized
    /// - Query parameters cannot be serialized
    pub async fn get_markets(&self, params: Option<MarketsQueryParams>) -> Result<Vec<Market>> {
        let query_params = params.unwrap_or_default();
        let cache_key = format!(
            "markets_{}",
            serde_json::to_string(&query_params).map_err(|e| {
                PolymarketError::deserialization_error(format!(
                    "Failed to serialize query params: {e}"
                ))
            })?
        );

        if self.config.cache.enabled {
            let cache = self.market_cache.read().await;
            if let Some(entry) = cache.get(&cache_key) {
                if !entry.is_expired(self.config.cache_ttl()) {
                    return Ok(entry.data.clone());
                }
            }
        }

        let query_string = query_params.to_query_string();
        let url = format!("{}/markets{}", self.base_url, query_string);
        let response: Vec<Market> = self.make_request_with_retry(&url).await?;

        if self.config.cache.enabled {
            let mut cache = self.market_cache.write().await;
            cache.insert(cache_key, CacheEntry::new(response.clone()));
        }

        Ok(response)
    }

    /// Fetches a specific market by its ID.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The API request fails
    /// - The market is not found
    /// - The response cannot be deserialized
    pub async fn get_market_by_id(&self, market_id: &str) -> Result<Market> {
        let cache_key = market_id.to_string();

        if self.config.cache.enabled {
            let cache = self.single_market_cache.read().await;
            if let Some(entry) = cache.get(&cache_key) {
                if !entry.is_expired(self.config.cache_ttl()) {
                    return Ok(entry.data.clone());
                }
            }
        }

        let url = format!("{}/markets/{}", self.base_url, market_id);
        let market: Market = self.make_request_with_retry(&url).await?;

        if self.config.cache.enabled {
            let mut cache = self.single_market_cache.write().await;
            cache.insert(cache_key, CacheEntry::new(market.clone()));
        }

        Ok(market)
    }

    /// Searches for markets containing the specified keyword in question, description, or category.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The underlying API request fails
    /// - The response cannot be deserialized
    pub async fn search_markets(&self, keyword: &str, limit: Option<u32>) -> Result<Vec<Market>> {
        let params = MarketsQueryParams {
            limit: limit.or(Some(20)),
            ..Default::default()
        };

        let markets = self.get_markets(Some(params)).await?;

        let keyword_lower = keyword.to_lowercase();
        let filtered: Vec<Market> = markets
            .into_iter()
            .filter(|market| {
                market.question.to_lowercase().contains(&keyword_lower)
                    || market
                        .description
                        .as_ref()
                        .is_some_and(|desc| desc.to_lowercase().contains(&keyword_lower))
                    || market
                        .category
                        .as_ref()
                        .is_some_and(|cat| cat.to_lowercase().contains(&keyword_lower))
            })
            .collect();

        Ok(filtered)
    }

    /// Gets current prices for all outcomes of a specific market.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The market cannot be fetched
    /// - Price data is malformed
    pub async fn get_market_prices(&self, market_id: &str) -> Result<Vec<MarketPrice>> {
        let market = self.get_market_by_id(market_id).await?;
        let mut prices = Vec::new();

        for (i, _outcome) in market.outcomes.iter().enumerate() {
            if let Some(price_str) = market.outcome_prices.get(i) {
                if let Ok(price) = price_str.parse::<f64>() {
                    prices.push(MarketPrice {
                        market_id: market_id.to_string(),
                        outcome_id: format!("outcome_{i}"),
                        price,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    });
                }
            }
        }

        Ok(prices)
    }

    /// Gets markets with the highest trading volume, sorted by volume descending.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The API request fails
    /// - The response cannot be deserialized
    pub async fn get_trending_markets(&self, limit: Option<u32>) -> Result<Vec<Market>> {
        let params = MarketsQueryParams {
            limit: limit.or(Some(10)),
            order: Some("volume24hr".to_string()),
            ascending: Some(false),
            active: Some(true),
            ..Default::default()
        };

        self.get_markets(Some(params)).await
    }

    /// Gets currently active (not archived) markets.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The API request fails
    /// - The response cannot be deserialized
    pub async fn get_active_markets(&self, limit: Option<u32>) -> Result<Vec<Market>> {
        let params = MarketsQueryParams {
            limit: limit.or(Some(50)),
            active: Some(true),
            archived: Some(false),
            ..Default::default()
        };

        self.get_markets(Some(params)).await
    }

    /// Gets positions for a specific wallet address.
    ///
    /// Uses the Polymarket Data API to fetch current positions.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The API request fails
    /// - The response cannot be deserialized
    pub async fn get_user_positions(&self, wallet_address: &str) -> Result<Vec<Position>> {
        let url = format!(
            "{}/positions?user={}",
            self.config.api.clob_url, wallet_address
        );
        let response: Vec<Position> = self.make_request_with_retry(&url).await?;
        Ok(response)
    }

    /// Gets trade history for a specific wallet address.
    ///
    /// Uses the Polymarket Data API to fetch trade history.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The API request fails
    /// - The response cannot be deserialized
    pub async fn get_user_trades(
        &self,
        wallet_address: &str,
        limit: Option<u32>,
    ) -> Result<Vec<Trade>> {
        let limit = limit.unwrap_or(50);
        let url = format!(
            "{}/trades?user={}&limit={}",
            self.config.api.clob_url, wallet_address, limit
        );
        let response: Vec<Trade> = self.make_request_with_retry(&url).await?;
        Ok(response)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    fn create_test_config() -> Arc<Config> {
        let mut config = Config::default();
        config.api.base_url = "http://localhost:3000".to_string();
        config.cache.enabled = false;
        Arc::new(config)
    }

    #[tokio::test]
    async fn test_client_creation() {
        let config = create_test_config();
        let client = PolymarketClient::new_with_config(&config);
        assert!(client.is_ok());
    }

    #[test]
    fn test_cache_entry_expiration() {
        let entry = CacheEntry::new("test_data".to_string());

        assert!(!entry.is_expired(Duration::from_secs(1)));

        std::thread::sleep(Duration::from_millis(10));
        assert!(!entry.is_expired(Duration::from_secs(1)));
        assert!(entry.is_expired(Duration::from_millis(5)));
    }
}
