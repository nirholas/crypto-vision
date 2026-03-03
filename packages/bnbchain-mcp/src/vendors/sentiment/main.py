"""
@author Nich
@website x.com/nichxbt
@github github.com/nirholas
@license MIT
"""
import requests
from mcp.server.fastmcp import FastMCP
from datetime import datetime, timedelta, UTC
import os
from dotenv import load_dotenv

load_dotenv()

mcp = FastMCP("CryptoSentiment")
SANTIMENT_API_KEY = os.getenv("SANTIMENT_API_KEY")
if not SANTIMENT_API_KEY:
    raise ValueError("SANTIMENT_API_KEY not found in environment variables. Please set it in .env file.")
SANTIMENT_API_URL = "https://api.santiment.net/graphql"
HEADERS = {"Authorization": f"Apikey {SANTIMENT_API_KEY}"}

def fetch_santiment_data(metric: str, asset: str, days: int) -> dict:
    now = datetime.now(UTC)
    
    to_date = now
    from_date = to_date - timedelta(days=days)
    
    query = f"""
    {{
      getMetric(metric: "{metric}") {{
        timeseriesData(
          slug: "{asset}"
          from: "{from_date.isoformat()}"
          to: "{to_date.isoformat()}"
          interval: "1d"
        ) {{
          datetime
          value
        }}
      }}
    }}
    """
    response = requests.post(SANTIMENT_API_URL, json={"query": query}, headers=HEADERS)
    result = response.json()
    if result.get("errors"):
        raise Exception(f"API error: {result.get('errors')}")
    return result

def fetch_trending_words(days: int = 7) -> dict:
    now = datetime.now(UTC)
    
    to_date = now
    from_date = to_date - timedelta(days=days)
    
    query = f"""
    {{
      getTrendingWords(size: 10, from: "{from_date.isoformat()}", to: "{to_date.isoformat()}", interval: "1d") {{
        datetime
        topWords {{
          word
          score
        }}
      }}
    }}
    """
    response = requests.post(SANTIMENT_API_URL, json={"query": query}, headers=HEADERS)
    result = response.json()
    if result.get("errors"):
        raise Exception(f"API error: {result.get('errors')}")
    return result

@mcp.tool()
def get_sentiment_balance(asset: str, days: int = 7) -> str:
    """
    Retrieve the sentiment balance (sentiment_balance_total) for a given asset.
    
    Parameters:
    - asset (str): The cryptocurrency slug (e.g., "bitcoin", "ethereum"). Required.
    - days (int): Number of days to calculate the average sentiment balance, defaults to 7.
    
    Usage:
    - Use this tool to get the average sentiment balance (positive minus negative sentiment) over a period.
    
    Returns:
    - A string with the average sentiment balance (e.g., "Bitcoin's sentiment balance over the past 7 days is 12.5").
    """
    try:
        data = fetch_santiment_data("sentiment_balance_total", asset, days)
        timeseries = data.get("data", {}).get("getMetric", {}).get("timeseriesData", [])
        if not timeseries:
            return f"Unable to fetch sentiment data for {asset}. Check subscription limits or asset availability."
        avg_balance = sum(float(d["value"]) for d in timeseries) / len(timeseries)
        return f"{asset.capitalize()}'s sentiment balance over the past {days} days is {avg_balance:.1f}."
    except Exception as e:
        return f"Error fetching sentiment balance for {asset}: {str(e)}"

@mcp.tool()
def get_social_volume(asset: str, days: int = 7) -> str:
    """
    Retrieve the total social volume (social_volume_total) for a given asset. It calculates the total number of social data text documents that contain the given search term at least once. Examples of documents are telegram messages and reddit posts.
    
    Parameters:
    - asset (str): The cryptocurrency slug (e.g., "bitcoin", "ethereum"). Required.
    - days (int): Number of days to sum the social volume, defaults to 7.
    
    Usage:
    - Call this tool to get the total number of social media mentions for an asset over a period.
    
    Returns:
    - A string with the total social volume (e.g., "Bitcoin's social volume over the past 7 days is 15,000 mentions").
    """
    try:
        data = fetch_santiment_data("social_volume_total", asset, days)
        timeseries = data.get("data", {}).get("getMetric", {}).get("timeseriesData", [])
        if not timeseries:
            return f"Unable to fetch social volume for {asset}. Check subscription limits or asset availability."
        total_volume = sum(int(d["value"]) for d in timeseries)
        return f"{asset.capitalize()}'s social volume over the past {days} days is {total_volume:,} mentions."
    except Exception as e:
        return f"Error fetching social volume for {asset}: {str(e)}"

