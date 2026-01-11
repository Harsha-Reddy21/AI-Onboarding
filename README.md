# Senior Ben - AI Onboarding Tool

AI-powered onboarding and documentation tool that analyzes GitHub repositories and generates role-specific documentation.

## 🎉 Migration Complete!

The application has been successfully migrated from Next.js API routes to a **FastAPI backend** with a **Next.js frontend**.

## Project Structure

```
.
├── backend/          # FastAPI backend
│   ├── app/         # Application code
│   │   ├── routers/ # API routes
│   │   ├── db.py    # Database operations
│   │   └── ...
│   └── main.py      # FastAPI app entry point
│
└── frontend/         # Next.js frontend
    ├── app/          # Next.js app directory
    ├── components/   # React components
    └── lib/          # Frontend utilities
```

## Quick Start

### Backend (FastAPI)

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Add your `GOOGLE_GENERATIVE_AI_API_KEY` to `.env`

5. Run the server:
```bash
python main.py
```

The backend will run on `http://localhost:8000`

### Frontend (Next.js)

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Copy files from `seniorben-main/` (see `COPY_SCRIPT.md` for details)

3. Install dependencies:
```bash
npm install
```

4. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

5. Update `NEXT_PUBLIC_API_URL` if needed (default: `http://localhost:8000`)

6. Run the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Features

- **Repository Ingestion**: Clone and analyze GitHub repositories
- **Document Generation**: Create comprehensive documentation using AI
- **Q&A Chat**: Ask questions about codebases with evidence-based answers
- **Video Generation**: Generate video explainers from documentation
- **Multiple Doc Types**: Overview, training, troubleshooting, and custom docs

## API Endpoints

- `GET /health` - Health check
- `POST /api/ingest` - Ingest a GitHub repository
- `GET /api/ingest` - Get all projects
- `GET /api/ingest/{project_id}` - Get a project
- `POST /api/docs` - Generate documentation
- `POST /api/docs/stream` - Generate documentation (SSE stream)
- `GET /api/docs` - Get documents
- `DELETE /api/docs/{doc_id}` - Delete document
- `POST /api/chat` - Chat with codebase (SSE stream)
- `POST /api/videos/stream` - Generate video (SSE stream)
- `GET /api/videos` - Get videos
- `DELETE /api/videos/{video_id}` - Delete video

## Documentation

- `QUICK_START.md` - Quick start guide
- `COPY_SCRIPT.md` - Instructions for copying frontend files
- `MIGRATION_COMPLETE.md` - Migration status and details
- `SETUP_COMPLETE.md` - Setup completion guide
- `MIGRATION_GUIDE.md` - Detailed migration guide

## Technology Stack

### Backend
- FastAPI
- SQLite (better-sqlite3 equivalent)
- Google Generative AI (Gemini)
- GitPython

### Frontend
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- Radix UI

## Development

### Backend Development
```bash
cd backend
python main.py
# Or with auto-reload:
uvicorn main:app --reload --port 8000
```

### Frontend Development
```bash
cd frontend
npm run dev
```

## Environment Variables

### Backend (.env)
```
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
LOG_LEVEL=info
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Status

✅ **Backend**: Complete and functional  
✅ **Frontend Core**: Updated and working  
⚠️ **Frontend Components**: Need to copy from `seniorben-main/`  
⚠️ **AI Agents**: Basic implementation (function calling enhancement needed)

## Next Steps

1. Copy frontend files (see `COPY_SCRIPT.md`)
2. Update component API calls
3. Test complete workflows
4. Enhance AI agents with function calling

## License

See original project license.
