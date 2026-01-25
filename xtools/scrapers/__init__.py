"""
XTools Scrapers Module

Provides scrapers for various X/Twitter data:
- User profiles
- Followers/Following lists
- Tweets and timelines
- Replies
- Threads
- Hashtags
- Media
- Likes
- Lists
- Search results
- Twitter Spaces (audio, transcripts, chat)
- Media downloads
- Trends and recommendations
"""

from xtools.scrapers.base import BaseScraper
from xtools.scrapers.profile import ProfileScraper
from xtools.scrapers.followers import FollowersScraper
from xtools.scrapers.following import FollowingScraper
from xtools.scrapers.tweets import TweetsScraper
from xtools.scrapers.replies import RepliesScraper
from xtools.scrapers.thread import ThreadScraper
from xtools.scrapers.hashtag import HashtagScraper
from xtools.scrapers.media import MediaScraper
from xtools.scrapers.likes import LikesScraper
from xtools.scrapers.lists import ListsScraper
from xtools.scrapers.search import SearchScraper
from xtools.scrapers.spaces import SpacesScraper, Space, SpaceCategory, SpaceState
from xtools.scrapers.downloads import MediaDownloader, MediaItem
from xtools.scrapers.recommendations import RecommendationsScraper, Trend, RecommendedUser

__all__ = [
    "BaseScraper",
    "ProfileScraper",
    "FollowersScraper",
    "FollowingScraper",
    "TweetsScraper",
    "RepliesScraper",
    "ThreadScraper",
    "HashtagScraper",
    "MediaScraper",
    "LikesScraper",
    "ListsScraper",
    "SearchScraper",
    # New scrapers
    "SpacesScraper",
    "Space",
    "SpaceCategory",
    "SpaceState",
    "MediaDownloader",
    "MediaItem",
    "RecommendationsScraper",
    "Trend",
    "RecommendedUser",
]

