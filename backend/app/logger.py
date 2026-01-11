"""
Logger utility for clean, readable output
"""
import os
from datetime import datetime
from typing import Optional, Any
import json

LOG_LEVEL = os.getenv("LOG_LEVEL", "info")
SHOW_DEBUG = LOG_LEVEL == "debug"

# ANSI color codes
COLORS = {
    "info": "\x1b[36m",    # Cyan
    "warn": "\x1b[33m",    # Yellow
    "error": "\x1b[31m",   # Red
    "debug": "\x1b[90m",   # Gray
    "step": "\x1b[32m",    # Green
    "reset": "\x1b[0m",
    "dim": "\x1b[2m",
    "bold": "\x1b[1m",
}

def format_time() -> str:
    return datetime.now().strftime("%H:%M:%S")

def format_duration(start_time: float) -> str:
    duration = (datetime.now().timestamp() * 1000) - start_time
    if duration < 1000:
        return f"{int(duration)}ms"
    if duration < 60000:
        return f"{duration/1000:.1f}s"
    return f"{duration/60000:.1f}m"

def compact_json(data: Any, max_len: int = 80) -> str:
    if data is None:
        return ""
    if isinstance(data, str):
        return data[:max_len] + "..." if len(data) > max_len else data
    if isinstance(data, (int, float, bool)):
        return str(data)
    try:
        json_str = json.dumps(data)
        return json_str[:max_len] + "..." if len(json_str) > max_len else json_str
    except:
        return str(data)

class Logger:
    def __init__(self, category: str):
        self.category = category
        self.start_times: dict[str, float] = {}

    def _log(self, level: str, message: str, data: Optional[Any] = None):
        if level == "debug" and not SHOW_DEBUG:
            return

        time = format_time()
        cat = self.category.ljust(7)
        color = COLORS.get(level, "")
        reset = COLORS["reset"]
        dim = COLORS["dim"]

        output = f"{dim}{time}{reset} {color}[{cat}]{reset} {message}"

        if data is not None:
            compact = compact_json(data, 60)
            if compact:
                output += f" {dim}{compact}{reset}"

        print(output)

    def info(self, message: str, data: Optional[Any] = None):
        self._log("info", message, data)

    def warn(self, message: str, data: Optional[Any] = None):
        self._log("warn", f"⚠ {message}", data)

    def error(self, message: str, data: Optional[Any] = None):
        self._log("error", f"✗ {message}", data)

    def debug(self, message: str, data: Optional[Any] = None):
        self._log("debug", message, data)

    def step(self, message: str):
        self._log("step", f"→ {message}")

    def start_timer(self, label: str):
        self.start_times[label] = datetime.now().timestamp() * 1000

    def end_timer(self, label: str, result: Optional[str] = None):
        start_time = self.start_times.get(label)
        if start_time:
            duration = format_duration(start_time)
            msg = f"✓ {label} ({duration}) - {result}" if result else f"✓ {label} ({duration})"
            self.step(msg)
            del self.start_times[label]

    def separator(self, title: str):
        line = "─" * 40
        print(f"\n{COLORS['dim']}{line}{COLORS['reset']}")
        print(f"{COLORS['bold']}{title}{COLORS['reset']}")
        print(f"{COLORS['dim']}{line}{COLORS['reset']}")

    def tool(self, name: str, params: Optional[dict] = None):
        param_str = ""
        if params:
            param_str = ", ".join(f"{k}={v}" for k, v in params.items())
        param_str = param_str[:50] + "..." if len(param_str) > 50 else param_str
        print(f"{COLORS['dim']}{format_time()}{COLORS['reset']} {COLORS['step']}[TOOL]{COLORS['reset']}   {name}({COLORS['dim']}{param_str}{COLORS['reset']})")

    def tool_result(self, name: str, summary: str):
        print(f"{COLORS['dim']}{format_time()}{COLORS['reset']} {COLORS['info']}[TOOL]{COLORS['reset']}   {name} → {summary}")

# Factory function
def create_logger(category: str) -> Logger:
    return Logger(category)

# Pre-configured loggers
loggers = {
    "ingest": create_logger("INGEST"),
    "docs": create_logger("DOCS"),
    "chat": create_logger("CHAT"),
    "git": create_logger("GIT"),
    "tools": create_logger("TOOLS"),
    "agents": create_logger("AGENTS"),
    "db": create_logger("DB"),
}

