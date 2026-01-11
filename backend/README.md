# Senior Ben - FastAPI Backend

FastAPI backend for Senior Ben AI onboarding tool.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Add your `GOOGLE_GENERATIVE_AI_API_KEY` to `.env`

4. Run the server:
```bash
python main.py
```

Or with uvicorn:
```bash
uvicorn main:app --reload --port 8000
```

## API Endpoints

- `GET /` - Health check
- `GET /health` - Health status
- `POST /api/ingest` - Ingest a GitHub repository
- `GET /api/ingest` - Get all projects
- `GET /api/ingest/{project_id}` - Get a project
- `POST /api/docs` - Generate documentation
- `GET /api/docs` - Get documents
- `POST /api/chat` - Chat with codebase (SSE stream)
- `POST /api/videos/stream` - Generate video (SSE stream)
- `GET /api/videos` - Get videos

## Development Status

⚠️ **Note**: The AI agents module is currently a placeholder. The TypeScript agents need to be either:
1. Ported to Python using `google-generativeai` directly
2. Wrapped as a Node.js subprocess
3. Replaced with a Python AI SDK equivalent

The database, routing, and core infrastructure are functional.

