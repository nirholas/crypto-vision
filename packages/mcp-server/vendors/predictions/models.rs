//! Data models for Polymarket predictions
//!
//! @author nich
//! @website https://x.com/nichxbt
//! @github https://github.com/nirholas
//! @license Apache-2.0

// Allow unused code - some models are defined for future use
#![allow(dead_code)]
use serde::{Deserialize, Deserializer, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub id: String,
    pub slug: String,
    pub question: String,
    pub description: Option<String>,
    pub active: bool,
    pub closed: bool,

    // Polymarket returns these as strings, we'll parse them
    #[serde(deserialize_with = "deserialize_string_to_f64_or_default", default)]
    pub liquidity: f64,
    #[serde(deserialize_with = "deserialize_string_to_f64_or_default", default)]
    pub volume: f64,

    #[serde(rename = "endDate")]
    pub end_date: Option<String>,

    pub image: Option<String>,
    pub category: Option<String>,

    // These are JSON strings in the API
    #[serde(deserialize_with = "deserialize_json_string_to_vec")]
    pub outcomes: Vec<String>,
    #[serde(
        rename = "outcomePrices",
        deserialize_with = "deserialize_json_string_to_vec"
    )]
    pub outcome_prices: Vec<String>,

    #[serde(rename = "conditionId")]
    pub condition_id: Option<String>,
    #[serde(rename = "marketType")]
    pub market_type: Option<String>,
    #[serde(rename = "twitterCardImage")]
    pub twitter_card_image: Option<String>,
    pub icon: Option<String>,

    // Optional fields that might not always be present
    #[serde(rename = "startDate")]
    pub start_date: Option<String>,
    #[serde(
        rename = "volume24hr",
        skip_serializing_if = "Option::is_none",
        default
    )]
    pub volume_24hr: Option<f64>,
    pub events: Option<Vec<Event>>,

    // Additional optional fields that might be present
    #[serde(default)]
    pub archived: Option<bool>,
    #[serde(rename = "enableOrderBook", default)]
    pub enable_order_book: Option<bool>,
    #[serde(rename = "groupItemTitle", default)]
    pub group_item_title: Option<String>,
    #[serde(rename = "groupItemSlug", default)]
    pub group_item_slug: Option<String>,

    // Additional fields from Gamma API
    #[serde(rename = "acceptingOrders", default)]
    pub accepting_orders: Option<bool>,
    #[serde(rename = "acceptingOrderTimestamp", default)]
    pub accepting_order_timestamp: Option<String>,
    #[serde(
        rename = "clobTokenIds",
        default,
        deserialize_with = "deserialize_optional_json_string_to_vec"
    )]
    pub clob_token_ids: Option<Vec<String>>,
    #[serde(rename = "fpmm", default)]
    pub fpmm: Option<String>,
    #[serde(rename = "gameStartTime", default)]
    pub game_start_time: Option<String>,
    #[serde(rename = "makerBaseFee", default)]
    pub maker_base_fee: Option<f64>,
    #[serde(rename = "minimumOrderSize", default)]
    pub minimum_order_size: Option<f64>,
    #[serde(rename = "minimumTickSize", default)]
    pub minimum_tick_size: Option<f64>,
    #[serde(rename = "negRisk", default)]
    pub neg_risk: Option<bool>,
    #[serde(rename = "notificationsEnabled", default)]
    pub notifications_enabled: Option<bool>,
    pub tags: Option<Vec<Tag>>,
}

impl Market {
    /// Check if market is currently tradeable
    #[allow(dead_code)]
    pub fn is_tradeable(&self) -> bool {
        self.active
            && !self.closed
            && !self.archived.unwrap_or(false)
            && self.enable_order_book.unwrap_or(false)
    }

    /// Get activity level based on volume and liquidity
    #[allow(dead_code)]
    pub fn activity_level(&self) -> ActivityLevel {
        let score = self.volume + (self.liquidity * 0.5);
        match score {
            s if s >= 100000.0 => ActivityLevel::VeryHigh,
            s if s >= 25000.0 => ActivityLevel::High,
            s if s >= 5000.0 => ActivityLevel::Medium,
            _ => ActivityLevel::Low,
        }
    }

