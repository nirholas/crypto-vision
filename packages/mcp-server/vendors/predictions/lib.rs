//! Polymarket Predictions MCP Module
//!
//! @author nich
//! @website https://x.com/nichxbt
//! @github https://github.com/nirholas
//! @license Apache-2.0

pub mod config;
pub mod error;
pub mod models;
pub mod polymarket_client;

pub use config::Config;
pub use error::{PolymarketError, RequestId, Result};
pub use models::*;
pub use polymarket_client::PolymarketClient;
