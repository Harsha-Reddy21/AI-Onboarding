# Senior Ben - Frontend

Next.js frontend for Senior Ben AI onboarding tool.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
cp .env.local.example .env.local
```

3. Update `NEXT_PUBLIC_API_URL` to point to your FastAPI backend (default: `http://localhost:8000`)

4. Run the development server:
```bash
npm run dev
```

## Configuration

The frontend communicates with the FastAPI backend via the `lib/api.ts` client. Make sure the backend is running and the `NEXT_PUBLIC_API_URL` environment variable is set correctly.