    /// Check if market expires soon (within 24 hours) - requires parsing end_date
    #[allow(dead_code)]
    pub fn expires_soon(&self) -> bool {
        // This would need proper date parsing implementation
        false // Placeholder
    }
}

/// Market activity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ActivityLevel {
    Low,
    Medium,
    High,
    VeryHigh,
}

/// Market tag for categorization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketPrice {
    pub market_id: String,
    pub outcome_id: String,
    pub price: f64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Event {
    pub id: String,
    pub ticker: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "startDate")]
    pub start_date: Option<String>,
    #[serde(rename = "endDate")]
    pub end_date: Option<String>,
    pub image: Option<String>,
    #[serde(default)]
    pub active: Option<bool>,
    #[serde(
        deserialize_with = "deserialize_optional_string_or_number_to_f64",
        default
    )]
    pub volume: Option<f64>,

    // Additional fields that might be present
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventResponse {
    pub data: Vec<Event>,
    pub next_cursor: Option<String>,
}

/// User position in a market from the CLOB API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(alias = "market", default)]
    pub market_id: Option<String>,
    #[serde(alias = "user", default)]
    pub user_address: Option<String>,
    #[serde(alias = "outcome", alias = "token_id", default)]
    pub outcome_id: Option<String>,
    #[serde(alias = "size", default)]
    pub shares: Option<f64>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(alias = "avgPrice", default)]
    pub avg_price: Option<f64>,
    #[serde(default)]
    pub cost_basis: Option<f64>,
    #[serde(alias = "pnl", default)]
    pub unrealized_pnl: Option<f64>,
    #[serde(alias = "asset", default)]
    pub asset: Option<String>,
    #[serde(alias = "side", default)]
    pub side: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionsResponse {
    pub data: Vec<Position>,
    pub next_cursor: Option<String>,
}

