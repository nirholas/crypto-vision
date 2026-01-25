# Documentation: Installation Guide

> Complete installation guide for XTools on all platforms.

---

## Table of Contents

- [Requirements](#requirements)
- [Quick Install](#quick-install)
- [Platform-Specific Instructions](#platform-specific-instructions)
- [Development Installation](#development-installation)
- [Docker Installation](#docker-installation)
- [Troubleshooting](#troubleshooting)

---

## Requirements

### System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Python | 3.10 | 3.11+ |
| RAM | 2 GB | 4 GB+ |
| Disk Space | 500 MB | 1 GB |
| Browser | Chromium | Chromium |

### Dependencies

Core dependencies are automatically installed:

- `playwright` - Browser automation
- `aiohttp` - Async HTTP client
- `pydantic` - Data validation
- `rich` - CLI interface
- `typer` - CLI framework

Optional dependencies:

- `openai` - OpenAI GPT integration
- `anthropic` - Claude integration
- `ollama` - Local LLM support

---

## Quick Install

### From PyPI (Recommended)

```bash
# Install XTools
pip install xtools

# Install browser (required)
playwright install chromium

# Verify installation
xtools --version
```

### From Source

```bash
# Clone repository
git clone https://github.com/nirholas/Get-Tweet-Replies-With-Python-Tweepy.git
cd Get-Tweet-Replies-With-Python-Tweepy

# Install
pip install .

# Install browser
playwright install chromium
```

---

## Platform-Specific Instructions

### macOS

```bash
# Ensure Python 3.10+ is installed
python3 --version

# If not, install via Homebrew
brew install python@3.11

# Install XTools
pip3 install xtools

# Install browser
playwright install chromium

# Verify
xtools --version
```

### Windows

```powershell
# Ensure Python 3.10+ is installed
python --version

# If not, download from python.org or use winget
winget install Python.Python.3.11

# Install XTools
pip install xtools

# Install browser
playwright install chromium

# Verify
xtools --version
```

### Linux (Ubuntu/Debian)

```bash
# Install Python 3.10+ if needed
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip

# Install XTools
pip3 install xtools

# Install browser and dependencies
playwright install chromium
playwright install-deps chromium

# Verify
xtools --version
```

### Linux (Fedora/RHEL)

```bash
# Install Python
sudo dnf install python3.11 python3-pip

# Install XTools
pip3 install xtools

# Install browser
playwright install chromium

# Verify
xtools --version
```

### Linux (Arch)

```bash
# Install Python
sudo pacman -S python python-pip

# Install XTools
pip install xtools

# Install browser
playwright install chromium

# Verify
xtools --version
```

---

## Development Installation

For contributing or modifying XTools:

```bash
# Clone repository
git clone https://github.com/nirholas/Get-Tweet-Replies-With-Python-Tweepy.git
cd Get-Tweet-Replies-With-Python-Tweepy

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install in development mode with all dependencies
pip install -e ".[dev,ai]"

# Install browser
playwright install chromium

# Install pre-commit hooks
pre-commit install

# Run tests
pytest

# Verify
xtools --version
```

### Dev Dependencies

The `[dev]` extra includes:

- `pytest` - Testing framework
- `pytest-asyncio` - Async test support
- `pytest-cov` - Coverage reporting
- `black` - Code formatter
- `ruff` - Linter
- `pre-commit` - Git hooks
- `mypy` - Type checking

---

## Docker Installation

### Using Pre-built Image

```bash
# Pull image (when available)
docker pull nirholas/xtools:latest

# Run with session volume
docker run -it -v ~/.xtools:/root/.xtools nirholas/xtools
```

### Building Locally

```dockerfile
# Dockerfile
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# Install XTools
COPY . .
RUN pip install .

# Install browser
RUN playwright install chromium

ENTRYPOINT ["xtools"]
```

```bash
# Build
docker build -t xtools .

# Run
docker run -it -v ~/.xtools:/root/.xtools xtools --help
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  xtools:
    build: .
    volumes:
      - ~/.xtools:/root/.xtools
      - ./data:/app/data
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
```

---

## Virtual Environment Setup

### Using venv (Recommended)

```bash
# Create environment
python -m venv xtools-env

# Activate
# macOS/Linux:
source xtools-env/bin/activate
# Windows:
xtools-env\Scripts\activate

# Install
pip install xtools
playwright install chromium

# Deactivate when done
deactivate
```

### Using conda

```bash
# Create environment
conda create -n xtools python=3.11

# Activate
conda activate xtools

# Install
pip install xtools
playwright install chromium

# Deactivate
conda deactivate
```

### Using pipx (for CLI only)

```bash
# Install pipx if needed
pip install pipx

# Install XTools
pipx install xtools

# Inject playwright
pipx inject xtools playwright
playwright install chromium
```

---

## AI Features Installation

### OpenAI Integration

```bash
# Install with OpenAI support
pip install "xtools[ai]"

# Or install openai separately
pip install openai

# Set API key
export OPENAI_API_KEY="sk-..."
```

### Anthropic Integration

```bash
# Install with AI support
pip install "xtools[ai]"

# Or install anthropic separately
pip install anthropic

# Set API key
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Local LLMs (Ollama)

```bash
# Install Ollama
curl https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama2

# XTools will auto-detect local Ollama
```

---

## Troubleshooting

### Browser Installation Failed

```bash
# Try with dependencies
playwright install-deps chromium
playwright install chromium

# Or use system chromium
pip install xtools[chromium]
```

### Permission Denied

```bash
# Use user installation
pip install --user xtools

# Or fix permissions
sudo chown -R $USER ~/.cache/ms-playwright
```

### SSL Certificate Errors

```bash
# Update certificates
pip install --upgrade certifi

# Or skip SSL verification (not recommended)
export PYTHONHTTPSVERIFY=0
```

### Module Not Found

```bash
# Ensure correct Python
which python
python --version

# Reinstall
pip uninstall xtools
pip install xtools
```

### Playwright Errors

```bash
# Update Playwright
pip install --upgrade playwright
playwright install chromium

# Check browser exists
ls ~/.cache/ms-playwright/
```

### Rate Limit Errors

XTools includes rate limiting. If you see rate limit errors:

1. Wait and retry
2. Check your configuration
3. Reduce operation frequency

---

## Verify Installation

```bash
# Check version
xtools --version

# Run test command
xtools --help

# Test Python import
python -c "from xtools import XTools; print('OK')"
```

---

## Uninstallation

```bash
# Remove package
pip uninstall xtools

# Remove browser (optional)
playwright uninstall chromium

# Remove configuration (optional)
rm -rf ~/.xtools
```

---

## Next Steps

After installation:

1. [Quick Start Guide](QUICKSTART.md) - Get started in 5 minutes
2. [CLI Reference](CLI_REFERENCE.md) - Learn CLI commands
3. [Examples](EXAMPLES.md) - See code examples
4. [AI Features](AI_FEATURES.md) - Set up AI integration
