//! Real-Time Streaming Example
//!
//! Demonstrates WebSocket streaming for live news and price updates.
//!
//! Run: cargo run --example streaming --features websocket

use fcn_sdk::{Client, Result, StreamEvent};
use futures_util::StreamExt;
use std::time::Duration;
use tokio::time::timeout;

#[tokio::main]
async fn main() -> Result<()> {
    let client = Client::new(None)?;

    println!("═══════════════════════════════════════════════════════════");
    println!("          Real-Time Crypto Streaming - Rust");
    println!("═══════════════════════════════════════════════════════════\n");

    // 1. Stream Live News
    println!("📰 Connecting to live news stream...");
    println!("───────────────────────────────────────────────────────────");
    
    let mut news_stream = client.stream_news().await?;
    println!("✅ Connected! Waiting for news (10 second timeout)...\n");

    let news_result = timeout(Duration::from_secs(10), async {
        let mut count = 0;
        while let Some(result) = news_stream.next().await {
            match result {
                Ok(article) => {
                    count += 1;
                    println!("📰 [{}] {}", article.source, article.title);
                    if let Some(tickers) = &article.tickers {
                        if !tickers.is_empty() {
                            println!("   💹 {}", tickers.join(", "));
                        }
                    }
                    println!();
                    
                    if count >= 3 {
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("   ❌ Error: {}", e);
                }
            }
        }
        count
    })
    .await;

    match news_result {
        Ok(count) => println!("   Received {} articles\n", count),
        Err(_) => println!("   ⏱️  Timeout - no news in last 10 seconds\n"),
    }

    // 2. Stream Live Prices
    println!("💰 Connecting to price stream...");
    println!("───────────────────────────────────────────────────────────");

    let symbols = vec!["BTC", "ETH", "SOL", "XRP", "DOGE"];
    let mut price_stream = client.stream_prices(&symbols).await?;
    println!("✅ Streaming: {}\n", symbols.join(", "));

    let price_result = timeout(Duration::from_secs(10), async {
        let mut updates = 0;
        while let Some(result) = price_stream.next().await {
            match result {
                Ok(price) => {
                    updates += 1;
                    let change_emoji = if price.change_24h >= 0.0 { "📈" } else { "📉" };
                    println!(
                        "   {} {} ${:.2} ({:+.2}%)",
                        change_emoji,
                        price.symbol,
                        price.price,
                        price.change_24h
                    );
                    
                    if updates >= 10 {
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("   ❌ Error: {}", e);
                }
            }
        }
        updates
    })
    .await;

    match price_result {
        Ok(count) => println!("\n   Received {} price updates\n", count),
        Err(_) => println!("\n   ⏱️  Timeout\n"),
    }

    // 3. Combined Event Stream
    println!("🔄 Combined event stream (news + prices + alerts):");
    println!("───────────────────────────────────────────────────────────");

    let mut event_stream = client.stream_all().await?;
    println!("✅ Listening for all events...\n");

    let event_result = timeout(Duration::from_secs(15), async {
        let mut events = 0;
        while let Some(result) = event_stream.next().await {
            match result {
                Ok(event) => {
                    events += 1;
                    match event {
                        StreamEvent::News(article) => {
                            println!("   📰 NEWS: {}", article.title);
                        }
                        StreamEvent::Price(price) => {
                            println!("   💰 PRICE: {} ${:.2}", price.symbol, price.price);
                        }
                        StreamEvent::WhaleAlert(alert) => {
                            println!(
                                "   🐋 WHALE: {} {} ${:.0}",
                                alert.symbol, alert.amount, alert.usd_value
                            );
                        }
                        StreamEvent::Liquidation(liq) => {
                            println!(
                                "   💥 LIQ: {} {} ${:.0}",
                                liq.side.to_uppercase(),
                                liq.symbol,
                                liq.quantity
                            );
                        }
                        StreamEvent::Signal(signal) => {
                            println!(
                                "   📊 SIGNAL: {} {} @ ${:.2}",
                                signal.action.to_uppercase(),
                                signal.symbol,
                                signal.price
                            );
                        }
                    }
                    
                    if events >= 10 {
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("   ❌ Error: {}", e);
                }
            }
        }
        events
    })
    .await;

    match event_result {
        Ok(count) => println!("\n   Received {} events\n", count),
        Err(_) => println!("\n   ⏱️  Timeout\n"),
    }

    // 4. Ticker-Specific Stream
    println!("🎯 Streaming Bitcoin-specific events:");
    println!("───────────────────────────────────────────────────────────");

    let mut btc_stream = client.stream_ticker("BTC").await?;
    println!("✅ Listening for BTC events...\n");

    let btc_result = timeout(Duration::from_secs(10), async {
        let mut events = 0;
        while let Some(result) = btc_stream.next().await {
            if let Ok(event) = result {
                events += 1;
                println!("   🔶 BTC Event: {:?}", event);
                if events >= 5 {
                    break;
                }
            }
        }
        events
    })
    .await;

    match btc_result {
        Ok(count) => println!("\n   Received {} BTC events\n", count),
        Err(_) => println!("\n   ⏱️  Timeout\n"),
    }

    println!("═══════════════════════════════════════════════════════════");
    println!("              Streaming Demo Complete! 🔴");
    println!("═══════════════════════════════════════════════════════════");

    Ok(())
}
