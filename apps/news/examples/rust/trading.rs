//! Trading Signals & Market Intelligence Example
//!
//! Demonstrates trading-focused features: signals, whale alerts, funding rates,
//! liquidations, arbitrage, and orderbook data.
//!
//! Run: cargo run --example trading

use fcn_sdk::{Client, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let client = Client::new(None)?;

    println!("═══════════════════════════════════════════════════════════");
    println!("          Trading Intelligence Dashboard - Rust");
    println!("═══════════════════════════════════════════════════════════\n");

    // 1. Trading Signals
    println!("📊 Trading Signals:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_signals(Some(5)).await {
        Ok(signals) => {
            for signal in &signals {
                let emoji = match signal.action.as_str() {
                    "buy" | "long" => "🟢",
                    "sell" | "short" => "🔴",
                    _ => "⚪",
                };
                println!(
                    "   {} {} {} @ ${:.2} | Confidence: {:.0}%",
                    emoji,
                    signal.action.to_uppercase(),
                    signal.symbol,
                    signal.price,
                    signal.confidence * 100.0
                );
                if let Some(reason) = &signal.reason {
                    println!("      └─ {}", reason);
                }
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 2. Whale Alerts
    println!("\n🐋 Whale Alerts (Large Transactions):");
    println!("───────────────────────────────────────────────────────────");
    match client.get_whale_alerts(Some(5)).await {
        Ok(alerts) => {
            for alert in &alerts {
                let amount_str = if alert.amount >= 1_000_000.0 {
                    format!("{:.1}M", alert.amount / 1_000_000.0)
                } else {
                    format!("{:.0}K", alert.amount / 1_000.0)
                };
                println!(
                    "   {} {} ${} ({} → {})",
                    alert.symbol, amount_str, alert.usd_value, alert.from_label, alert.to_label
                );
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 3. Funding Rates
    println!("\n💵 Perpetual Funding Rates:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_funding_rates(Some(10)).await {
        Ok(rates) => {
            for rate in &rates {
                let indicator = if rate.rate > 0.01 {
                    "🔴 High"
                } else if rate.rate < -0.01 {
                    "🟢 Negative"
                } else {
                    "⚪ Neutral"
                };
                println!(
                    "   {:<8} {:>8.4}% @ {} {}",
                    rate.symbol, rate.rate, rate.exchange, indicator
                );
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 4. Liquidations
    println!("\n💥 Recent Liquidations:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_liquidations(Some(5)).await {
        Ok(liqs) => {
            let mut total_long = 0.0;
            let mut total_short = 0.0;
            for liq in &liqs {
                let side_emoji = if liq.side == "long" { "🔻" } else { "🔺" };
                println!(
                    "   {} {} {} ${:.0} @ ${:.2}",
                    side_emoji,
                    liq.side.to_uppercase(),
                    liq.symbol,
                    liq.quantity,
                    liq.price
                );
                if liq.side == "long" {
                    total_long += liq.quantity;
                } else {
                    total_short += liq.quantity;
                }
            }
            println!("   ─────────────────────────────────────");
            println!("   Total Long Liqs:  ${:.0}", total_long);
            println!("   Total Short Liqs: ${:.0}", total_short);
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 5. Arbitrage Opportunities
    println!("\n🔄 Arbitrage Opportunities:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_arbitrage(Some(5)).await {
        Ok(arbs) => {
            for arb in &arbs {
                println!(
                    "   {} | {} ${:.2} → {} ${:.2} | Spread: {:.2}%",
                    arb.symbol,
                    arb.buy_exchange,
                    arb.buy_price,
                    arb.sell_exchange,
                    arb.sell_price,
                    arb.spread_percent
                );
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 6. Order Book Summary
    println!("\n📗 Order Book (BTC/USDT):");
    println!("───────────────────────────────────────────────────────────");
    match client.get_orderbook("BTC", Some(5)).await {
        Ok(book) => {
            println!("   ASKS (Sells):");
            for ask in book.asks.iter().rev() {
                let bar = "█".repeat((ask.quantity / 10.0) as usize);
                println!("   ${:<10.2} {} {:.4}", ask.price, bar, ask.quantity);
            }
            println!("   ─────────────────── SPREAD: ${:.2}", book.spread);
            println!("   BIDS (Buys):");
            for bid in &book.bids {
                let bar = "█".repeat((bid.quantity / 10.0) as usize);
                println!("   ${:<10.2} {} {:.4}", bid.price, bar, bid.quantity);
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 7. Options Flow
    println!("\n🎰 Options Flow:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_options_flow(Some(5)).await {
        Ok(options) => {
            for opt in &options {
                let emoji = if opt.side == "call" { "📈" } else { "📉" };
                println!(
                    "   {} {} {} ${} {} | Premium: ${:.0}K",
                    emoji,
                    opt.symbol,
                    opt.side.to_uppercase(),
                    opt.strike,
                    opt.expiry,
                    opt.premium / 1000.0
                );
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    println!("\n═══════════════════════════════════════════════════════════");
    println!("              Trading Dashboard Complete! 📊");
    println!("═══════════════════════════════════════════════════════════");

    Ok(())
}