@mcp.tool()
def alert_social_shift(asset: str, threshold: float = 50.0, days: int = 7) -> str:
    """
    Detect significant shifts (spikes or drops) in social volume (social_volume_total) for a given asset.
    
    Parameters:
    - asset (str): The cryptocurrency slug (e.g., "bitcoin", "ethereum"). Required.
    - threshold (float): Minimum percentage change (absolute value) to trigger an alert, defaults to 50.0 (i.e., 50%).
    - days (int): Number of days to analyze for baseline volume, defaults to 7.
    
    Usage:
    - Call this tool to check if the latest social volume has significantly spiked or dropped compared to the previous average.
    
    Returns:
    - A string indicating if a shift occurred (e.g., "Bitcoin's social volume spiked by 75.0% in the last 24 hours" or "Bitcoin's social volume dropped by 60.0% in the last 24 hours").
    """
    try:
        data = fetch_santiment_data("social_volume_total", asset, days)
        timeseries = data.get("data", {}).get("getMetric", {}).get("timeseriesData", [])
        
        if not timeseries or len(timeseries) < 2:
            return f"Unable to detect social volume shift for {asset}, insufficient data."
        
        latest_volume = int(timeseries[-1]["value"])  # Latest day's volume
        prev_avg_volume = sum(int(d["value"]) for d in timeseries[:-1]) / (len(timeseries) - 1)  # Average of previous days
        change_percent = ((latest_volume - prev_avg_volume) / prev_avg_volume) * 100
        
        abs_change = abs(change_percent)
        if abs_change >= threshold:
            direction = "spiked" if change_percent > 0 else "dropped"
            return f"{asset.capitalize()}'s social volume {direction} by {abs_change:.1f}% in the last 24 hours, from an average of {prev_avg_volume:,.0f} to {latest_volume:,}."
        return f"No significant shift detected for {asset.capitalize()}, change is {change_percent:.1f}%."
    except Exception as e:
        return f"Error detecting social volume shift for {asset}: {str(e)}"

@mcp.tool()
def get_trending_words(days: int = 7, top_n: int = 5) -> str:
    """
    Retrieve the top trending words in the crypto space over a specified period, aggregated and ranked by score.
    
    Parameters:
    - days (int): Number of days to analyze trending words, defaults to 7.
    - top_n (int): Number of top trending words to return, defaults to 5.
    
    Usage:
    - Call this tool to get a list of the most popular words trending in cryptocurrency discussions, ranked across the entire period.
    
    Returns:
    - A string listing the top trending words (e.g., "Top 5 trending words over the past 7 days: 'halving', 'bullrun', 'defi', 'nft', 'pump'").
    """
    try:
        data = fetch_trending_words(days)
        trends = data.get("data", {}).get("getTrendingWords", [])
        if not trends:
            return "Unable to fetch trending words. Check API subscription limits or connectivity."
        
        word_scores = {}
        for day in trends:
            for word_data in day["topWords"]:
                word = word_data["word"]
                score = word_data["score"]
                if word in word_scores:
                    word_scores[word] += score
                else:
                    word_scores[word] = score
        
        if not word_scores:
            return "No trending words data available for the specified period."
        
        top_words = sorted(word_scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
        top_words_list = [word for word, _ in top_words]
        
        return f"Top {top_n} trending words over the past {days} days: {', '.join(top_words_list)}."
    except Exception as e:
        return f"Error fetching trending words: {str(e)}"

@mcp.tool()
def get_social_dominance(asset: str, days: int = 7) -> str:
    """
    Retrieve the social dominance (social_dominance_total) for a given asset. Social Dominance shows the share of the discussions in crypto media that is referring to a particular asset or phrase.
    
    Parameters:
    - asset (str): The cryptocurrency slug (e.g., "bitcoin", "ethereum"). Required.
    - days (int): Number of days to calculate average social dominance, defaults to 7.
    
    Usage:
    - Call this tool to get the percentage of social media discussion dominated by the asset.
    
    Returns:
    - A string with the average social dominance (e.g., "Bitcoin's social dominance over the past 7 days is 25.3%").
    """
    try:
        data = fetch_santiment_data("social_dominance_total", asset, days)
        timeseries = data.get("data", {}).get("getMetric", {}).get("timeseriesData", [])
        if not timeseries:
            return f"Unable to fetch social dominance for {asset}. Check subscription limits or asset availability."
        avg_dominance = sum(float(d["value"]) for d in timeseries) / len(timeseries)
        return f"{asset.capitalize()}'s social dominance over the past {days} days is {avg_dominance:.1f}%."
    except Exception as e:
        return f"Error fetching social dominance for {asset}: {str(e)}"

if __name__ == "__main__":
    mcp.run()