//! Portfolio Management Example
//!
//! Demonstrates portfolio tracking, watchlists, alerts, and tax reporting.
//!
//! Run: cargo run --example portfolio

use fcn_sdk::{Client, Holding, Result, WatchlistItem};

#[tokio::main]
async fn main() -> Result<()> {
    let client = Client::new(None)?;

    println!("═══════════════════════════════════════════════════════════");
    println!("           Portfolio Management - Rust SDK");
    println!("═══════════════════════════════════════════════════════════\n");

    // Sample portfolio
    let holdings = vec![
        Holding {
            symbol: "BTC".to_string(),
            quantity: 1.5,
            avg_cost: 42000.0,
        },
        Holding {
            symbol: "ETH".to_string(),
            quantity: 20.0,
            avg_cost: 2800.0,
        },
        Holding {
            symbol: "SOL".to_string(),
            quantity: 100.0,
            avg_cost: 95.0,
        },
        Holding {
            symbol: "LINK".to_string(),
            quantity: 500.0,
            avg_cost: 15.0,
        },
    ];

    // 1. Portfolio Valuation
    println!("💼 Portfolio Valuation:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_portfolio_value(&holdings).await {
        Ok(portfolio) => {
            println!(
                "   Total Value:    ${:>12.2}",
                portfolio.total_value
            );
            println!(
                "   Total Cost:     ${:>12.2}",
                portfolio.total_cost
            );
            let pnl = portfolio.total_value - portfolio.total_cost;
            let pnl_pct = (pnl / portfolio.total_cost) * 100.0;
            let pnl_emoji = if pnl >= 0.0 { "📈" } else { "📉" };
            println!(
                "   P&L:            ${:>12.2} ({:+.2}%) {}",
                pnl, pnl_pct, pnl_emoji
            );
            println!();
            println!("   Holdings:");
            for h in &portfolio.holdings {
                let pnl_pct = ((h.current_value - h.cost_basis) / h.cost_basis) * 100.0;
                println!(
                    "     {:<6} {:>8.4} @ ${:<8.2} → ${:<10.2} ({:+.1}%)",
                    h.symbol,
                    h.quantity,
                    h.avg_cost,
                    h.current_value,
                    pnl_pct
                );
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 2. Portfolio Allocation
    println!("\n📊 Portfolio Allocation:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_portfolio_allocation(&holdings).await {
        Ok(allocation) => {
            for asset in &allocation {
                let bar_len = (asset.percentage * 0.4) as usize;
                let bar = "█".repeat(bar_len);
                println!(
                    "   {:<6} {:>5.1}% {} ${:.2}",
                    asset.symbol, asset.percentage, bar, asset.value
                );
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 3. Watchlist
    println!("\n👀 Watchlist:");
    println!("───────────────────────────────────────────────────────────");
    let watchlist = vec![
        WatchlistItem {
            symbol: "AVAX".to_string(),
            target_price: Some(45.0),
            notes: Some("Wait for breakout".to_string()),
        },
        WatchlistItem {
            symbol: "MATIC".to_string(),
            target_price: Some(1.20),
            notes: Some("Layer 2 play".to_string()),
        },
        WatchlistItem {
            symbol: "ARB".to_string(),
            target_price: None,
            notes: Some("Monitor for entry".to_string()),
        },
    ];

    match client.get_watchlist_prices(&watchlist).await {
        Ok(items) => {
            for item in &items {
                let target_str = item
                    .target_price
                    .map(|t| format!("Target: ${:.2}", t))
                    .unwrap_or_else(|| "No target".to_string());
                
                let distance = item.target_price.map(|t| {
                    let pct = ((t - item.current_price) / item.current_price) * 100.0;
                    if pct > 0.0 {
                        format!("▲ {:.1}% to target", pct)
                    } else {
                        format!("▼ {:.1}% below target", pct.abs())
                    }
                });

                println!("   {} ${:.2}", item.symbol, item.current_price);
                println!("      {} | {}", target_str, distance.unwrap_or_default());
                if let Some(notes) = &item.notes {
                    println!("      📝 {}", notes);
                }
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 4. Price Alerts
    println!("\n🔔 Active Price Alerts:");
    println!("───────────────────────────────────────────────────────────");
    
    // Set some example alerts
    let alerts = vec![
        ("BTC", 50000.0, "above"),
        ("ETH", 3000.0, "above"),
        ("SOL", 80.0, "below"),
    ];

    for (symbol, price, condition) in &alerts {
        let emoji = if *condition == "above" { "📈" } else { "📉" };
        println!("   {} {} {} ${:.2}", emoji, symbol, condition, price);
    }

    // 5. Portfolio History (Mock)
    println!("\n📈 Performance (Last 7 Days):");
    println!("───────────────────────────────────────────────────────────");
    match client.get_portfolio_history(&holdings, 7).await {
        Ok(history) => {
            let start = history.first().map(|h| h.value).unwrap_or(0.0);
            let end = history.last().map(|h| h.value).unwrap_or(0.0);
            let change = ((end - start) / start) * 100.0;
            
            println!("   7d Change: {:+.2}%", change);
            println!();
            
            // Simple ASCII chart
            let max = history.iter().map(|h| h.value).fold(0.0_f64, f64::max);
            let min = history.iter().map(|h| h.value).fold(f64::MAX, f64::min);
            let range = max - min;
            
            for point in &history {
                let height = ((point.value - min) / range * 20.0) as usize;
                let bar = "█".repeat(height);
                println!("   {} │{}", point.date, bar);
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 6. Tax Report
    println!("\n📋 Tax Report (2025):");
    println!("───────────────────────────────────────────────────────────");
    
    // Sample transactions for tax calculation
    let transactions = vec![
        ("BTC", "buy", 0.5, 35000.0, "2025-01-15"),
        ("BTC", "sell", 0.3, 48000.0, "2025-06-20"),
        ("ETH", "buy", 10.0, 2500.0, "2025-02-10"),
        ("ETH", "sell", 5.0, 3200.0, "2025-08-15"),
    ];

    match client.generate_tax_report(&transactions, 2025, "US").await {
        Ok(report) => {
            println!("   Tax Year: {}", report.summary.tax_year);
            println!("   Jurisdiction: {}", report.summary.jurisdiction);
            println!("   Cost Basis Method: {}", report.summary.cost_basis_method);
            println!();
            println!("   Capital Gains:");
            for gain in &report.capital_gains {
                let term = if gain.holding_period == "long" {
                    "Long-term"
                } else {
                    "Short-term"
                };
                let emoji = if gain.gain >= 0.0 { "📈" } else { "📉" };
                println!(
                    "   {} {} {} ${:.2} ({})",
                    emoji, gain.asset, if gain.gain >= 0.0 { "gain" } else { "loss" },
                    gain.gain.abs(), term
                );
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 7. Risk Analysis
    println!("\n⚠️  Risk Analysis:");
    println!("───────────────────────────────────────────────────────────");
    match client.analyze_portfolio_risk(&holdings).await {
        Ok(risk) => {
            println!("   Volatility Score: {}/10", risk.volatility_score);
            println!("   Concentration Risk: {}", risk.concentration_risk);
            println!("   Correlation to BTC: {:.2}", risk.btc_correlation);
            println!();
            println!("   Recommendations:");
            for rec in &risk.recommendations {
                println!("   • {}", rec);
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    println!("\n═══════════════════════════════════════════════════════════");
    println!("             Portfolio Demo Complete! 💼");
    println!("═══════════════════════════════════════════════════════════");

    Ok(())
}
