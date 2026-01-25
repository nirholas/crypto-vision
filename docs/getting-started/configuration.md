# Configuration

XTools is highly configurable. This guide covers all configuration options and best practices.

## Configuration Methods

XTools supports multiple configuration methods (in order of precedence):

1. **Code** - Direct parameters in your script
2. **Environment variables** - For secrets and deployment
3. **Config file** - `xtools.toml` or `xtools.yaml`
4. **Defaults** - Sensible built-in defaults

## Quick Configuration

### In Code

```python
from xtools import XTools

async with XTools(
    headless=True,           # Run browser invisibly
    timeout=30000,           # 30 second timeout
    rate_limit=20,           # Max 20 requests/minute
    session_file="session.json"
) as x:
    # Your code here
    pass
```

### Environment Variables

```bash
# Authentication
export XTOOLS_SESSION_FILE="/path/to/session.json"

# Browser
export XTOOLS_HEADLESS=true
export XTOOLS_TIMEOUT=30000

# Rate limiting
export XTOOLS_RATE_LIMIT=20

# Proxy
export XTOOLS_PROXY_URL="http://user:pass@proxy:8080"

# AI Features
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Notifications
export DISCORD_WEBHOOK="https://discord.com/api/webhooks/..."
export TELEGRAM_BOT_TOKEN="123456:ABC..."
export TELEGRAM_CHAT_ID="123456789"
```

### Config File

Create `xtools.toml` in your project root:

```toml
[xtools]
# ============================================
# CORE SETTINGS
# ============================================

# Browser mode: true = invisible, false = visible
headless = true

# Page load timeout (milliseconds)
timeout = 30000

# Slow down operations by X ms (helps avoid detection)
slow_mo = 100

# Default session file location
session_file = "~/.config/xtools/session.json"

# ============================================
# RATE LIMITING
# ============================================

[xtools.rate_limit]
# Global rate limit (requests per minute)
requests_per_minute = 20

# Operation-specific limits
follows_per_hour = 30
unfollows_per_hour = 50
likes_per_hour = 100
tweets_per_day = 300

# Cooldown after hitting limits (seconds)
cooldown_duration = 300

# ============================================
# PROXY SETTINGS
# ============================================

[xtools.proxy]
enabled = false
url = "http://user:pass@proxy:8080"

# Rotate proxies (requires proxy list)
rotate = false
proxy_file = "proxies.txt"

# ============================================
# BROWSER FINGERPRINT
# ============================================

[xtools.browser]
# User agent (leave empty for default)
user_agent = ""

# Viewport size
viewport_width = 1920
viewport_height = 1080

# Locale and timezone
locale = "en-US"
timezone = "America/New_York"

# ============================================
# STORAGE & CACHING
# ============================================

[xtools.storage]
# Enable caching
cache_enabled = true

# Cache location
cache_dir = "~/.cache/xtools"

# Cache TTL (seconds) - how long to keep cached data
cache_ttl = 3600

# Database for persistent storage
database_url = "sqlite:///~/.local/share/xtools/data.db"

# ============================================
# EXPORT DEFAULTS
# ============================================

[xtools.export]
# Default format: csv, json, excel, parquet
default_format = "csv"

# Default output directory
output_dir = "./exports"

# Include timestamp in filenames
timestamp_filenames = true

# ============================================
# AI FEATURES
# ============================================

[xtools.ai]
# Default provider: openai, anthropic, ollama
default_provider = "openai"

# Model settings per provider
[xtools.ai.openai]
model = "gpt-4-turbo"
temperature = 0.7
max_tokens = 500

[xtools.ai.anthropic]
model = "claude-3-sonnet"
temperature = 0.7
max_tokens = 500

[xtools.ai.ollama]
model = "llama3"
base_url = "http://localhost:11434"

# ============================================
# NOTIFICATIONS
# ============================================

[xtools.notifications]
# Enable notifications
enabled = true

# Notification triggers
notify_on_error = true
notify_on_complete = false
notify_daily_report = true

# Discord
discord_webhook = ""

# Telegram
telegram_bot_token = ""
telegram_chat_id = ""

# Email
smtp_host = "smtp.gmail.com"
smtp_port = 587
smtp_user = ""
smtp_password = ""
email_to = ""

# ============================================
# LOGGING
# ============================================

[xtools.logging]
# Log level: DEBUG, INFO, WARNING, ERROR
level = "INFO"

# Log file (leave empty for console only)
file = "~/.local/share/xtools/xtools.log"

# Log format
format = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Rotate logs
max_size_mb = 10
backup_count = 5

# ============================================
# SAFETY SETTINGS
# ============================================

[xtools.safety]
# Dry run mode (no actual actions)
dry_run = false

# Confirm destructive operations
confirm_unfollow = false
confirm_mass_operations = true

# Daily limits (0 = unlimited)
max_follows_per_day = 100
max_unfollows_per_day = 200
max_likes_per_day = 500
max_tweets_per_day = 50

# Whitelist (never unfollow these)
whitelist_file = "whitelist.txt"
```

## YAML Format

If you prefer YAML, create `xtools.yaml`:

