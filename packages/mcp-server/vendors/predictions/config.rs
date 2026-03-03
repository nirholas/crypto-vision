//! Configuration module
//!
//! @author nich
//! @website https://x.com/nichxbt
//! @github https://github.com/nirholas
//! @license Apache-2.0

use anyhow::{Context, Result};
use config::{Config as ConfigBuilder, File};
use serde::{Deserialize, Serialize};
use std::env;
use std::path::Path;
use std::time::Duration;
use tracing::warn;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub api: ApiConfig,
    pub cache: CacheConfig,
    pub logging: LoggingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub name: String,
    pub version: String,
    pub description: String,
    pub max_connections: Option<u32>,
    pub timeout_seconds: u64,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ApiConfig {
    pub base_url: String,
    pub clob_url: String,
    pub api_key: Option<String>,
    pub timeout_seconds: u64,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub rate_limit_per_second: Option<u32>,
}

impl std::fmt::Debug for ApiConfig {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ApiConfig")
            .field("base_url", &self.base_url)
            .field("clob_url", &self.clob_url)
            .field("api_key", &self.api_key.as_ref().map(|_| "[REDACTED]"))
            .field("rate_limit_per_second", &self.rate_limit_per_second)
            .finish()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub enabled: bool,
    pub ttl_seconds: u64,
    pub max_entries: usize,
    pub resource_cache_ttl_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub format: String,
    pub enable_colors: bool,
    pub log_to_file: bool,
    pub log_file_path: Option<String>,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            server: ServerConfig {
                name: "Universal Crypto MCP Server".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                description: "MCP server for Polymarket prediction market data".to_string(),
                max_connections: Some(100),
                timeout_seconds: 30,
            },
            api: ApiConfig {
                base_url: "https://gamma-api.polymarket.com".to_string(),
                clob_url: "https://data-api.polymarket.com".to_string(),
                api_key: None,
                timeout_seconds: 30,
                max_retries: 3,
                retry_delay_ms: 100,
                rate_limit_per_second: Some(10),
            },
            cache: CacheConfig {
                enabled: true,
                ttl_seconds: 60,
                max_entries: 1000,
                resource_cache_ttl_seconds: 300,
            },
            logging: LoggingConfig {
                level: "info".to_string(),
                format: "pretty".to_string(),
                enable_colors: true,
                log_to_file: false,
                log_file_path: None,
            },
        }
    }
}

impl Config {
    /// Loads configuration from default sources (environment variables and config files).
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Configuration validation fails
    /// - Environment variable parsing fails
    /// - Config file exists but cannot be parsed
    pub fn load() -> Result<Self> {
        let mut config = Self::default();

        if let Ok(file_config) = Self::try_load_default_config_files() {
            config = Self::merge_configs(config, file_config);
        }

        config = Self::load_from_env(config)?;
        config.validate()?;

        Ok(config)
    }

    /// Loads configuration from a specific file path.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The config file doesn't exist
    /// - The config file cannot be parsed
    /// - The config contains invalid values
    pub fn load_from_file(config_path: &str) -> Result<Self> {
        if !Path::new(config_path).exists() {
            return Err(anyhow::anyhow!("Config file not found: {config_path}"));
        }

        let builder = ConfigBuilder::builder()
            .add_source(File::with_name(config_path).required(true))
            .build()
            .context("Failed to build config from file")?;

        let config: Config = builder
            .try_deserialize()
            .context(format!("Failed to deserialize config from {config_path}"))?;

        Ok(config)
    }

    fn try_load_default_config_files() -> Result<Self> {
        let config_paths = [
            "config.toml",
            "universal-crypto-mcp.toml",
            "/etc/universal-crypto-mcp/config.toml",
            "~/.config/universal-crypto-mcp/config.toml",
        ];

        for path in &config_paths {
            if Path::new(path).exists() {
                let builder = ConfigBuilder::builder()
                    .add_source(File::with_name(path).required(false))
                    .build()
                    .context("Failed to build config from file")?;

                let config: Config = builder
                    .try_deserialize()
                    .context(format!("Failed to deserialize config from {path}"))?;

                return Ok(config);
            }
        }

        Err(anyhow::anyhow!("No config file found"))
    }

