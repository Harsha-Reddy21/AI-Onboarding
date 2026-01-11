"""
Senior Ben - FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv

from app.routers import ingest, docs, chat, videos

load_dotenv()

app = FastAPI(
    title="Senior Ben API",
    description="AI-powered onboarding and documentation tool",
    version="0.1.0"
)

# CORS middleware - allow frontend to call backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Next.js default ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(ingest.router, prefix="/api/ingest", tags=["ingest"])
app.include_router(docs.router, prefix="/api/docs", tags=["docs"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(videos.router, prefix="/api/videos", tags=["videos"])

# Serve static files (videos, diagrams)
if os.path.exists("public"):
    app.mount("/public", StaticFiles(directory="public"), name="public")

@app.get("/")
async def root():
    return {"message": "Senior Ben API", "version": "0.1.0"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

