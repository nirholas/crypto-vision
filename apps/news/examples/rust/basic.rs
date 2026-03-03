//! Basic FCN SDK Example
//!
//! Demonstrates core API functionality: news, search, trending, and market data.
//!
//! Run: cargo run --example basic

use fcn_sdk::{Client, NewsFilter, Result};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize client (no API key needed for free tier)
    let client = Client::new(None)?;

    println!("═══════════════════════════════════════════════════════════");
    println!("              Free Crypto News - Rust SDK Demo");
    println!("═══════════════════════════════════════════════════════════\n");

    // 1. Health Check
    println!("🏥 Checking API health...");
    let healthy = client.health().await?;
    println!("   Status: {}\n", if healthy { "✅ Healthy" } else { "❌ Down" });

    // 2. Get Latest News
    println!("📰 Latest Crypto News:");
    println!("───────────────────────────────────────────────────────────");
    let news = client
        .get_news(Some(NewsFilter {
            limit: Some(5),
            ..Default::default()
        }))
        .await?;

    for (i, article) in news.articles.iter().enumerate() {
        println!("{}. [{}] {}", i + 1, article.source, article.title);
        if !article.tickers.is_empty() {
            println!("   💹 Tickers: {}", article.tickers.join(", "));
        }
        if let Some(sentiment) = &article.sentiment {
            let emoji = match sentiment.as_str() {
                "bullish" => "🟢",
                "bearish" => "🔴",
                _ => "⚪",
            };
            println!("   {} Sentiment: {}", emoji, sentiment);
        }
    }

    // 3. Search News
    println!("\n🔍 Searching for 'Ethereum':");
    println!("───────────────────────────────────────────────────────────");
    let search_results = client.search("ethereum", Some(3)).await?;

    for article in &search_results.articles {
        println!("• {}", article.title);
        println!("  🔗 {}", article.link);
    }

    // 4. Trending Tickers
    println!("\n📈 Trending Tickers:");
    println!("───────────────────────────────────────────────────────────");
    let trending = client.get_trending(Some(10)).await?;

    for item in &trending.trending {
        let bar = "█".repeat((item.mentions as usize).min(20));
        println!("${:<6} {} ({} mentions)", item.symbol, bar, item.mentions);
    }

    // 5. Market Data
    println!("\n💰 Top Cryptocurrencies:");
    println!("───────────────────────────────────────────────────────────");
    let market = client.get_market(Some(5)).await?;

    for coin in &market.coins {
        let change = coin.price_change_percentage_24h.unwrap_or(0.0);
        let arrow = if change >= 0.0 { "▲" } else { "▼" };
        println!(
            "{:<10} ${:<12.2} {} {:.2}%",
            coin.symbol.to_uppercase(),
            coin.current_price,
            arrow,
            change.abs()
        );
    }

    // 6. Fear & Greed Index
    println!("\n😱 Fear & Greed Index:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_fear_greed().await {
        Ok(fg) => {
            let bar_len = (fg.value as usize) / 5;
            let bar = "█".repeat(bar_len);
            println!("   {} {} ({})", fg.value, bar, fg.classification);
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 7. Categories
    println!("\n📂 Available Categories:");
    println!("───────────────────────────────────────────────────────────");
    let categories = client.get_categories().await?;
    println!("   {}", categories.join(", "));

    // 8. Sources
    println!("\n📡 News Sources:");
    println!("───────────────────────────────────────────────────────────");
    let sources = client.get_sources().await?;
    for source in sources.iter().take(10) {
        println!("   • {}", source);
    }
    if sources.len() > 10 {
        println!("   ... and {} more", sources.len() - 10);
    }

    println!("\n═══════════════════════════════════════════════════════════");
    println!("                    Demo Complete! 🎉");
    println!("═══════════════════════════════════════════════════════════");

    Ok(())
}