/// Trade from the Polymarket Data API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trade {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(alias = "conditionId", default)]
    pub condition_id: Option<String>,
    #[serde(alias = "asset", default)]
    pub asset: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(alias = "outcomeIndex", default)]
    pub outcome_index: Option<u32>,
    #[serde(default)]
    pub side: Option<String>,
    #[serde(default)]
    pub size: Option<f64>,
    #[serde(default)]
    pub price: Option<f64>,
    #[serde(default, deserialize_with = "deserialize_optional_timestamp")]
    pub timestamp: Option<i64>,
    #[serde(alias = "proxyWallet", default)]
    pub proxy_wallet: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub slug: Option<String>,
    #[serde(alias = "eventSlug", default)]
    pub event_slug: Option<String>,
    #[serde(alias = "transactionHash", default)]
    pub transaction_hash: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub pseudonym: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradesResponse {
    pub data: Vec<Trade>,
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBook {
    pub market_id: String,
    pub outcome_id: String,
    pub bids: Vec<OrderBookLevel>,
    pub asks: Vec<OrderBookLevel>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBookLevel {
    pub price: f64,
    pub size: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketStats {
    pub market_id: String,
    pub volume_24h: f64,
    pub price_change_24h: f64,
    pub high_24h: f64,
    pub low_24h: f64,
    pub liquidity: f64,
    pub num_traders: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
    pub error: String,
    pub message: String,
    pub status_code: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketsQueryParams {
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub order: Option<String>,
    pub ascending: Option<bool>,
    pub active: Option<bool>,
    pub closed: Option<bool>,
    pub archived: Option<bool>,
    pub liquidity_num_min: Option<f64>,
    pub liquidity_num_max: Option<f64>,
    pub volume_num_min: Option<f64>,
    pub volume_num_max: Option<f64>,
    pub start_date_min: Option<String>,
    pub start_date_max: Option<String>,
    pub end_date_min: Option<String>,
    pub end_date_max: Option<String>,
    pub tag_id: Option<String>,
    pub related_tags: Option<bool>,
}

impl Default for MarketsQueryParams {
    fn default() -> Self {
        Self {
            limit: Some(20),
            offset: Some(0),
            order: Some("volume24hr".to_string()),
            ascending: Some(false),
            active: Some(true),
            closed: None,
            archived: Some(false),
            liquidity_num_min: None,
            liquidity_num_max: None,
            volume_num_min: None,
            volume_num_max: None,
            start_date_min: None,
            start_date_max: None,
            end_date_min: None,
            end_date_max: None,
            tag_id: None,
            related_tags: None,
        }
    }
}

impl MarketsQueryParams {
    #[must_use]
    pub fn to_query_string(&self) -> String {
        let mut params = Vec::new();

        if let Some(limit) = self.limit {
            params.push(format!("limit={limit}"));
        }
        if let Some(offset) = self.offset {
            params.push(format!("offset={offset}"));
        }
        if let Some(ref order) = self.order {
            params.push(format!("order={order}"));
        }
        if let Some(ascending) = self.ascending {
            params.push(format!("ascending={ascending}"));
        }
        if let Some(active) = self.active {
            params.push(format!("active={active}"));
        }
        if let Some(closed) = self.closed {
            params.push(format!("closed={closed}"));
        }
        if let Some(archived) = self.archived {
            params.push(format!("archived={archived}"));
        }
        if let Some(liquidity_min) = self.liquidity_num_min {
            params.push(format!("liquidity_num_min={liquidity_min}"));
        }
        if let Some(liquidity_max) = self.liquidity_num_max {
            params.push(format!("liquidity_num_max={liquidity_max}"));
        }
        if let Some(volume_min) = self.volume_num_min {
            params.push(format!("volume_num_min={volume_min}"));
        }
        if let Some(volume_max) = self.volume_num_max {
            params.push(format!("volume_num_max={volume_max}"));
        }
        if let Some(ref start_min) = self.start_date_min {
            params.push(format!("start_date_min={start_min}"));
        }
        if let Some(ref start_max) = self.start_date_max {
            params.push(format!("start_date_max={start_max}"));
        }
        if let Some(ref end_min) = self.end_date_min {
            params.push(format!("end_date_min={end_min}"));
        }
        if let Some(ref end_max) = self.end_date_max {
            params.push(format!("end_date_max={end_max}"));
        }
        if let Some(ref tag_id) = self.tag_id {
            params.push(format!("tag_id={tag_id}"));
        }
        if let Some(related_tags) = self.related_tags {
            params.push(format!("related_tags={related_tags}"));
        }

        if params.is_empty() {
            String::new()
        } else {
            format!("?{}", params.join("&"))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResource {
    pub uri: String,
    pub name: String,
    pub description: String,
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpResourceContent {
    pub uri: String,
    pub mime_type: String,
    pub text: Option<String>,
    pub blob: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPrompt {
    pub name: String,
    pub description: String,
    pub arguments: Vec<McpPromptArgument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPromptArgument {
    pub name: String,
    pub description: String,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpPromptMessage {
    pub role: String,
    pub content: McpPromptContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum McpPromptContent {
    Text(String),
    Image { r#type: String, data: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceCache {
    pub data: String,
    pub timestamp: u64,
    pub expires_at: u64,
}

impl ResourceCache {
    pub fn new(data: String, ttl_seconds: u64) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Self {
            data,
            timestamp: now,
            expires_at: now + ttl_seconds,
        }
    }

    pub fn is_expired(&self) -> bool {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        now > self.expires_at
    }
}

// Custom deserializers for Polymarket API format

/// Deserialize string to f64, with default of 0.0 for missing/invalid values
fn deserialize_string_to_f64_or_default<'de, D>(deserializer: D) -> Result<f64, D::Error>
where
    D: Deserializer<'de>,
{
    use serde_json::Value;
    match Option::<Value>::deserialize(deserializer) {
        Ok(Some(Value::String(s))) => Ok(s.parse::<f64>().unwrap_or(0.0)),
        Ok(Some(Value::Number(n))) => Ok(n.as_f64().unwrap_or(0.0)),
        _ => Ok(0.0),
    }
}

fn deserialize_json_string_to_vec<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    let s: String = Deserialize::deserialize(deserializer)?;
    serde_json::from_str(&s).map_err(serde::de::Error::custom)
}

/// Deserialize optional JSON-encoded string arrays (e.g., "[\"id1\", \"id2\"]" -> Some(vec!["id1", "id2"]))
/// Handles missing fields, null values, and JSON-encoded string arrays
fn deserialize_optional_json_string_to_vec<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde_json::Value;
    match Option::<Value>::deserialize(deserializer) {
        Ok(Some(Value::String(s))) => {
            // It's a JSON-encoded string like "[\"id1\", \"id2\"]"
            serde_json::from_str(&s)
                .map(Some)
                .map_err(serde::de::Error::custom)
        }
        Ok(Some(Value::Array(arr))) => {
            // It's already an array - enforce all elements are strings
            let strings: Result<Vec<String>, _> = arr
                .into_iter()
                .map(|v| match v {
                    Value::String(s) => Ok(s),
                    other => Err(serde::de::Error::custom(format!(
                        "Expected a string in array, but found: {other}"
                    ))),
                })
                .collect();
            Ok(Some(strings?))
        }
        // Handles null, deserialization errors, and other unexpected JSON value types
        _ => Ok(None),
    }
}

fn deserialize_optional_string_or_number_to_f64<'de, D>(
    deserializer: D,
) -> Result<Option<f64>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde_json::Value;
    // First try to deserialize as an optional value
    match Option::<Value>::deserialize(deserializer) {
        Ok(Some(Value::String(s))) => s.parse::<f64>().map(Some).map_err(serde::de::Error::custom),
        Ok(Some(Value::Number(n))) => Ok(n.as_f64()),
        Ok(Some(_)) => Err(serde::de::Error::custom("Expected string or number")),
        Ok(None) => Ok(None),
        Err(_) => Ok(None), // If field is missing, return None
    }
}

/// Deserialize timestamp that can be either integer or string
fn deserialize_optional_timestamp<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde_json::Value;
    match Option::<Value>::deserialize(deserializer) {
        Ok(Some(Value::Number(n))) => Ok(n.as_i64()),
        Ok(Some(Value::String(s))) => s.parse::<i64>().map(Some).map_err(serde::de::Error::custom),
        _ => Ok(None),
    }
}

/// API response wrapper for paginated results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub data: Vec<T>,
    pub count: Option<usize>,
    pub next_cursor: Option<String>,
}

/// Market summary for quick display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSummary {
    pub id: String,
    pub question: String,
    pub slug: String,
    pub current_price: Option<f64>,
    pub volume_24h: f64,
    pub liquidity: f64,
    pub end_date: String,
    pub active: bool,
    pub tags: Vec<String>,
}

/// Error types for API operations
#[derive(Debug, thiserror::Error)]
#[allow(dead_code)]
pub enum PolymarketError {
    #[error("HTTP request failed: {0}")]
    HttpError(#[from] reqwest::Error),

    #[error("JSON parsing failed: {0}")]
    JsonError(#[from] serde_json::Error),

    #[error("API returned error: {status} - {message}")]
    ApiError { status: u16, message: String },

    #[error("Market not found: {market_id}")]
    MarketNotFound { market_id: String },

    #[error("Invalid market state: {reason}")]
    InvalidMarketState { reason: String },

    #[error("Rate limit exceeded")]
    RateLimitExceeded,

    #[error("Authentication failed")]
    AuthenticationFailed,

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Cache error: {0}")]
    CacheError(String),
}

/// Result type alias for convenience
#[allow(dead_code)]
pub type PolymarketResult<T> = Result<T, PolymarketError>;

/// Configuration for market data caching
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub market_data_ttl_seconds: u64,
    pub price_data_ttl_seconds: u64,
    pub stats_ttl_seconds: u64,
    pub max_cache_size: usize,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            market_data_ttl_seconds: 900, // 15 minutes
            price_data_ttl_seconds: 60,   // 1 minute
            stats_ttl_seconds: 300,       // 5 minutes
            max_cache_size: 10000,
        }
    }
}

/// WebSocket message types for real-time updates
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum WebSocketMessage {
    #[serde(rename = "price_update")]
    PriceUpdate {
        market_id: String,
        token_id: String,
        price: f64,
        timestamp: String,
    },
    #[serde(rename = "trade")]
    TradeUpdate {
        market_id: String,
        token_id: String,
        price: f64,
        size: f64,
        side: String,
        timestamp: String,
    },
    #[serde(rename = "book_update")]
    BookUpdate {
        market_id: String,
        token_id: String,
        bids: Vec<OrderBookLevel>,
        asks: Vec<OrderBookLevel>,
        timestamp: String,
    },
    #[serde(rename = "market_status")]
    MarketStatus {
        market_id: String,
        active: bool,
        closed: bool,
        timestamp: String,
    },
}
