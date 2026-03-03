//! AI Features Example
//!
//! Demonstrates AI-powered features: sentiment analysis, digest, narratives,
//! claims verification, and natural language queries.
//!
//! Run: cargo run --example ai_features

use fcn_sdk::{Client, NewsFilter, Result};

#[tokio::main]
async fn main() -> Result<()> {
    let client = Client::new(None)?;

    println!("═══════════════════════════════════════════════════════════");
    println!("             AI-Powered Crypto Intelligence");
    println!("═══════════════════════════════════════════════════════════\n");

    // 1. AI Digest - Market Summary
    println!("🤖 AI Market Digest:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_digest().await {
        Ok(digest) => {
            println!("   Market Mood: {}", digest.market_mood);
            println!();
            println!("   Summary:");
            for line in digest.summary.lines() {
                println!("   {}", line);
            }
            println!();
            println!("   Top Stories:");
            for (i, story) in digest.top_stories.iter().enumerate() {
                println!("   {}. {}", i + 1, story);
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 2. Sentiment Analysis on News
    println!("\n📊 Sentiment Analysis:");
    println!("───────────────────────────────────────────────────────────");
    let news = client
        .get_news(Some(NewsFilter {
            limit: Some(5),
            ..Default::default()
        }))
        .await?;

    match client.analyze_sentiment(&news.articles).await {
        Ok(results) => {
            for result in &results {
                let (emoji, color) = match result.sentiment.as_str() {
                    "bullish" => ("🟢", "Bullish"),
                    "bearish" => ("🔴", "Bearish"),
                    _ => ("⚪", "Neutral"),
                };
                println!("   {} {} ({:.0}% confidence)", emoji, color, result.confidence * 100.0);
                println!("      {}", truncate(&result.title, 60));
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 3. Market Narratives
    println!("\n📖 Active Market Narratives:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_narratives().await {
        Ok(narratives) => {
            for narrative in &narratives {
                let strength_bar = "█".repeat((narrative.strength * 10.0) as usize);
                println!("   {} {}", narrative.name, strength_bar);
                println!("      {}", narrative.description);
                if !narrative.related_tickers.is_empty() {
                    println!("      Tickers: {}", narrative.related_tickers.join(", "));
                }
                println!();
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 4. Claims & Fact Checking
    println!("🔍 Recent Claims (Fact-Checked):");
    println!("───────────────────────────────────────────────────────────");
    match client.get_claims(Some(5)).await {
        Ok(claims) => {
            for claim in &claims {
                let status = match claim.verification_status.as_str() {
                    "verified" => "✅ Verified",
                    "disputed" => "⚠️  Disputed",
                    "false" => "❌ False",
                    _ => "❓ Unverified",
                };
                println!("   {}", status);
                println!("      Claim: {}", truncate(&claim.claim, 60));
                if let Some(evidence) = &claim.evidence {
                    println!("      Evidence: {}", truncate(evidence, 50));
                }
                println!();
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 5. Ask AI Questions
    println!("💬 AI Q&A:");
    println!("───────────────────────────────────────────────────────────");
    
    let questions = [
        "What's the current sentiment on Bitcoin?",
        "Are there any major ETF developments today?",
        "What's happening in DeFi this week?",
    ];

    for question in &questions {
        println!("   Q: {}", question);
        match client.ask(question).await {
            Ok(answer) => {
                println!("   A: {}", truncate(&answer, 100));
            }
            Err(e) => println!("   A: ⚠️  {}", e),
        }
        println!();
    }

    // 6. Semantic Search
    println!("🔎 Semantic Search - 'layer 2 scaling solutions':");
    println!("───────────────────────────────────────────────────────────");
    match client.semantic_search("layer 2 scaling solutions", Some(3)).await {
        Ok(results) => {
            for article in &results {
                println!("   • {}", article.title);
                println!("     Score: {:.2} | Source: {}", article.relevance_score, article.source);
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    // 7. Breaking News Detection
    println!("\n🚨 Breaking News:");
    println!("───────────────────────────────────────────────────────────");
    match client.get_breaking(Some(3)).await {
        Ok(breaking) => {
            if breaking.articles.is_empty() {
                println!("   No breaking news at the moment.");
            } else {
                for article in &breaking.articles {
                    println!("   🔴 {}", article.title);
                    println!("      {}", article.source);
                }
            }
        }
        Err(e) => println!("   ⚠️  Not available: {}", e),
    }

    println!("\n═══════════════════════════════════════════════════════════");
    println!("                AI Demo Complete! 🧠");
    println!("═══════════════════════════════════════════════════════════");

    Ok(())
}

fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}
