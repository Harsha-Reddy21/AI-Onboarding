"""
Configuration settings
"""
import os
from pathlib import Path

# Base directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Database
DB_PATH = BASE_DIR / "seniorben.db"

# Public directories
PUBLIC_DIR = BASE_DIR / "public"
VIDEOS_DIR = PUBLIC_DIR / "videos"
DIAGRAMS_DIR = PUBLIC_DIR / "diagrams"

# Ensure directories exist
PUBLIC_DIR.mkdir(exist_ok=True)
VIDEOS_DIR.mkdir(exist_ok=True)
DIAGRAMS_DIR.mkdir(exist_ok=True)

# API Keys
GOOGLE_GENERATIVE_AI_API_KEY = os.getenv("GOOGLE_GENERATIVE_AI_API_KEY", "")

# Model configuration
GEMINI_MODEL = "gemini-3-pro-preview"
GEMINI_IMAGE_MODEL = "gemini-3-pro-image-preview"
GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts"

# Timeouts (in seconds)
MAX_DURATION = 1800  # 30 minutes

# Session settings
SESSION_EXPIRY_MS = 15 * 60 * 1000  # 15 minutes
CLEANUP_INTERVAL_MS = 2 * 60 * 1000  # 2 minutes

