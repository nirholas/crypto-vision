# Stealth Mode

Avoid detection with Xeepy' comprehensive stealth features. These techniques help your automation blend in with normal browser traffic.

## Why Stealth Matters

Twitter employs various detection methods:
- Browser fingerprinting
- Behavioral analysis
- Request pattern detection
- JavaScript execution analysis
- WebDriver detection

Xeepy addresses all of these through its stealth mode.

## Basic Stealth Setup

```python
from xeepy import Xeepy

# Enable stealth mode
async with Xeepy(stealth=True) as x:
    await x.scrape.profile("username")
```

## Browser Fingerprinting

### Realistic Browser Profiles

```python
from xeepy import Xeepy
from xeepy.core.stealth import BrowserProfile

# Use a realistic browser profile
profile = BrowserProfile.chrome_windows()

async with Xeepy(browser_profile=profile) as x:
    pass

# Available profiles
profiles = [
    BrowserProfile.chrome_windows(),
    BrowserProfile.chrome_mac(),
    BrowserProfile.chrome_linux(),
    BrowserProfile.firefox_windows(),
    BrowserProfile.firefox_mac(),
    BrowserProfile.safari_mac(),
    BrowserProfile.edge_windows(),
]
```

### Custom Fingerprint

```python
from xeepy.core.stealth import Fingerprint

fingerprint = Fingerprint(
    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
    platform="Win32",
    vendor="Google Inc.",
    renderer="ANGLE (NVIDIA GeForce GTX 1080 Ti)",
    screen_resolution=(1920, 1080),
    color_depth=24,
    timezone="America/New_York",
    language="en-US",
    languages=["en-US", "en"],
    hardware_concurrency=8,
    device_memory=8,
    max_touch_points=0,
)

async with Xeepy(fingerprint=fingerprint) as x:
    pass
```

### Fingerprint Rotation

```python
from xeepy.core.stealth import FingerprintRotator

# Rotate fingerprints to avoid tracking
rotator = FingerprintRotator(
    rotate_on="session",  # New fingerprint each session
    # or "daily", "weekly", "never"
)

async with Xeepy(fingerprint_rotator=rotator) as x:
    pass
```

## WebDriver Detection Bypass

Xeepy automatically patches Playwright to avoid detection:

```python
from xeepy import Xeepy

async with Xeepy(stealth=True) as x:
    # These are automatically handled:
    # - navigator.webdriver = undefined
    # - chrome.runtime present
    # - Permissions API patched
    # - Plugin array populated
    # - Language consistency
    # - WebGL vendor patched
    pass
```

### Manual Stealth Patches

```python
from xeepy.core.stealth import StealthPatches

# Apply specific patches
patches = StealthPatches(
    hide_webdriver=True,
    mock_chrome_runtime=True,
    mock_permissions=True,
    mock_plugins=True,
    consistent_languages=True,
    mask_webgl=True,
    mask_audio_context=True,
    mask_canvas=True,
)

async with Xeepy(stealth_patches=patches) as x:
    pass
```

## Behavioral Stealth

### Human-Like Mouse Movement

```python
from xeepy.core.stealth import HumanMouse

# Configure human-like mouse behavior
mouse = HumanMouse(
    speed_variation=(0.5, 1.5),  # Speed multiplier range
    curve_intensity=0.3,         # Movement curvature
    overshoot_probability=0.1,   # Chance of overshooting target
    micro_movements=True,        # Small jitters while idle
)

async with Xeepy(human_mouse=mouse) as x:
    # Mouse movements now look human
    await x.follow.user("username")
```

### Human-Like Typing

```python
from xeepy.core.stealth import HumanTyping

typing = HumanTyping(
    base_delay=(50, 150),        # ms between keystrokes
    mistake_probability=0.02,    # Occasional typos (auto-corrected)
    pause_probability=0.1,       # Pauses while typing
    pause_duration=(500, 2000),  # Pause length
)

async with Xeepy(human_typing=typing) as x:
    await x.engage.comment(
        "https://x.com/user/status/123",
        "Great post!"  # Typed with human-like timing
    )
```

### Random Scrolling

```python
from xeepy.core.stealth import HumanScrolling

scrolling = HumanScrolling(
    speed_variation=(0.7, 1.3),
    pause_while_reading=True,
    reading_time=(2, 10),        # Seconds spent "reading"
    scroll_back_probability=0.1, # Sometimes scroll up
)

async with Xeepy(human_scrolling=scrolling) as x:
    # Scrolling looks natural
    await x.scrape.followers("username", limit=1000)
```

## Request Pattern Stealth

### Realistic Request Timing

```python
from xeepy.core.stealth import RequestTiming

timing = RequestTiming(
    # Add realistic delays
    min_page_time=2.0,           # Minimum time on page
    max_page_time=30.0,          # Maximum time on page
    
    # Simulate loading time consideration
    wait_for_images=True,
    image_view_time=(0.5, 2.0),
    
    # Random navigation patterns
    back_probability=0.05,       # Sometimes go back
    refresh_probability=0.02,    # Sometimes refresh
)

async with Xeepy(request_timing=timing) as x:
    pass
```

### Session Behavior

```python
from xeepy.core.stealth import SessionBehavior

behavior = SessionBehavior(
    # Session length
    min_session=300,             # At least 5 minutes
    max_session=3600,            # At most 1 hour
    
    # Activity patterns
    activity_bursts=True,        # Periods of high activity
    burst_duration=(60, 300),
    rest_duration=(300, 900),
    
    # Realistic breaks
    take_breaks=True,
    break_probability=0.1,
    break_duration=(60, 300),
)

async with Xeepy(session_behavior=behavior) as x:
    pass
```

