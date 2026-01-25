# Installation

Get XTools up and running in under 2 minutes.

## Quick Install

=== "pip (Recommended)"

    ```bash
    pip install xtools
    ```

=== "pipx (Isolated)"

    ```bash
    pipx install xtools
    ```

=== "Poetry"

    ```bash
    poetry add xtools
    ```

=== "From Source"

    ```bash
    git clone https://github.com/xtools/xtools.git
    cd xtools
    pip install -e .
    ```

## Install Browser

XTools uses Playwright for browser automation. Install the browser:

```bash
playwright install chromium
```

!!! info "First-time setup"
    This downloads a Chromium browser (~150MB). It's a one-time operation.

## Verify Installation

```bash
# Check version
xtools --version

# Run diagnostics
xtools doctor
```

Expected output:
```
XTools v1.0.0
✓ Python 3.10+
✓ Playwright installed
✓ Chromium browser ready
✓ All systems operational
```

## Optional Dependencies

Install additional features based on your needs:

=== "AI Features"

    ```bash
    pip install "xtools[ai]"
    ```
    
    Includes: OpenAI, Anthropic, and Ollama integrations

=== "Data Science"

    ```bash
    pip install "xtools[data]"
    ```
    
    Includes: pandas, numpy, matplotlib for analytics

=== "Notifications"

    ```bash
    pip install "xtools[notify]"
    ```
    
    Includes: Discord, Telegram, email integrations

=== "All Features"

    ```bash
    pip install "xtools[all]"
    ```
    
    Includes everything above

## System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| Python | 3.10 or higher |
| RAM | 512MB available |
| Disk | 500MB for browser |
| OS | Linux, macOS, Windows |

### Recommended Setup

| Component | Recommendation |
|-----------|----------------|
| Python | 3.11+ (faster async) |
| RAM | 2GB+ for heavy scraping |
| Disk | SSD for database caching |
| Network | Stable connection |

## Platform-Specific Notes

=== ":material-linux: Linux"

    ```bash
    # Install system dependencies (Ubuntu/Debian)
    sudo apt-get update
    sudo apt-get install -y python3-pip
    
    # Install XTools
    pip3 install xtools
    playwright install chromium
    
    # Install browser dependencies
    playwright install-deps chromium
    ```
    
    !!! tip "Headless servers"
        XTools works perfectly on headless Linux servers.
        Use `headless=True` (default) in your scripts.

=== ":material-apple: macOS"

    ```bash
    # Using Homebrew Python
    brew install python@3.11
    
    # Install XTools
    pip3 install xtools
    playwright install chromium
    ```
    
    !!! note "Apple Silicon"
        XTools fully supports M1/M2/M3 Macs natively.

=== ":material-microsoft-windows: Windows"

    ```powershell
    # Install Python from python.org first
    
    # Install XTools
    pip install xtools
    playwright install chromium
    ```
    
    !!! warning "Windows Defender"
        You may need to allow Playwright through Windows Defender.

=== ":material-docker: Docker"

    ```dockerfile
    FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy
    
    RUN pip install xtools[all]
    
    # Your script
    COPY script.py .
    CMD ["python", "script.py"]
    ```
    
    Or use our pre-built image:
    
    ```bash
    docker pull xtools/xtools:latest
    docker run -it xtools/xtools python your_script.py
    ```

## Virtual Environment Setup

We recommend using a virtual environment:

```bash
# Create virtual environment
python -m venv xtools-env

# Activate it
source xtools-env/bin/activate  # Linux/macOS
# or
xtools-env\Scripts\activate     # Windows

# Install XTools
pip install xtools[all]
playwright install chromium
```

## Development Installation

For contributing or modifying XTools:

```bash
# Clone the repository
git clone https://github.com/xtools/xtools.git
cd xtools

# Create dev environment
python -m venv .venv
source .venv/bin/activate

# Install in editable mode with dev dependencies
pip install -e ".[dev]"

# Install pre-commit hooks
pre-commit install

# Run tests
pytest
```

## Troubleshooting

??? question "Error: playwright not found"
    
    Make sure playwright is installed:
    ```bash
    pip install playwright
    playwright install chromium
    ```

??? question "Error: browser closed unexpectedly"
    
    Install browser dependencies:
    ```bash
    # Linux only
    playwright install-deps chromium
    ```

??? question "Error: Permission denied"
    
    Use `--user` flag or a virtual environment:
    ```bash
    pip install --user xtools
    ```

??? question "Slow installation on Linux"
    
    The browser download can be slow. Use a mirror:
    ```bash
    PLAYWRIGHT_DOWNLOAD_HOST=https://playwright.azureedge.net playwright install chromium
    ```

??? question "Import errors after installation"
    
    Ensure you're using the correct Python:
    ```bash
    which python  # Should show your venv
    python -c "import xtools; print(xtools.__version__)"
    ```

## Upgrading

```bash
# Upgrade XTools
pip install --upgrade xtools

# Upgrade browser (occasionally needed)
playwright install chromium
```

## Uninstalling

```bash
# Remove XTools
pip uninstall xtools

# Remove browser (optional)
rm -rf ~/.cache/ms-playwright
```

---

Next: [Set up authentication](authentication.md) →