```yaml
xtools:
  headless: true
  timeout: 30000
  session_file: ~/.config/xtools/session.json

  rate_limit:
    requests_per_minute: 20
    follows_per_hour: 30

  proxy:
    enabled: false
    url: http://user:pass@proxy:8080

  ai:
    default_provider: openai
    openai:
      model: gpt-4-turbo
      temperature: 0.7

  notifications:
    enabled: true
    discord_webhook: ${DISCORD_WEBHOOK}
```

## Environment-Specific Config

### Development

```toml
# xtools.dev.toml
[xtools]
headless = false  # See the browser
slow_mo = 500     # Slow for debugging
rate_limit.requests_per_minute = 5  # Conservative

[xtools.logging]
level = "DEBUG"

[xtools.safety]
dry_run = true    # Don't actually perform actions
```

### Production

```toml
# xtools.prod.toml
[xtools]
headless = true
slow_mo = 50

[xtools.rate_limit]
requests_per_minute = 30

[xtools.logging]
level = "INFO"
file = "/var/log/xtools/xtools.log"

[xtools.notifications]
enabled = true
notify_on_error = true
```

### Load Environment Config

```python
import os
from xtools import XTools

# Load based on environment
env = os.getenv("XTOOLS_ENV", "dev")
config_file = f"xtools.{env}.toml"

async with XTools(config_file=config_file) as x:
    pass
```

## Programmatic Configuration

### Using Config Class

```python
from xtools import XTools
from xtools.core.config import Config

# Create config programmatically
config = Config(
    headless=True,
    rate_limit=Config.RateLimit(
        requests_per_minute=25,
        follows_per_hour=40
    ),
    proxy=Config.Proxy(
        enabled=True,
        url="http://proxy:8080"
    )
)

async with XTools(config=config) as x:
    pass
```

### Runtime Configuration

```python
async with XTools() as x:
    # Change settings at runtime
    x.config.rate_limit.requests_per_minute = 10
    x.config.headless = False
    
    # Reload config from file
    x.config.reload()
    
    # Get current config
    print(x.config.to_dict())
```

## Profile System

Manage multiple configurations:

```python
from xtools import XTools

# Development profile
async with XTools(profile="dev") as x:
    pass  # Uses xtools.dev.toml + session_dev.json

# Production profile
async with XTools(profile="prod") as x:
    pass  # Uses xtools.prod.toml + session_prod.json

# Custom profile
async with XTools(profile="client_abc") as x:
    pass  # Uses xtools.client_abc.toml
```

## Configuration Validation

XTools validates your configuration on startup:

```python
from xtools.core.config import Config, validate_config

# Validate config file
errors = validate_config("xtools.toml")
if errors:
    for error in errors:
        print(f"Config error: {error}")
else:
    print("✓ Configuration valid")
```

## Secrets Management

### Using Environment Variables

```toml
# xtools.toml - Reference env vars
[xtools.notifications]
discord_webhook = "${DISCORD_WEBHOOK}"
telegram_bot_token = "${TELEGRAM_TOKEN}"

[xtools.ai.openai]
api_key = "${OPENAI_API_KEY}"
```

### Using .env Files

```bash
# .env file
XTOOLS_SESSION_FILE=/secure/path/session.json
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
OPENAI_API_KEY=sk-...
```

```python
from dotenv import load_dotenv
from xtools import XTools

load_dotenv()  # Load .env file

async with XTools() as x:
    pass  # Uses env vars automatically
```

### Using Secret Managers

```python
import boto3
from xtools import XTools

# AWS Secrets Manager example
def get_secret(name):
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=name)
    return response['SecretString']

async with XTools(
    session_file=get_secret("xtools/session"),
    proxy_url=get_secret("xtools/proxy")
) as x:
    pass
```

## Configuration Reference

### All Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `headless` | bool | `True` | Run browser invisibly |
| `timeout` | int | `30000` | Page timeout (ms) |
| `slow_mo` | int | `0` | Slow down operations (ms) |
| `session_file` | str | Auto | Path to session file |
| `config_file` | str | Auto | Path to config file |
| `profile` | str | None | Named profile to use |

### Rate Limit Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requests_per_minute` | int | `20` | Global rate limit |
| `follows_per_hour` | int | `30` | Max follows per hour |
| `unfollows_per_hour` | int | `50` | Max unfollows per hour |
| `likes_per_hour` | int | `100` | Max likes per hour |
| `cooldown_duration` | int | `300` | Cooldown seconds |

### Proxy Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | bool | `False` | Enable proxy |
| `url` | str | None | Proxy URL |
| `rotate` | bool | `False` | Rotate proxies |
| `proxy_file` | str | None | File with proxy list |

## Best Practices

1. **Use environment variables for secrets** - Never commit API keys or tokens
2. **Use profiles for different environments** - dev, staging, prod
3. **Start with conservative rate limits** - Increase gradually
4. **Enable dry_run when testing** - Avoid accidental actions
5. **Set up notifications** - Know when things go wrong
6. **Use a whitelist** - Protect important follows from unfollowing

---

Next: [Build Your First Script](first-script.md) →
