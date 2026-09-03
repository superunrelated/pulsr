# Prerequisites (one-time manual setup)

These require external accounts/consoles that can't be automated from here.

## 1. Supabase

Project: `https://supabase.com/dashboard/project/wjgyqqqvimymwxdpnabk`

- Project Settings → API: grab the Project URL, `anon` public key, and
  `service_role` key. The service-role key is server-side only (Edge
  Functions, `mcp-server`) — never put it in `apps/web` or `apps/tray` env
  files, and never commit it.
- Install the CLI: `brew install supabase/tap/supabase`, then
  `supabase link --project-ref wjgyqqqvimymwxdpnabk`.
- Enable the **Vault** extension (Database → Extensions →
  `supabase_vault`) if not already on — migration `001_init.sql` also
  attempts to enable it.
- Apply migrations: `supabase db push`.
- Create your one user account (Authentication → Users → Add user, or via
  `supabase.auth.signUp` once from a REPL) — this is a single-user app.

## 2. Google Cloud (Google Fit OAuth)

- Create a project at console.cloud.google.com.
- Enable the **Fitness API**.
- OAuth consent screen: **External** + **Testing** mode is enough since only
  your own account will authorize. Add scopes:
  - `https://www.googleapis.com/auth/fitness.activity.read`
  - `https://www.googleapis.com/auth/fitness.sleep.read`
- Create an **OAuth 2.0 Client ID** (Web application) with an authorized
  redirect URI:
  `https://wjgyqqqvimymwxdpnabk.supabase.co/functions/v1/google-fit-sync/callback`
- Set the Edge Function secrets:
  ```bash
  supabase secrets set \
    GOOGLE_CLIENT_ID=... \
    GOOGLE_CLIENT_SECRET=... \
    GOOGLE_REDIRECT_URI=https://wjgyqqqvimymwxdpnabk.supabase.co/functions/v1/google-fit-sync/callback
  ```
- Deploy the function: `supabase functions deploy google-fit-sync`.

## 3. GitHub

Create a new empty **private** repo (e.g. `pulsr`), then:

```bash
git remote add origin git@github.com:<you>/pulsr.git
git push -u origin main
```

Add repo secrets (Settings → Secrets and variables → Actions) for the web
build if you want CI to build with real values:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`,
`VITE_GOOGLE_REDIRECT_URI`.

## Secrets checklist

| Secret                           | Where it's used            | Where it lives                                    |
| -------------------------------- | -------------------------- | ------------------------------------------------- |
| Supabase URL                     | web, tray, mcp-server      | `.env` files (gitignored), GitHub Actions secrets |
| Supabase anon key                | web, tray                  | same                                              |
| Supabase service-role key        | mcp-server, Edge Functions | local env / `supabase secrets set` — never in git |
| Google OAuth Client ID           | web (build consent URL)    | `.env` files, GitHub Actions secrets              |
| Google OAuth Client Secret       | Edge Function only         | `supabase secrets set` — never in git             |
| `PULSR_EMAIL` / `PULSR_PASSWORD` | tray app sign-in           | local env only                                    |
