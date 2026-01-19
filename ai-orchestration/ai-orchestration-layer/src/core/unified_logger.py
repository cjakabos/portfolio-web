# backend/ai-orchestration-layer/src/core/unified_logger.py

"""
Unified Logger - Eliminates redundant logging
Provides consistent logging across all components with proper type hints
"""

import json
import logging
import sys
from datetime import datetime
from typing import Dict, Any, Optional, Union, List
from enum import Enum
from pathlib import Path
from logging.handlers import RotatingFileHandler

from core.config import get_config


class LogLevel(Enum):
    """Log levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class LogContext:
    """
    Log context manager
    Provides thread-local context for logging
    """
    
    _context: Dict[str, Any] = {}
    
    @classmethod
    def set(cls, key: str, value: Any) -> None:
        """Set context value"""
        cls._context[key] = value
    
    @classmethod
    def get(cls, key: str, default: Any = None) -> Any:
        """Get context value"""
        return cls._context.get(key, default)
    
    @classmethod
    def update(cls, context: Dict[str, Any]) -> None:
        """Update context with multiple values"""
        cls._context.update(context)
    
    @classmethod
    def clear(cls) -> None:
        """Clear all context"""
        cls._context.clear()
    
    @classmethod
    def get_all(cls) -> Dict[str, Any]:
        """Get all context"""
        return cls._context.copy()


class StructuredLogger:
    """
    Structured Logger - Unified logging system
    Provides JSON-formatted logging with context support
    """
    
    _instance: Optional['StructuredLogger'] = None
    _logger: Optional[logging.Logger] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        config = get_config()
        self._setup_logger(config.logging)
        self._initialized = True
    
    def _setup_logger(self, log_config) -> None:
        """Setup logger with handlers"""
        self._logger = logging.getLogger("orchestration")
        self._logger.setLevel(getattr(logging, log_config.level))
        
        # Remove existing handlers
        self._logger.handlers.clear()
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(getattr(logging, log_config.level))
        
        if log_config.format == "json":
            console_handler.setFormatter(JsonFormatter())
        else:
            console_handler.setFormatter(
                logging.Formatter(
                    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
                )
            )
        
        self._logger.addHandler(console_handler)
        
        # File handler (if enabled)
        if log_config.enable_file_logging:
            log_path = Path(log_config.log_file)
            log_path.parent.mkdir(parents=True, exist_ok=True)
            
            file_handler = RotatingFileHandler(
                log_config.log_file,
                maxBytes=log_config.max_file_size,
                backupCount=log_config.backup_count
            )
            file_handler.setLevel(getattr(logging, log_config.level))
            file_handler.setFormatter(JsonFormatter())
            
            self._logger.addHandler(file_handler)
    
    @classmethod
    def get_instance(cls) -> 'StructuredLogger':
        """Get logger singleton instance"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    def _log(
        self,
        level: LogLevel,
        event: str,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[Exception] = None
    ) -> None:
        """
        Internal logging method
        
        Args:
            level: Log level
            event: Event name/type
            data: Additional data to log
            error: Exception if logging an error
        """
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "event": event,
            "level": level.value,
            **LogContext.get_all()
        }
        
        if data:
            log_entry.update(data)
        
        if error:
            log_entry["error"] = {
                "type": type(error).__name__,
                "message": str(error),
                "traceback": self._get_traceback(error)
            }
        
        log_method = getattr(self._logger, level.value.lower())
        log_method(json.dumps(log_entry))
    
    def _get_traceback(self, error: Exception) -> str:
        """Get formatted traceback"""
        import traceback
        return ''.join(traceback.format_exception(type(error), error, error.__traceback__))
    
    def debug(self, event: str, data: Optional[Dict[str, Any]] = None) -> None:
        """Log debug message"""
        self._log(LogLevel.DEBUG, event, data)
    
    def info(self, event: str, data: Optional[Dict[str, Any]] = None) -> None:
        """Log info message"""
        self._log(LogLevel.INFO, event, data)
    
    def warning(self, event: str, data: Optional[Dict[str, Any]] = None) -> None:
        """Log warning message"""
        self._log(LogLevel.WARNING, event, data)
    
    def error(
        self,
        event: str,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[Exception] = None
    ) -> None:
        """Log error message"""
        self._log(LogLevel.ERROR, event, data, error)
    
    def critical(
        self,
        event: str,
        data: Optional[Dict[str, Any]] = None,
        error: Optional[Exception] = None
    ) -> None:
        """Log critical message"""
        self._log(LogLevel.CRITICAL, event, data, error)
    
    def log_state_transition(
        self,
        from_node: str,
        to_node: str,
        state_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """Log state transition in orchestration"""
        self.info("state_transition", {
            "from_node": from_node,
            "to_node": to_node,
            "state_data": state_data or {}
        })
    
    def log_capability_execution(
        self,
        capability: str,
        duration_ms: float,
        success: bool,
        error: Optional[str] = None
    ) -> None:
        """Log capability execution"""
        self.info("capability_execution", {
            "capability": capability,
            "duration_ms": duration_ms,
            "success": success,
            "error": error
        })
    
    def log_tool_call(
        self,
        tool_name: str,
        args: Dict[str, Any],
        result: Optional[Any] = None,
        error: Optional[str] = None
    ) -> None:
        """Log tool call"""
        self.info("tool_call", {
            "tool": tool_name,
            "args": args,
            "result": str(result)[:200] if result else None,  # Truncate
            "error": error
        })
    
    def log_request(
        self,
        request_id: str,
        user_id: int,
        orchestration_type: str,
        message_length: int
    ) -> None:
        """Log incoming request"""
        self.info("request_received", {
            "request_id": request_id,
            "user_id": user_id,
            "orchestration_type": orchestration_type,
            "message_length": message_length
        })
    
    def log_response(
        self,
        request_id: str,
        duration_ms: float,
        success: bool,
        capabilities_used: List[str]
    ) -> None:
        """Log response"""
        self.info("request_completed", {
            "request_id": request_id,
            "duration_ms": duration_ms,
            "success": success,
            "capabilities_used": capabilities_used
        })


class JsonFormatter(logging.Formatter):
    """JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON"""
        try:
            # Try to parse existing JSON message
            log_data = json.loads(record.getMessage())
        except json.JSONDecodeError:
            # Fallback to plain message
            log_data = {
                "timestamp": datetime.now().isoformat(),
                "level": record.levelname,
                "message": record.getMessage()
            }
        
        return json.dumps(log_data)


class StateLogger:
    """
    State Logger - Logs to UnifiedState logs array
    Provides consistent logging within state objects
    """
    
    def __init__(self, state: Dict[str, Any]):
        self.state = state
        self.structured_logger = StructuredLogger.get_instance()
    
    def log(self, message: str, level: LogLevel = LogLevel.INFO) -> None:
        """
        Log message to both state and structured logger
        
        Args:
            message: Message to log
            level: Log level
        """
        # Add to state logs
        if "logs" not in self.state:
            self.state["logs"] = []
        
        timestamp = datetime.now().isoformat()
        log_entry = f"[{timestamp}] {message}"
        self.state["logs"].append(log_entry)
        
        # Also log to structured logger
        log_method = getattr(self.structured_logger, level.value.lower())
        log_method("state_log", {"message": message})
    
    def info(self, message: str) -> None:
        """Log info message"""
        self.log(message, LogLevel.INFO)
    
    def warning(self, message: str) -> None:
        """Log warning message"""
        self.log(message, LogLevel.WARNING)
    
    def error(self, message: str) -> None:
        """Log error message"""
        self.log(message, LogLevel.ERROR)
    
    def debug(self, message: str) -> None:
        """Log debug message"""
        self.log(message, LogLevel.DEBUG)


# Convenience functions
def get_logger() -> StructuredLogger:
    """Get global structured logger instance"""
    return StructuredLogger.get_instance()


def get_state_logger(state: Dict[str, Any]) -> StateLogger:
    """Get state logger for a specific state"""
    return StateLogger(state)


def set_log_context(**kwargs) -> None:
    """Set log context values"""
    LogContext.update(kwargs)


def clear_log_context() -> None:
    """Clear log context"""
    LogContext.clear()
