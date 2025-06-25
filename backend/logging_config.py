"""
Configurable File Logging Utility

This module provides an easy-to-use file logging configuration that can be optionally
enabled via environment variables. It supports both console and file logging simultaneously.
"""

import os
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv


class FileLoggingConfig:
    """
    Configurable file logging setup that can be easily enabled/disabled.
    """
    
    def __init__(self):
        # Load environment variables
        load_dotenv()
        
        # Configuration from environment variables
        self.enable_file_logging = os.getenv('ENABLE_FILE_LOGGING', 'false').lower() == 'true'
        self.log_file_path = os.getenv('LOG_FILE_PATH', 'logs/finance_splitter.log')
        self.log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
        self.max_log_file_size = int(os.getenv('MAX_LOG_FILE_SIZE_MB', '10')) * 1024 * 1024  # Convert MB to bytes
        self.backup_count = int(os.getenv('LOG_BACKUP_COUNT', '5'))
        self.console_logging = os.getenv('ENABLE_CONSOLE_LOGGING', 'true').lower() == 'true'
        
        # Standard log format
        self.log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        self.date_format = '%Y-%m-%d %H:%M:%S'
    
    def setup_logging(self) -> logging.Logger:
        """
        Set up logging configuration with optional file logging.
        
        Returns:
            Configured root logger
        """
        # Get the root logger
        root_logger = logging.getLogger()
        
        # Clear any existing handlers to avoid duplicates
        root_logger.handlers.clear()
        
        # Set log level
        log_level = getattr(logging, self.log_level, logging.INFO)
        root_logger.setLevel(log_level)
        
        # Create formatter
        formatter = logging.Formatter(self.log_format, self.date_format)
        
        # Console logging (if enabled)
        if self.console_logging:
            console_handler = logging.StreamHandler()
            console_handler.setLevel(log_level)
            console_handler.setFormatter(formatter)
            root_logger.addHandler(console_handler)
        
        # File logging (if enabled)
        if self.enable_file_logging:
            self._setup_file_logging(root_logger, formatter, log_level)
        
        return root_logger
    
    def _setup_file_logging(self, logger: logging.Logger, formatter: logging.Formatter, log_level: int) -> None:
        """
        Set up file logging with rotation.
        
        Args:
            logger: Logger instance to add file handler to
            formatter: Log formatter to use
            log_level: Log level to set
        """
        try:
            # Create log directory if it doesn't exist
            log_file = Path(self.log_file_path)
            log_file.parent.mkdir(parents=True, exist_ok=True)
            
            # Create rotating file handler
            file_handler = RotatingFileHandler(
                filename=self.log_file_path,
                maxBytes=self.max_log_file_size,
                backupCount=self.backup_count,
                encoding='utf-8'
            )
            
            file_handler.setLevel(log_level)
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
            
            # Log that file logging is enabled
            logger.info(f"📁 File logging enabled: {self.log_file_path}")
            logger.info(f"📊 Log rotation: {self.max_log_file_size // (1024*1024)}MB max, {self.backup_count} backups")
            
        except Exception as e:
            # If file logging setup fails, log to console (if available)
            if self.console_logging:
                logger.error(f"❌ Failed to set up file logging: {e}")
            else:
                # Fallback to basic console logging if file logging fails and console is disabled
                console_handler = logging.StreamHandler()
                console_handler.setLevel(log_level)
                console_handler.setFormatter(formatter)
                logger.addHandler(console_handler)
                logger.error(f"❌ Failed to set up file logging: {e}")
    
    def get_logger(self, name: str) -> logging.Logger:
        """
        Get a logger with the specified name.
        
        Args:
            name: Name for the logger
            
        Returns:
            Configured logger instance
        """
        return logging.getLogger(name)


# Global instance for easy import
file_logging_config = FileLoggingConfig()


def setup_logging() -> logging.Logger:
    """
    Convenience function to set up logging configuration.
    
    Returns:
        Configured root logger
    """
    return file_logging_config.setup_logging()


def get_logger(name: str) -> logging.Logger:
    """
    Convenience function to get a logger with the specified name.
    
    Args:
        name: Name for the logger
        
    Returns:
        Configured logger instance
    """
    return file_logging_config.get_logger(name)


def log_configuration_info():
    """
    Log current logging configuration for debugging purposes.
    """
    logger = get_logger(__name__)
    logger.info("🔧 Logging Configuration:")
    logger.info(f"   - File logging: {'✅ Enabled' if file_logging_config.enable_file_logging else '❌ Disabled'}")
    logger.info(f"   - Console logging: {'✅ Enabled' if file_logging_config.console_logging else '❌ Disabled'}")
    logger.info(f"   - Log level: {file_logging_config.log_level}")
    
    if file_logging_config.enable_file_logging:
        logger.info(f"   - Log file: {file_logging_config.log_file_path}")
        logger.info(f"   - Max file size: {file_logging_config.max_log_file_size // (1024*1024)}MB")
        logger.info(f"   - Backup count: {file_logging_config.backup_count}")


# Example .env configuration (add these to your .env file):
"""
# File Logging Configuration
ENABLE_FILE_LOGGING=true
LOG_FILE_PATH=logs/finance_splitter.log
LOG_LEVEL=INFO
MAX_LOG_FILE_SIZE_MB=10
LOG_BACKUP_COUNT=5
ENABLE_CONSOLE_LOGGING=true
"""