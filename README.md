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
4. Create a **private** Supabase Storage bucket named `captions-media` (or set `SUPABASE_STORAGE_BUCKET` to your bucket name).
5. In Supabase Storage, create a **private** `captions-media` bucket and set its maximum file size to at least the `MAX_UPLOAD_MB` value (500 MB by default). The project also needs to allow uploads of that size in its Storage settings.\n6. Start Redis with `docker compose up -d redis`.
7. Generate Prisma Client and sync the schema: `npm run db:generate`, then `npm run db:push`.
8. Start the app with `npm run dev`.

Frontend: http://localhost:5173  
API: http://localhost:3000/api  
Health check: http://localhost:3000/api/health

## Video storage
Original videos and extracted audio are stored in the private Supabase Storage bucket. The backend uses a server-only service key; never put it in a `VITE_*` variable or commit it. The API validates media keys before streaming objects. Project metadata and caption data live in Supabase PostgreSQL. Temporary files are only used while processing.

## Scripts
- `npm run dev` — frontend and API
- `npm run dev:web` — frontend only
- `npm run dev:api` — API only
- `npm run db:generate` — generate Prisma Client
- `npm run db:push` — sync Prisma schema to the configured database
- `npm run build` — generate Prisma Client and build frontend and API
- `npm run test --workspace @captions-ai/api` — API unit tests

## Important MVP limitations
- Authentication and project ownership are not implemented. Do not expose this deployment publicly until access control is added.
- Export and processing require FFmpeg/ffprobe, Redis, Supabase Storage credentials, and an OpenAI API key.