    fn load_from_env(mut config: Self) -> Result<Self> {
        // Server configuration
        if let Ok(val) = env::var("POLYMARKET_SERVER_NAME") {
            config.server.name = val;
        }
        if let Ok(val) = env::var("POLYMARKET_SERVER_MAX_CONNECTIONS") {
            config.server.max_connections = Some(val.parse().context("Invalid max_connections")?);
        }
        if let Ok(val) = env::var("POLYMARKET_SERVER_TIMEOUT") {
            config.server.timeout_seconds = val.parse().context("Invalid server timeout")?;
        }

        // API configuration
        if let Ok(val) = env::var("POLYMARKET_API_BASE_URL") {
            config.api.base_url = val;
        }
        if let Ok(val) = env::var("POLYMARKET_CLOB_URL") {
            config.api.clob_url = val;
        }
        if let Ok(val) = env::var("POLYMARKET_API_KEY") {
            config.api.api_key = Some(val);
        }
        if let Ok(val) = env::var("POLYMARKET_API_TIMEOUT") {
            config.api.timeout_seconds = val.parse().context("Invalid API timeout")?;
        }
        if let Ok(val) = env::var("POLYMARKET_API_MAX_RETRIES") {
            config.api.max_retries = val.parse().context("Invalid max_retries")?;
        }
        if let Ok(val) = env::var("POLYMARKET_API_RETRY_DELAY") {
            config.api.retry_delay_ms = val.parse().context("Invalid retry_delay")?;
        }
        if let Ok(val) = env::var("POLYMARKET_API_RATE_LIMIT") {
            config.api.rate_limit_per_second = Some(val.parse().context("Invalid rate_limit")?);
        }

        // Cache configuration
        if let Ok(val) = env::var("POLYMARKET_CACHE_ENABLED") {
            config.cache.enabled = val.parse().context("Invalid cache_enabled")?;
        }
        if let Ok(val) = env::var("POLYMARKET_CACHE_TTL") {
            config.cache.ttl_seconds = val.parse().context("Invalid cache_ttl")?;
        }
        if let Ok(val) = env::var("POLYMARKET_CACHE_MAX_ENTRIES") {
            config.cache.max_entries = val.parse().context("Invalid cache_max_entries")?;
        }
        if let Ok(val) = env::var("POLYMARKET_RESOURCE_CACHE_TTL") {
            config.cache.resource_cache_ttl_seconds =
                val.parse().context("Invalid resource_cache_ttl")?;
        }

        // Logging configuration
        if let Ok(val) = env::var("POLYMARKET_LOG_LEVEL") {
            config.logging.level = val;
        }
        if let Ok(val) = env::var("POLYMARKET_LOG_FORMAT") {
            config.logging.format = val;
        }
        if let Ok(val) = env::var("POLYMARKET_LOG_COLORS") {
            config.logging.enable_colors = val.parse().context("Invalid log_colors")?;
        }
        if let Ok(val) = env::var("POLYMARKET_LOG_TO_FILE") {
            config.logging.log_to_file = val.parse().context("Invalid log_to_file")?;
        }
        if let Ok(val) = env::var("POLYMARKET_LOG_FILE_PATH") {
            config.logging.log_file_path = Some(val);
        }

        if let Ok(val) = env::var("RUST_LOG") {
            config.logging.level = val;
        }

        Ok(config)
    }

    fn merge_configs(_base: Self, override_config: Self) -> Self {
        override_config
    }

    fn validate(&self) -> Result<()> {
        // Validate server configuration
        if self.server.name.is_empty() {
            return Err(anyhow::anyhow!("Server name cannot be empty"));
        }

        if self.server.timeout_seconds == 0 {
            return Err(anyhow::anyhow!("Server timeout must be greater than 0"));
        }

        // Validate API configuration
        if self.api.base_url.is_empty() {
            return Err(anyhow::anyhow!("API base URL cannot be empty"));
        }

        if !self.api.base_url.starts_with("http://") && !self.api.base_url.starts_with("https://") {
            return Err(anyhow::anyhow!(
                "API base URL must start with http:// or https://"
            ));
        }

        if self.api.timeout_seconds == 0 {
            return Err(anyhow::anyhow!("API timeout must be greater than 0"));
        }

        if self.api.max_retries > 10 {
            warn!(
                "API max_retries is very high ({}), consider reducing it",
                self.api.max_retries
            );
        }

        // Validate cache configuration
        if self.cache.ttl_seconds == 0 && self.cache.enabled {
            return Err(anyhow::anyhow!(
                "Cache TTL must be greater than 0 when cache is enabled"
            ));
        }

        if self.cache.max_entries == 0 && self.cache.enabled {
            return Err(anyhow::anyhow!(
                "Cache max_entries must be greater than 0 when cache is enabled"
            ));
        }

        // Validate logging configuration
        let valid_levels = ["trace", "debug", "info", "warn", "error"];
        if !valid_levels.contains(&self.logging.level.as_str()) {
            return Err(anyhow::anyhow!(
                "Invalid log level '{}'. Valid levels: {}",
                self.logging.level,
                valid_levels.join(", ")
            ));
        }

        let valid_formats = ["pretty", "json", "compact"];
        if !valid_formats.contains(&self.logging.format.as_str()) {
            return Err(anyhow::anyhow!(
                "Invalid log format '{}'. Valid formats: {}",
                self.logging.format,
                valid_formats.join(", ")
            ));
        }

        if self.logging.log_to_file && self.logging.log_file_path.is_none() {
            return Err(anyhow::anyhow!(
                "Log file path must be specified when log_to_file is true"
            ));
        }

        Ok(())
    }

    #[must_use]
    pub fn api_timeout(&self) -> Duration {
        Duration::from_secs(self.api.timeout_seconds)
    }

    #[must_use]
    pub fn server_timeout(&self) -> Duration {
        Duration::from_secs(self.server.timeout_seconds)
    }

    #[must_use]
    pub fn cache_ttl(&self) -> Duration {
        Duration::from_secs(self.cache.ttl_seconds)
    }

    #[must_use]
    pub fn resource_cache_ttl(&self) -> Duration {
        Duration::from_secs(self.cache.resource_cache_ttl_seconds)
    }

    #[must_use]
    pub fn retry_delay(&self) -> Duration {
        Duration::from_millis(self.api.retry_delay_ms)
    }
}
