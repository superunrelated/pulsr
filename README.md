# Pulsr

A personal health and lifestyle tracker: weight, medications, symptoms, and
wearable activity data (Pixel Watch via Google Fit), with an MCP server so
Claude can be asked to reason about the data — Pulsr itself never calls an
LLM.

## Structure

- `apps/web` — React 19 + Vite + Tailwind PWA (the primary interface, used on
  Android and in the browser)
- `apps/tray` — Electron menu-bar app for macOS: fires reminders (water,
  standing desk, walking pad, pills, a weekly "review with Claude" nudge) and
  offers quick-log actions
- `libs/ui`, `libs/shared` — shared React components and Supabase
  client/types used by both apps
- `mcp-server` — standalone MCP server exposing Pulsr's data as read-only
  tools for any MCP client (Claude Desktop, Claude Code)
- `supabase/` — Postgres migrations (schema + RLS) and the `google-fit-sync`
  Edge Function (OAuth callback + scheduled sync)

## Prerequisites

See `docs/PREREQUISITES.md` (or the original planning doc) for the one-time
manual setup: a Supabase project, a Google Cloud OAuth app for Google Fit,
and a GitHub repo. You'll need these values before running anything:

- Supabase project URL, anon key, service-role key
- Google OAuth Client ID/Secret + redirect URI

## Local development

```bash
npm install

# Web app
cp apps/web/.env.example apps/web/.env
npm run dev            # nx serve web, http://localhost:4200

# Supabase (once the CLI is installed and linked)
supabase db push       # applies supabase/migrations
supabase functions deploy google-fit-sync
supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REDIRECT_URI=...

# MCP server (used by Claude Desktop/Code, not by the web app)
cd mcp-server && npm install
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run build
# then point your MCP client at: node mcp-server/dist/index.js

# Mac tray app
cd apps/tray && npm install
PULSR_SUPABASE_URL=... PULSR_SUPABASE_ANON_KEY=... PULSR_EMAIL=... PULSR_PASSWORD=... npm start
```

## Commands

- `npm run dev` / `npm run build` — web app
- `npm run lint` / `npm test` / `npm run typecheck` — all Nx projects
- `npm run mcp-server:build` / `npm run mcp-server:dev`
- `npm run tray:start`
