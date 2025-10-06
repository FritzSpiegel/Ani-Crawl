## aniworld-scraper

Monorepo: Node/Express + Mongo (Mongoose) crawler with React (Vite + Tailwind) frontend.

- Server dev: `pnpm i && pnpm --filter server dev`
- Web dev: `pnpm --filter web dev`
- Mongo: `docker compose up -d`
- Tests: `pnpm test`

Env vars: see `.env.example` and `apps/server/.env.example`.  
Place fixtures under `apps/server/fixtures/` and reference via env.
