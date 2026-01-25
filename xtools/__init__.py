"""
XTools - X/Twitter Automation Toolkit

A comprehensive Python toolkit for X/Twitter scraping and automation
using browser automation (Playwright).
"""

__version__ = "0.1.0"
__author__ = "XTools Team"

from xtools.core.browser import BrowserManager
from xtools.core.auth import AuthManager
from xtools.core.rate_limiter import RateLimiter
from xtools.core.config import Config
from xtools.core.exceptions import XToolsError

# Storage
from xtools.storage import Database, FollowTracker
from xtools.storage import SnapshotStorage, TimeSeriesStorage

# Follow Actions
from xtools.actions.follow import (
    FollowUser,
    FollowByKeyword,
    FollowByHashtag,
    FollowTargetFollowers,
    FollowEngagers,
    AutoFollow,
)

# Unfollow Actions
from xtools.actions.unfollow import (
    UnfollowUser,
    UnfollowUsers,
    UnfollowAll,
    UnfollowNonFollowers,
    SmartUnfollow,
    UnfollowByCriteria,
)

# Base classes and utilities
from xtools.actions.base import (
    BaseAction,
    FollowResult,
    UnfollowResult,
    FollowFilters,
    UnfollowFilters,
    ActionStats,
)

# Monitoring
from xtools.monitoring import (
    UnfollowerDetector,
    FollowerAlerts,
    AccountMonitor,
    KeywordMonitor,
    EngagementTracker,
)

# Analytics
from xtools.analytics import (
    GrowthTracker,
    EngagementAnalytics,
    BestTimeAnalyzer,
    AudienceInsights,
    CompetitorAnalyzer,
    ReportGenerator,
)

# Notifications
from xtools.notifications import (
    ConsoleNotifier,
    WebhookNotifier,
    TelegramNotifier,
    NotificationManager,
)

__all__ = [
    # Core
    "BrowserManager",
    "AuthManager", 
    "RateLimiter",
    "Config",
    "XToolsError",
    # Storage
    "Database",
    "FollowTracker",
    "SnapshotStorage",
    "TimeSeriesStorage",
    # Follow Actions
    "FollowUser",
    "FollowByKeyword",
    "FollowByHashtag",
    "FollowTargetFollowers",
    "FollowEngagers",
    "AutoFollow",
    # Unfollow Actions
    "UnfollowUser",
    "UnfollowUsers",
    "UnfollowAll",
    "UnfollowNonFollowers",
    "SmartUnfollow",
    "UnfollowByCriteria",
    # Base classes
    "BaseAction",
    "FollowResult",
    "UnfollowResult",
    "FollowFilters",
    "UnfollowFilters",
    "ActionStats",
    # Monitoring
    "UnfollowerDetector",
    "FollowerAlerts",
    "AccountMonitor",
    "KeywordMonitor",
    "EngagementTracker",
    # Analytics
    "GrowthTracker",
    "EngagementAnalytics",
    "BestTimeAnalyzer",
    "AudienceInsights",
    "CompetitorAnalyzer",
    "ReportGenerator",
    # Notifications
    "ConsoleNotifier",
    "WebhookNotifier",
    "TelegramNotifier",
    "NotificationManager",
]
