"""
@author Nich
@website x.com/nichxbt
@github github.com/nirholas
@license MIT
"""
import requests
from mcp.server.fastmcp import FastMCP
import os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.getenv("UNIVERSAL_CRYPTO_API_KEY")
API_PLAN = os.getenv("UNIVERSAL_CRYPTO_API_PLAN", "developer")

# Validate API_KEY
if not API_KEY:
    raise ValueError("UNIVERSAL_CRYPTO_API_KEY environment variable is not set")

mcp = FastMCP("crypto news")
        
@mcp.tool()
def get_crypto_news(kind: str = "news", num_pages: int = 1) -> str:
    """
    Fetch the latest cryptocurrency news from CryptoPanic.

    Args:
        kind (str, optional): Type of content to fetch. Valid options are:
            - 'news': Fetch news articles (default).
            - 'media': Fetch media content like videos.
        num_pages (int, optional): Number of pages to fetch (each page contains multiple news items).
            Defaults to 1. Maximum is 10 to avoid API rate limits.

    Returns:
        str: A concatenated string of news titles, each prefixed with a dash (-).

    Raises:
        ValueError: If the API key is not set or if the API request fails.
    """
    news = fetch_crypto_news(kind, num_pages)
    readable = concatenate_news(news)
    return readable

def fetch_crypto_news_page(kind: str = "news", page: int = 1) -> list:
    try:
        url = f"https://cryptopanic.com/api/{API_PLAN}/v2/posts/"
        params = {
            "auth_token": API_KEY,
            "kind": kind,
            "regions": "en",
            "page": page
        }
        response = requests.get(url, params=params)
        return response.json().get("results", [])
    except Exception:
        return []
        
def fetch_crypto_news(kind: str = "news", num_pages: int = 10) -> list:
    all_news = []
    for page in range(1, num_pages + 1):
        news_items = fetch_crypto_news_page(kind, page)
        if not news_items:
            break
        all_news.extend(news_items)
    return all_news        

def concatenate_news(news_items: list) -> str:
    concatenated_text = ""
    for idx, news in enumerate(news_items):  
        title = news.get("title", "No Title")
        concatenated_text += f"- {title}\n"
    return concatenated_text.strip()

if __name__ == "__main__":
    mcp.run(transport="stdio")
