# Database setup

## Current provider: Supabase PostgreSQL

The NestJS API uses Prisma to connect to Supabase PostgreSQL. Database credentials must stay in the API environment and must never be exposed as `VITE_*` variables.

1. Create a Supabase project.
2. Copy `apps/api/.env.example` to `apps/api/.env`.
3. Replace the placeholder values in `DATABASE_URL` and `DIRECT_URL` with the connection strings from Supabase **Project Settings → Database**.
4. From the repository root, run:

   ```sh
   npm install
   npm run db:generate
   npm run db:push
   ```

Use the connection string recommended by Supabase for your environment. Prisma's `DIRECT_URL` is intended for direct database access when the primary URL uses a pooler. Never commit `.env` files or credentials.

## Keep Firebase migration manageable

Supabase PostgreSQL and Firebase Firestore are different database models. A migration will not be a connection-string-only change: document structure, relations, transactions, filtering, and pagination may need adapting.

When adding product features:
- Keep database queries in backend services/repositories, not in controllers.
- Avoid exposing Prisma types to controllers or the React frontend.
- Define domain-oriented interfaces for each feature (for example, a project repository) and provide a Prisma implementation first.
- Add a Firestore implementation of the same interface if/when Firebase is selected.
- Keep file/video storage behind a separate storage interface. Database choice and media storage choice should be independently configurable.

No Firebase credentials or production database secrets belong in the frontend.
