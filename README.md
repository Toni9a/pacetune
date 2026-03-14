# PaceTune

PaceTune maps running data (Strava) to listening history (Spotify) so users can see which songs were playing at each split of a run.

This README is a full project handoff doc for another coding agent (Claude/Codex/etc.).

## 1) Current Product State

### Live app behavior
- OAuth login via Spotify + Strava.
- No email/password signup required.
- Sync endpoint fetches runs and recently played tracks, computes overlap by time.
- UI supports:
  - Message-bubble visualization (per-split songs + pace labels)
  - List view fallback
  - Demo scenarios without provider auth
  - Background photo option for message thread
  - Share/export card (PNG) that renders bubble-style output

### Persistence behavior
- Data is stored in Supabase when configured.
- `/api/sync` saves runs/splits/tracks and split-to-track mappings.
- `/api/history` returns saved PaceTunes for the current app session user.
- Provider refresh tokens are stored in Supabase `pacetune_provider_accounts`.
- Token values are encrypted using `APP_TOKEN_ENCRYPTION_KEY` (server-side).

### Important limitation (Spotify)
- Spotify `recently-played` is not a full historical archive.
- If sync runs too late, older tracks can already be gone.
- Result: historic runs may show empty songs if they were synced after the window passed.

## 2) Tech Stack

- Next.js App Router (Node runtime)
- Plain REST calls to provider APIs + Supabase PostgREST
- No Supabase SDK dependency in runtime code
- Python CLI still exists for local data workflows (`pacetune.py`)

## 3) Repo Structure (Key Files)

- Web app
  - `app/page.js`
  - `components/sync-panel.js`
  - `app/globals.css`
- OAuth routes
  - `app/api/auth/spotify/start/route.js`
  - `app/api/auth/spotify/callback/route.js`
  - `app/api/auth/strava/start/route.js`
  - `app/api/auth/strava/callback/route.js`
  - `app/api/auth/logout/route.js`
- Sync/history routes
  - `app/api/sync/route.js`
  - `app/api/history/route.js`
  - `app/api/demo-report/route.js`
- Core logic
  - `lib/pacetune.js` (run/song matching)
  - `lib/supabase-rest.js` (persistence + provider mapping + token encryption)
  - `lib/oauth.js`
  - `lib/demo-report.js`
- DB schema
  - `supabase/schema.sql`
- Legacy CLI
  - `pacetune.py`

## 4) Environment Variables

## Required for web app
- `APP_URL`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`

## Required for persistence + provider mapping
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
- `APP_TOKEN_ENCRYPTION_KEY` (server-only secret, used for encrypting provider refresh tokens)

## Notes
- `SUPABASE_SERVICE_ROLE_KEY` must not be exposed client-side.
- `APP_TOKEN_ENCRYPTION_KEY` rotation can make previously encrypted tokens unreadable unless accounts reconnect.

## 5) OAuth Setup

## Spotify Dashboard
- Redirect URI:
  - `https://pacetune.vercel.app/api/auth/spotify/callback`
- Scope currently used:
  - `user-read-recently-played`

## Strava Dashboard
- Authorization Callback Domain:
  - `pacetune.vercel.app`
- Redirect URI is passed in code:
  - `https://pacetune.vercel.app/api/auth/strava/callback`

## 6) Supabase Setup

1. Create/open project.
2. Run SQL file in SQL Editor:
   - `supabase/schema.sql`
3. Add env vars in Vercel Production:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_TOKEN_ENCRYPTION_KEY`
4. Redeploy app.

## Quick verification
- `GET /api/history`
  - 401: no user session (connect providers first)
  - 404: user exists but no synced history yet
  - 200: saved report JSON

## 7) Data Model (Current)

- `pacetune_users`
- `pacetune_provider_accounts`
  - provider identities map to app users (`spotify` / `strava`)
  - stores encrypted provider refresh token
- `pacetune_runs`
- `pacetune_tracks`
- `pacetune_splits`
- `pacetune_split_tracks`

## 8) Identity + Session Model (Current)

- App session cookie: `pt_user_id`
- On provider callback:
  - fetch provider user ID
  - find existing user by `(provider, provider_user_id)`
  - else create/link to current app user session
  - else create new app user
- No separate signup flow.

## 9) Sync Logic (Current)

1. Resolve app user from `pt_user_id`.
2. Read provider refresh tokens from Supabase.
3. Refresh provider access tokens.
4. Pull Strava runs in requested window.
5. For each run:
   - pull Spotify plays overlapping run window
   - compute splits
   - assign tracks to splits by overlap
6. Persist report to Supabase.

## 10) Known Gaps / Risks

1. Backfill limitation:
   - cannot recover songs already outside Spotify recent window.
2. Scheduled sync missing:
   - currently user-triggered sync only.
3. Provider token refresh rotation:
   - callbacks update refresh token when returned; long-term token lifecycle policies still basic.
4. Security hardening:
   - service-role based server routes are MVP-level; RLS policies not fully used yet.
5. Cross-device account continuity:
   - works if provider linking is consistent; app-level user management is still minimal.

## 11) Recommended Next Work (Priority Order)

1. Scheduled sync jobs
- run every 15-30 minutes per linked user
- store sync status + last successful sync

2. Do-not-overwrite-with-empty safeguard
- avoid replacing existing run-song mapping with empty result unless forced

3. Provider account management
- show connected providers UI
- disconnect/reconnect controls per provider

4. Saved PaceTunes UX
- dedicated `/my-pacetunes` page
- filters by date/distance/run name

5. Better match confidence
- show confidence tags when overlaps are ambiguous

6. Apple Health ingestion path
- likely iOS companion + backend upload OR manual export import

## 12) Local Development

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Open:
- `http://127.0.0.1:3010`

If port is stuck:
```bash
lsof -nP -iTCP:3010 -sTCP:LISTEN
kill <pid>
```

## 13) Deploy (Vercel)

1. Push `main`.
2. Ensure Framework Preset = Next.js.
3. Output Directory should be empty/default (do not set to `public`).
4. Set env vars in Production.
5. Redeploy.

## 14) Troubleshooting

## `Supabase is not configured`
- Missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` in runtime env.

## `/api/history` returns no runs
- user session exists but no synced history yet; run sync first.

## Empty songs in saved runs
- sync happened after songs fell out of Spotify recent window.

## OAuth redirect errors
- redirect URI mismatch between app and provider dashboard.

## 15) Security Notes

- Never commit secrets.
- Rotate exposed keys immediately.
- Service role key should be Production-only in Vercel.
- `APP_TOKEN_ENCRYPTION_KEY` should be long random secret and treated like credentials.

## 16) Legacy CLI (Still Included)

`pacetune.py` supports:
- token flows
- JSON sync reports
- HTML render
- plain-text song listing

The web app is now the primary path for multi-user behavior.
