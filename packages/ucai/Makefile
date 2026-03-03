.PHONY: setup install dev test lint format type-check coverage clean docs serve-docs help

# Default target
help:
	@echo "UCAI Development Commands"
	@echo "================================"
	@echo ""
	@echo "Setup:"
	@echo "  make setup       - Create virtual environment and install all dependencies"
	@echo "  make install     - Install package in development mode"
	@echo "  make dev         - Install with development dependencies"
	@echo ""
	@echo "Testing:"
	@echo "  make test        - Run all tests"
	@echo "  make test-unit   - Run unit tests only"
	@echo "  make test-int    - Run integration tests only"
	@echo "  make coverage    - Run tests with coverage report"
	@echo ""
	@echo "Code Quality:"
	@echo "  make lint        - Run linter (ruff)"
	@echo "  make format      - Format code (ruff format)"
	@echo "  make type-check  - Run type checker (mypy)"
	@echo "  make check       - Run all checks (lint + type-check + test)"
	@echo ""
	@echo "Documentation:"
	@echo "  make docs        - Build documentation"
	@echo "  make serve-docs  - Serve documentation locally"
	@echo ""
	@echo "Other:"
	@echo "  make clean       - Remove build artifacts"
	@echo "  make build       - Build package"
	@echo "  make publish     - Publish to PyPI (requires credentials)"

# Python and pip
PYTHON := python3
PIP := $(PYTHON) -m pip
PYTEST := $(PYTHON) -m pytest

# Directories
SRC_DIR := src/abi_to_mcp
TEST_DIR := tests
DOCS_DIR := docs

# Setup virtual environment and install dependencies
setup:
	@echo "Creating virtual environment..."
	$(PYTHON) -m venv .venv
	@echo "Activating and installing dependencies..."
	. .venv/bin/activate && $(PIP) install --upgrade pip
	. .venv/bin/activate && $(PIP) install -e ".[dev,docs]"
	@echo ""
	@echo "Setup complete! Activate with: source .venv/bin/activate"

# Install in development mode
install:
	$(PIP) install -e .

# Install with dev dependencies
dev:
	$(PIP) install -e ".[dev]"

# Run all tests
test:
	$(PYTEST) $(TEST_DIR) -v

# Run unit tests only
test-unit:
	$(PYTEST) $(TEST_DIR)/unit -v

# Run integration tests only
test-int:
	$(PYTEST) $(TEST_DIR)/integration -v

# Run specific test file
test-file:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make test-file FILE=tests/unit/test_parser/test_abi_parser.py"; \
	else \
		$(PYTEST) $(FILE) -v; \
	fi

# Run tests with coverage
coverage:
	$(PYTEST) $(TEST_DIR) --cov=$(SRC_DIR) --cov-report=html --cov-report=term-missing
	@echo ""
	@echo "Coverage report: htmlcov/index.html"

# Run linter
lint:
	$(PYTHON) -m ruff check $(SRC_DIR) $(TEST_DIR)

# Fix linting issues automatically
lint-fix:
	$(PYTHON) -m ruff check --fix $(SRC_DIR) $(TEST_DIR)

# Format code
format:
	$(PYTHON) -m ruff format $(SRC_DIR) $(TEST_DIR)

# Check formatting without changing
format-check:
	$(PYTHON) -m ruff format --check $(SRC_DIR) $(TEST_DIR)

# Run type checker
type-check:
	$(PYTHON) -m mypy $(SRC_DIR)

# Run all checks
check: lint type-check test
	@echo ""
	@echo "All checks passed!"

# Build documentation
docs:
	cd $(DOCS_DIR) && mkdocs build

# Serve documentation locally
serve-docs:
	cd $(DOCS_DIR) && mkdocs serve

# Clean build artifacts
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
	rm -rf .pytest_cache/
	rm -rf .mypy_cache/
	rm -rf .ruff_cache/
	rm -rf htmlcov/
	rm -rf .coverage
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete

# Build package
build: clean
	$(PYTHON) -m build

# Publish to PyPI
publish: build
	$(PYTHON) -m twine upload dist/*

# Run pre-commit hooks
pre-commit:
	pre-commit run --all-files

# Install pre-commit hooks
pre-commit-install:
	pre-commit install

# Generate a test MCP server (for development)
test-generate:
	$(PYTHON) -m abi_to_mcp generate tests/fixtures/abis/erc20.json \
		-o /tmp/test-erc20-mcp \
		-a 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \
		-n mainnet
	@echo ""
	@echo "Generated server at: /tmp/test-erc20-mcp"
	@ls -la /tmp/test-erc20-mcp/
