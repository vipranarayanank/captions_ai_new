# Captions AI

AI-assisted video caption editor built with React + TypeScript + Vite, NestJS, Prisma/PostgreSQL, Supabase Storage, BullMQ/Redis, FFmpeg, and OpenAI Whisper.

## Requirements
- Node.js 20+
- npm 10+
- Supabase project with PostgreSQL and Storage enabled
- Docker Desktop (for local Redis)
- FFmpeg and ffprobe installed and available on PATH
- OpenAI API key for live transcription

## Setup
1. Run `npm install` at the repository root.
2. Copy `apps/api/.env.example` to `apps/api/.env`.
3. Set `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY`.
4. In Supabase Storage, create a **private** bucket named `captions-media` (or set `SUPABASE_STORAGE_BUCKET` to your bucket name). Set the bucket/project upload limit to at least `MAX_UPLOAD_MB` (50 MB by default).
5. Start Redis with `docker compose up -d redis`.
6. Generate Prisma Client and sync the schema: `npm run db:generate`, then `npm run db:push`.
7. Start the app with `npm run dev`.

Frontend: http://localhost:5173  
API: http://localhost:3000/api  
Health check: http://localhost:3000/api/health

## Video storage
Original videos, extracted audio, and exported MP4s are stored in the private Supabase Storage bucket. The backend uses a server-only key; never put it in a `VITE_*` variable or commit it. Project metadata and caption data live in Supabase PostgreSQL. Temporary files are only used while processing.

## Scripts
- `npm run dev` — frontend and API
- `npm run dev:web` — frontend only
- `npm run dev:api` — API only
- `npm run db:generate` — generate Prisma Client
- `npm run db:push` — sync Prisma schema to the configured database
- `npm run build` — generate Prisma Client and build frontend and API
- `npm run test` — API unit tests
- `npm run lint` — lint TypeScript files
- `npm run format` — format supported source and documentation files

## Processing and export
- The API process runs the BullMQ transcription and export workers locally. Keep Redis running while the API is running.
- Export bundles the Remotion composition once and renders MP4 files in the background. Rendering requires sufficient memory/CPU and a working headless Chromium environment.

## Important MVP limitations
- Authentication and project ownership are not implemented. Do not expose this deployment publicly until access control is added.
- Export and processing require FFmpeg/ffprobe, Redis, Supabase Storage credentials, and an OpenAI API key.
