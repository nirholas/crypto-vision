//! CLI module for universal-crypto-mcp
//!
//! @author nich
//! @website https://x.com/nichxbt
//! @github https://github.com/nirholas
//! @license Apache-2.0
//!
//! Provides command-line interface for all MCP tools, allowing direct
//! invocation without running the MCP server.

use clap::{Parser, Subcommand};
use serde_json::Value;

#[derive(Parser, Debug)]
#[command(name = "universal-crypto-mcp")]
#[command(author, version, about = "Universal Crypto MCP Server & CLI", long_about = None)]
pub struct Cli {
    /// Configuration file path
    #[arg(short, long, value_name = "FILE")]
    pub config: Option<String>,

    /// Log level (trace, debug, info, warn, error)
    #[arg(short, long, value_name = "LEVEL", default_value = "info")]
    pub log_level: String,

    /// Output format (json, pretty, table)
    #[arg(short, long, default_value = "pretty")]
    pub output: OutputFormat,

    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, clap::ValueEnum)]
pub enum OutputFormat {
    Json,
    Pretty,
    Table,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Run as MCP server (stdio mode, default behavior)
    Serve,

    /// Get list of active prediction markets
    #[command(alias = "list")]
    Markets {
        /// Maximum number of markets to return
        #[arg(short, long, default_value = "20")]
        limit: u32,
    },

    /// Get detailed information about a specific market
    #[command(alias = "get")]
    Market {
        /// Market ID or condition ID
        market_id: String,
    },

    /// Search markets by keyword
    Search {
        /// Keyword to search for
        keyword: String,

        /// Maximum number of results
        #[arg(short, long, default_value = "10")]
        limit: u32,
    },

    /// Get current prices for a market
    Prices {
        /// Market ID
        market_id: String,
    },

    /// Get trending markets by volume
    Trending {
        /// Maximum number of markets
        #[arg(short, long, default_value = "10")]
        limit: u32,
    },

    /// List available MCP resources
    Resources,

    /// Read an MCP resource by URI
    Resource {
        /// Resource URI (e.g., "markets:active", "markets:trending", "market:<id>")
        uri: String,
    },

    /// List available MCP prompts
    Prompts,

    /// Execute an MCP prompt
    Prompt {
        /// Prompt name (e.g., "analyze_market", "find_arbitrage", "market_summary")
        name: String,

        /// Arguments as JSON object (e.g., '{"market_id": "abc123"}')
        #[arg(short, long)]
        args: Option<String>,
    },

    /// Get positions for a wallet address
    Positions {
        /// Wallet address (0x...)
        wallet: String,
    },

    /// Get trade history for a wallet address
    Trades {
        /// Wallet address (0x...)
        wallet: String,

        /// Maximum number of trades to return
        #[arg(short, long, default_value = "50")]
        limit: u32,
    },
}

/// Format output based on the selected format
pub fn format_output(value: &Value, format: OutputFormat) -> String {
    match format {
        OutputFormat::Json => serde_json::to_string(value).unwrap_or_else(|e| {
            eprintln!("[ERROR] Failed to serialize output to JSON: {e}");
            String::new()
        }),
        OutputFormat::Pretty => serde_json::to_string_pretty(value).unwrap_or_else(|e| {
            eprintln!("[ERROR] Failed to serialize output to pretty JSON: {e}");
            String::new()
        }),
        OutputFormat::Table => format_as_table(value),
    }
}

/// Extract outcome price from market data at given index, formatted as percentage
fn format_outcome_price(market: &Value, index: usize) -> String {
    market
        .get("outcome_prices")
        .and_then(|p| p.as_array())
        .and_then(|arr| arr.get(index))
        .and_then(|p| p.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .map(|p| format!("{:.1}%", p * 100.0))
        .unwrap_or_else(|| "N/A".to_string())
}

/// Extract and format volume from market data
fn format_volume(market: &Value) -> String {
    market
        .get("volume")
        .and_then(|v| v.as_f64())
        .map(|v| format!("${v:.0}"))
        .unwrap_or_else(|| "N/A".to_string())
}

/// Format JSON as a simple table (for markets list)
fn format_as_table(value: &Value) -> String {
    let mut output = String::new();

    // Handle markets array
    if let Some(markets) = value.get("markets").and_then(|m| m.as_array()) {
        output.push_str(&format!(
            "{:<50} {:>8} {:>8} {:>12}\n",
            "Question", "YES", "NO", "Volume"
        ));
        output.push_str(&"-".repeat(82));
        output.push('\n');

        for market in markets {
            let question = market
                .get("question")
                .and_then(|q| q.as_str())
                .unwrap_or("Unknown")
                .chars()
                .take(48)
                .collect::<String>();

            output.push_str(&format!(
                "{:<50} {:>8} {:>8} {:>12}\n",
                question,
                format_outcome_price(market, 0),
                format_outcome_price(market, 1),
                format_volume(market)
            ));
        }

        if let Some(count) = value.get("count").and_then(|c| c.as_u64()) {
            output.push_str(&format!("\nTotal: {count} markets\n"));
        }
    } else {
        // Fallback to pretty JSON for non-market data
        output = serde_json::to_string_pretty(value).unwrap_or_else(|e| {
            eprintln!("[ERROR] Failed to serialize output to pretty JSON: {e}");
            String::new()
        });
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_parsing() {
        // Test that CLI parses correctly
        let cli = Cli::parse_from(["universal-crypto-mcp", "markets", "--limit", "5"]);
        assert!(matches!(cli.command, Some(Commands::Markets { limit: 5 })));
    }

    #[test]
    fn test_search_parsing() {
        let cli = Cli::parse_from(["universal-crypto-mcp", "search", "bitcoin", "-l", "10"]);
        if let Some(Commands::Search { keyword, limit }) = cli.command {
            assert_eq!(keyword, "bitcoin");
            assert_eq!(limit, 10);
        } else {
            panic!("Expected Search command");
        }
    }
}
