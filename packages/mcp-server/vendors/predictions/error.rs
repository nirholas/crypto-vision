//! Error handling module
//!
//! @author nich
//! @website https://x.com/nichxbt
//! @github https://github.com/nirholas
//! @license Apache-2.0

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestId(pub String);

impl RequestId {
    #[must_use]
    pub fn new() -> Self {
        Self(uuid::Uuid::new_v4().to_string())
    }
}

impl Default for RequestId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for RequestId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, thiserror::Error)]
pub enum PolymarketError {
    #[error("API request failed: {message} (request_id: {request_id})")]
    Api {
        message: String,
        status_code: Option<u16>,
        request_id: RequestId,
    },

    #[error("Network error: {message}")]
    Network { message: String },

    #[error("Deserialization error: {message}")]
    Deserialization { message: String },

    #[error("Configuration error: {message}")]
    Config { message: String },
}

impl PolymarketError {
    pub fn api_error(message: impl Into<String>, status_code: Option<u16>) -> Self {
        Self::Api {
            message: message.into(),
            status_code,
            request_id: RequestId::new(),
        }
    }

    pub fn network_error(message: impl Into<String>) -> Self {
        Self::Network {
            message: message.into(),
        }
    }

    pub fn deserialization_error(message: impl Into<String>) -> Self {
        Self::Deserialization {
            message: message.into(),
        }
    }

    pub fn config_error(message: impl Into<String>) -> Self {
        Self::Config {
            message: message.into(),
        }
    }
}

pub type Result<T> = std::result::Result<T, PolymarketError>;
