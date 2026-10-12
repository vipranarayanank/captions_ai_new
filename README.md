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
2. Copy `apps/api/.env.example` to `apps/api/.env` and set `DATABASE_URL` to your Supabase PostgreSQL connection string.
3. Run `npm run db:generate`.
4. Run `npm run dev`.

Frontend: http://localhost:5173
API: http://localhost:3000/api
Health check: http://localhost:3000/api/health

Never commit real credentials. Keep database access on the backend. The current provider is PostgreSQL via Prisma; Firebase can be introduced behind a data-access interface later. Since Firestore is a document database, switching from PostgreSQL may require adapting schemas and queries.