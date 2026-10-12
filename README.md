# Captions AI

Full-stack starter with React + Vite frontend and NestJS API.

## Structure
- `apps/web`: React + TypeScript + Vite frontend
- `apps/api`: NestJS + TypeScript backend
- `apps/api/prisma`: Prisma schema for Supabase PostgreSQL

## Requirements
- Node.js 20+
- npm 10+
- Supabase project (for PostgreSQL)

## Setup
1. Run `npm install` at the repository root.
2. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL` and `DIRECT_URL` from your Supabase project.
3. Optionally copy `apps/web/.env.example` to `apps/web/.env` to configure `VITE_API_URL`.
4. Run `npm run db:generate`, then `npm run db:push` to sync the current Prisma schema.
5. Run `npm run dev`.

See [`docs/DATABASE.md`](docs/DATABASE.md) for database setup and guidance on keeping a future Firebase/Firestore migration manageable.

Frontend: http://localhost:5173
API: http://localhost:3000/api
Health check: http://localhost:3000/api/health

Never commit real credentials. Keep database access on the backend. The current provider is PostgreSQL via Prisma; Firebase can be introduced behind a data-access interface later. Since Firestore is a document database, switching from PostgreSQL may require adapting schemas and queries.