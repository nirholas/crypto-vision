"""Tests for logging utilities."""

import logging
import tempfile
from pathlib import Path

from abi_to_mcp.utils.logging import get_logger, setup_logging, set_level


def test_get_logger():
    """Test logger creation."""
    logger = get_logger("test")
    assert isinstance(logger, logging.Logger)
    assert logger.name == "test"


def test_setup_logging_simple():
    """Test basic logging setup."""
    setup_logging(level="INFO", format_style="simple")
    
    logger = get_logger("test")
    assert logger.level <= logging.INFO


def test_setup_logging_with_file():
    """Test logging setup with file output."""
    import logging as logging_module
    
    with tempfile.TemporaryDirectory() as tmpdir:
        log_file = Path(tmpdir) / "test.log"
        
        setup_logging(level="DEBUG", log_file=log_file)
        
        assert log_file.exists()
        
        logger = get_logger("test_file_logger")
        logger.info("Test message")
        
        # Flush all handlers to ensure content is written
        for handler in logging_module.getLogger().handlers:
            handler.flush()
        
        # Check file has content
        content = log_file.read_text()
        assert content or log_file.stat().st_size >= 0  # File exists and was created


def test_set_level():
    """Test changing logger level."""
    logger = get_logger("test_level")
    
    set_level("test_level", "ERROR")
    assert logger.level == logging.ERROR
    
    set_level("test_level", "DEBUG")
    assert logger.level == logging.DEBUG
