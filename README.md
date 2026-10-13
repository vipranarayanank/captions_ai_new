# Captions AI

AI-assisted video caption editor built with a Next.js (React + TypeScript) frontend and a NestJS API, with Prisma/PostgreSQL, Supabase Storage, BullMQ/Redis, FFmpeg, and Remotion.

## Workspace

- `apps/web`: Next.js App Router frontend. The existing caption editor, templates, timeline, and browser rendering code remain in `apps/web/src`.
- `apps/api`: NestJS backend and API.
- The web app calls the existing NestJS API; the backend architecture is intentionally unchanged.

## Development

Install dependencies from the repository root:

```bash
npm install
```

Run frontend and API together:

```bash
npm run dev
```

Run only the frontend:

```bash
npm run dev:web
```

Run only the NestJS API:

```bash
npm run dev:api
```

Build both workspaces:

```bash
npm run build
```

The frontend now uses Next.js App Router routes for `/` and `/editor/[id]`. The editor is loaded client-side because it uses browser APIs, Canvas, media elements, and Remotion's browser renderer.

## Migration notes

The migration branch is `feat/nest-nextjs`. Run `npm install` at the repository root to refresh `package-lock.json` after the frontend dependency change, then run `npm run build` and test uploads, direct editor URLs, timeline editing, and browser export.