## Canvas Fingerprint Protection

```python
from xeepy.core.stealth import CanvasProtection

canvas = CanvasProtection(
    noise_level=0.01,            # Slight noise to canvas reads
    consistent=True,             # Same noise per session
)

async with Xeepy(canvas_protection=canvas) as x:
    pass
```

## WebGL Fingerprint Protection

```python
from xeepy.core.stealth import WebGLProtection

webgl = WebGLProtection(
    mask_vendor=True,
    mask_renderer=True,
    vendor="Google Inc.",
    renderer="ANGLE (Intel HD Graphics 630)",
)

async with Xeepy(webgl_protection=webgl) as x:
    pass
```

## Audio Fingerprint Protection

```python
from xeepy.core.stealth import AudioProtection

audio = AudioProtection(
    noise_level=0.0001,          # Imperceptible noise
    consistent=True,
)

async with Xeepy(audio_protection=audio) as x:
    pass
```

## Complete Stealth Configuration

```python
from xeepy import Xeepy
from xeepy.core.stealth import StealthConfig

config = StealthConfig(
    # Browser fingerprint
    browser_profile="chrome_windows",
    fingerprint_rotation="session",
    
    # WebDriver patches
    hide_webdriver=True,
    mock_chrome=True,
    
    # Behavioral
    human_mouse=True,
    human_typing=True,
    human_scrolling=True,
    
    # Request patterns
    realistic_timing=True,
    session_behavior=True,
    
    # Fingerprint protection
    canvas_noise=0.01,
    webgl_mask=True,
    audio_noise=0.0001,
    
    # Advanced
    timezone_spoof="auto",       # Match proxy location
    language_consistency=True,
    font_fingerprint_protection=True,
)

async with Xeepy(stealth_config=config) as x:
    # Maximum stealth
    pass
```

## Stealth Presets

```python
from xeepy import Xeepy
from xeepy.core.stealth import StealthPreset

# Minimal stealth (fast, less protection)
async with Xeepy(stealth_preset=StealthPreset.MINIMAL) as x:
    pass

# Standard stealth (balanced)
async with Xeepy(stealth_preset=StealthPreset.STANDARD) as x:
    pass

# Maximum stealth (slow, maximum protection)
async with Xeepy(stealth_preset=StealthPreset.MAXIMUM) as x:
    pass

# Paranoid mode (extreme protection, very slow)
async with Xeepy(stealth_preset=StealthPreset.PARANOID) as x:
    pass
```

## Testing Your Stealth

### Browser Fingerprint Test

```python
from xeepy import Xeepy
from xeepy.core.stealth import run_fingerprint_test

async with Xeepy(stealth=True) as x:
    results = await run_fingerprint_test(x)
    
    print(f"WebDriver detected: {results.webdriver_detected}")
    print(f"Automation detected: {results.automation_detected}")
    print(f"Fingerprint unique: {results.fingerprint_unique}")
    print(f"Score: {results.stealth_score}/100")
```

### Detection Sites

```python
# Test against known detection sites
async with Xeepy(stealth=True) as x:
    await x.test_stealth([
        "https://bot.sannysoft.com/",
        "https://pixelscan.net/",
        "https://browserleaks.com/",
    ])
```

## Stealth Best Practices

### 1. Warm Up Browser

```python
async with Xeepy(stealth=True) as x:
    # Visit non-sensitive pages first
    await x.visit("https://google.com")
    await asyncio.sleep(random.uniform(5, 15))
    
    await x.visit("https://twitter.com")
    await asyncio.sleep(random.uniform(10, 30))
    
    # Now start automation
    await x.scrape.profile("username")
```

### 2. Maintain Consistent Identity

```python
# Use same fingerprint for same account
account_fingerprint = Fingerprint.generate(seed="account_123")

async with Xeepy(fingerprint=account_fingerprint) as x:
    pass
```

### 3. Match Fingerprint to Proxy Location

```python
# US proxy should have US fingerprint
us_fingerprint = Fingerprint(
    timezone="America/New_York",
    language="en-US",
    # ... other US-specific settings
)

async with Xeepy(
    proxy="http://us-proxy.com:8080",
    fingerprint=us_fingerprint
) as x:
    pass
```

### 4. Avoid Suspicious Patterns

```python
# ❌ Bad - suspiciously consistent
for i in range(100):
    await x.like(tweet_urls[i])
    await asyncio.sleep(5)  # Always 5 seconds

# ✅ Good - natural variation
for i in range(100):
    await x.like(tweet_urls[i])
    await asyncio.sleep(random.uniform(3, 15))
    
    # Occasional longer pauses
    if random.random() < 0.1:
        await asyncio.sleep(random.uniform(30, 120))
```

## Troubleshooting

### Still getting detected?

1. Enable maximum stealth preset
2. Add longer delays between actions
3. Use residential proxies
4. Reduce concurrent operations
5. Add more human-like behavior

### Performance issues with stealth?

1. Disable unnecessary protections
2. Use STANDARD instead of MAXIMUM preset
3. Reduce human behavior delays
4. Cache fingerprints instead of generating

### Fingerprint uniqueness issues?

1. Use consistent fingerprints per account
2. Avoid too-common fingerprints
3. Rotate fingerprints less frequently

## Next Steps

- [Proxies](proxies.md) - IP rotation and management
- [Rate Limiting](rate-limiting.md) - Request pacing
- [Distributed](distributed.md) - Multi-machine setups
