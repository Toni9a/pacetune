# PaceTune

PaceTune maps Strava runs to Spotify listening history so a user can see which songs were playing at each progressive split of a run.

This README is written as a full handoff for a fresh coding chat. It should give enough context for someone new to understand:

- what the app does
- how auth/session/persistence work
- how songs are matched to runs and splits
- what has already been fixed
- what the remaining product and technical gaps are

## Product Summary

Current product shape:

- Users connect `Spotify` and `Strava`
- The app syncs runs from Strava and recently played tracks from Spotify
- Songs are matched to a run by time overlap
- Each song is assigned to one split only
- Runs can be viewed in:
  - `Messages` view
  - `List` view
- Messages view supports:
  - bubble color picker
  - bubble opacity slider
  - plain or photo background
  - export/share PNG card
- Saved PaceTunes are stored in Supabase and can be reloaded later

The live app is here:

- [https://pacetune.vercel.app](https://pacetune.vercel.app)

## Current Stack

- Next.js App Router
- Plain `fetch` calls to:
  - Spotify Web API
  - Strava API
  - Supabase PostgREST API
- No Supabase JS SDK in runtime code
- Supabase for persistence
- Vercel for hosting
- Legacy Python CLI still exists for earlier/local workflows

## Repo Structure

### Main app UI

- [app/page.js](/Users/toni/Documents/pactune/app/page.js)
- [components/sync-panel.js](/Users/toni/Documents/pactune/components/sync-panel.js)
- [app/globals.css](/Users/toni/Documents/pactune/app/globals.css)

### OAuth routes

- [app/api/auth/spotify/start/route.js](/Users/toni/Documents/pactune/app/api/auth/spotify/start/route.js)
- [app/api/auth/spotify/callback/route.js](/Users/toni/Documents/pactune/app/api/auth/spotify/callback/route.js)
- [app/api/auth/strava/start/route.js](/Users/toni/Documents/pactune/app/api/auth/strava/start/route.js)
- [app/api/auth/strava/callback/route.js](/Users/toni/Documents/pactune/app/api/auth/strava/callback/route.js)
- [app/api/auth/logout/route.js](/Users/toni/Documents/pactune/app/api/auth/logout/route.js)

### App API routes

- [app/api/sync/route.js](/Users/toni/Documents/pactune/app/api/sync/route.js)
- [app/api/history/route.js](/Users/toni/Documents/pactune/app/api/history/route.js)
- [app/api/demo-report/route.js](/Users/toni/Documents/pactune/app/api/demo-report/route.js)

### Core logic

- [lib/pacetune.js](/Users/toni/Documents/pactune/lib/pacetune.js)
- [lib/supabase-rest.js](/Users/toni/Documents/pactune/lib/supabase-rest.js)
- [lib/oauth.js](/Users/toni/Documents/pactune/lib/oauth.js)
- [lib/demo-report.js](/Users/toni/Documents/pactune/lib/demo-report.js)

### Database

- [supabase/schema.sql](/Users/toni/Documents/pactune/supabase/schema.sql)

### Legacy CLI

- [pacetune.py](/Users/toni/Documents/pactune/pacetune.py)

## Environment Variables

### Required for web app auth

- `APP_URL`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`

### Required for persistence

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_TOKEN_ENCRYPTION_KEY`

### Notes

- `SUPABASE_SERVICE_ROLE_KEY` must remain server-only
- `APP_TOKEN_ENCRYPTION_KEY` is used to encrypt provider refresh tokens before saving to Supabase
- if `APP_TOKEN_ENCRYPTION_KEY` changes, existing encrypted refresh tokens may become unreadable and users may need to reconnect providers

## OAuth Setup

### Spotify

Configured redirect:

- `https://pacetune.vercel.app/api/auth/spotify/callback`

Scope currently used:

- `user-read-recently-played`

Important Spotify limitation:

- PaceTune currently relies on `recently-played`
- this is not a durable full-history archive
- if sync happens too late, older plays may already be gone

### Strava

Configured callback domain:

- `pacetune.vercel.app`

Redirect path used in code:

- `https://pacetune.vercel.app/api/auth/strava/callback`

Known Strava operational limitation:

- new public users can be blocked by Strava athlete-cap limits if the app has not been expanded beyond dev/single-athlete constraints

## Current Auth and Identity Model

There is no separate email/password signup flow.

Identity is based on provider linking plus an app cookie.

### Session cookie

- app session cookie: `pt_user_id`

Legacy cookie still referenced in compatibility paths:

- `pt_owner_id`

### How provider mapping works

When a user connects Spotify or Strava:

1. the callback gets the provider user ID
2. the app looks for an existing record in `pacetune_provider_accounts`
3. if found, it uses that mapped app user
4. if not found but a current session user exists, it links the provider to that user
5. otherwise it creates a new app user and links the provider

This means users do not need a separate signup form.

## Supabase Data Model

Current tables:

- `pacetune_users`
- `pacetune_provider_accounts`
- `pacetune_runs`
- `pacetune_tracks`
- `pacetune_splits`
- `pacetune_split_tracks`

### Purpose of each table

`pacetune_users`

- app-level user row keyed by UUID

`pacetune_provider_accounts`

- provider identity mapping
- stores encrypted provider refresh tokens
- providers currently used:
  - `spotify`
  - `strava`

`pacetune_runs`

- one row per synced run per user

`pacetune_tracks`

- run-level track list captured for a given run

`pacetune_splits`

- split timing and distance rows for a run

`pacetune_split_tracks`

- join table that assigns a specific track to exactly one split

## How Sync Works

The main sync flow lives in [lib/pacetune.js](/Users/toni/Documents/pactune/lib/pacetune.js) and [app/api/sync/route.js](/Users/toni/Documents/pactune/app/api/sync/route.js).

### High-level flow

1. Read current `pt_user_id` session
2. Load encrypted Spotify + Strava refresh tokens for that user from Supabase
3. Refresh both access tokens
4. Fetch Strava runs in the requested time window
5. For each run:
   - fetch Strava activity detail
   - fetch Spotify recently played tracks around the run window
   - filter songs to tracks that truly overlap the run
   - compute splits
   - assign each song to one split
6. Persist the report to Supabase
7. Return the live report JSON to the frontend

## How Songs Are Matched

Song-to-run and song-to-split logic lives in [lib/pacetune.js](/Users/toni/Documents/pactune/lib/pacetune.js).

### Spotify timing assumption

Spotify `recently-played` gives `played_at`.

Current assumption:

- `played_at` is treated as the track end timestamp
- `started_at = played_at - duration_ms`

This is an approximation, but it is the best historical timing available from the current Spotify endpoint.

### Run matching logic

A song belongs to a run if the song interval overlaps the run interval.

That means:

- songs that started before the run but continued into it can be included
- songs that started during the run and ended shortly after can be included

### Important recent fix

To avoid dropping songs at the beginning or end of runs, the app now:

- fetches Spotify plays with a `15 minute` padding before and after the run window
- then filters tracks back down to those that truly overlap the run

This fix was added because songs at run boundaries were getting missed when the fetch window was too strict.

### Split matching logic

Each track is assigned to one split only.

The chosen split is:

- the split with the greatest time overlap with that song

This prevents the same song from appearing at the end of one split and again at the start of the next.

## Split Construction

Split construction is handled in [lib/pacetune.js](/Users/toni/Documents/pactune/lib/pacetune.js).

Current behavior:

- use `splits_metric` from Strava when available
- support both:
  - cumulative elapsed split data
  - per-split elapsed data
- if there is leftover run time after the final Strava split, add a tail split so the full run end is covered
- if no Strava splits are available, estimate splits evenly across total run distance/time

This means the app should cover the full run from start to finish, including final partial distance like `8.6 km`, `10.1 km`, `15.1 km`, etc.

## Persistence Behavior

Persistence is implemented in [lib/supabase-rest.js](/Users/toni/Documents/pactune/lib/supabase-rest.js).

### Save behavior

On sync, the app saves:

- run rows
- run-level tracks
- splits
- split-track assignments

### Important overwrite safeguard

There is protection against replacing a richer cached run with a poorer later sync.

Current behavior:

- if an existing saved run has more tracks than the new sync result
- the richer existing run is preserved instead of being overwritten by emptier data

This was added because Spotify history can fall out of the recent-play window over time.

### What this safeguard does not solve

If a run was already saved empty before this safeguard existed, the app cannot reconstruct those missing songs from Spotify once they are no longer in recent history.

## History Loading

Saved history is loaded via:

- [app/api/history/route.js](/Users/toni/Documents/pactune/app/api/history/route.js)

That route:

- checks Supabase configuration
- resolves the current app session user from cookie
- loads saved runs from Supabase
- returns a report shaped similarly to live sync output

Current limit:

- the last `30` runs are returned by default

## UI Behavior

Main UI is in [components/sync-panel.js](/Users/toni/Documents/pactune/components/sync-panel.js).

### Current views

`Messages`

- per-split message bubbles
- pace label under each bubble
- progressive distance labels like `1 km`, `2 km`, `8.6 km`
- customizable:
  - bubble color
  - bubble opacity
  - plain/photo background

`List`

- plain expandable list view of songs and splits

### Long-run layout

For large runs with many splits:

- message bubbles alternate left/right once there are `10+` split bubbles

This prevents the thread from becoming one long right-aligned column.

### Export/share card

The export card is generated from the same message-style layout.

Current behavior:

- supports long runs with dynamic canvas height
- uses bubble/photo styling similar to preview
- uses alternating left/right layout for long runs

## Demo Mode

There is a built-in demo mode so local testing does not require provider auth.

Files:

- [lib/demo-report.js](/Users/toni/Documents/pactune/lib/demo-report.js)
- [app/api/demo-report/route.js](/Users/toni/Documents/pactune/app/api/demo-report/route.js)

Demo scenarios currently include:

- `Mellow Tempo`
- `Tempo Session`
- `Long Run (2 runs)`
- `No Song Splits`

## API Route Summary

### `GET /api/sync`

Runs live sync for a date window.

Requirements:

- user must have a valid app session
- both Spotify and Strava must be connected
- Supabase must be configured

### `GET /api/history`

Loads saved PaceTunes from Supabase for the current app user.

Common responses:

- `401` if no app user session
- `404` if no saved runs exist
- `200` if saved history exists

### `GET /api/demo-report`

Returns built-in demo data.

Useful for:

- local UI development
- visualization work without OAuth

## Local Development

### Start dev server

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3010
```

Open:

- [http://127.0.0.1:3010](http://127.0.0.1:3010)

### Build

```bash
npm run build
```

Note:

- Homebrew Node was previously broken because `libsimdjson` was missing
- this was fixed by reinstalling Homebrew `simdjson` and `node`

## Deploying on Vercel

1. Push `main`
2. Ensure Vercel project uses `Next.js`
3. Leave Output Directory empty/default
4. Add production env vars
5. Redeploy

Production URL:

- [https://pacetune.vercel.app](https://pacetune.vercel.app)

## Supabase Setup

1. Create/open the Supabase project
2. Run:
   - [supabase/schema.sql](/Users/toni/Documents/pactune/supabase/schema.sql)
3. Add env vars to Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `APP_TOKEN_ENCRYPTION_KEY`
4. Redeploy

## Known Limitations

### Spotify history is not durable enough on its own

- if sync happens too late, older plays are gone
- app can preserve cached runs, but it cannot recover music that was never captured in time

### No automated background sync yet

- sync is still user-triggered
- this makes Spotify recent-history loss more likely

### Minimal account management

- there is no polished account settings page yet
- provider disconnect/reconnect UX is still basic

### No Apple Health live integration yet

- direct Apple HealthKit access is not available from a pure web app
- likely future solution:
  - lightweight iOS companion app
  - or manual export/import path

## Most Important Recent Fixes

These are useful context for a new coding chat:

1. User/provider mapping added
- users are mapped via Spotify/Strava provider IDs in Supabase

2. Saved history added
- runs/splits/tracks persist in Supabase and can be loaded later

3. Empty overwrite protection added
- richer saved runs should not be replaced by emptier later syncs

4. Split assignment fixed
- a song is assigned to one split only, not duplicated across boundaries

5. Long-run export/layout fixed
- share card height is dynamic
- long message threads alternate left/right

6. Run-boundary capture improved
- Spotify fetch uses padded window before filtering to true run overlap

## Recommended Next Work

### Highest priority

1. Automated background sync
- cron or queue-based sync every 15-30 minutes
- this is the best protection against Spotify recent-history loss

2. Dedicated saved-runs page
- e.g. `/my-pacetunes`
- filters for date, distance, run name

3. Debug visibility
- show:
  - total Spotify plays fetched
  - total plays overlapping run
  - total songs assigned to splits
- this would make bug reports much easier to diagnose

### Good product additions

1. Provider management UI
- connected providers list
- reconnect/disconnect actions

2. More visualization modes
- current message style is only one mode
- timeline/map/card variants are natural next steps

3. Better export presets
- more card themes
- more layout presets

4. Confidence / diagnostics
- surface approximate nature of Spotify timing
- expose matching confidence for ambiguous cases

## Troubleshooting

### `Supabase is not configured`

Likely causes:

- missing `SUPABASE_URL`
- missing `SUPABASE_SERVICE_ROLE_KEY`

### `No user session. Connect Spotify + Strava first.`

Likely causes:

- no `pt_user_id` cookie
- auth flow did not complete correctly
- user is on a fresh browser/device

### `/api/history` shows no runs

Likely causes:

- user has never synced
- runs were saved under a different `pt_user_id`
- user session/cookie changed

### Saved run has empty songs

Likely causes:

- sync happened after songs fell out of Spotify recent history
- run was already saved empty before preservation safeguards existed

### Sync fails after rotating encryption key

Likely cause:

- old provider refresh tokens can no longer be decrypted

Fix:

- reconnect Spotify and Strava for affected users

### OAuth callback gives blank or odd result

Recent callback hardening redirects callback errors back to the app instead of leaving a blank dead-end page, but dashboard redirect mismatch can still cause provider-side failures.

Check:

- Spotify redirect URI exact match
- Strava callback domain
- app athlete/user limits in provider dashboards

## Security Notes

- never commit secrets
- rotate exposed keys immediately
- keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- keep `APP_TOKEN_ENCRYPTION_KEY` secret and stable
- if service-role or encryption secrets are rotated, verify auth + sync flows afterward

## Legacy CLI

The original Python CLI still exists in [pacetune.py](/Users/toni/Documents/pactune/pacetune.py).

It supports:

- token flows
- JSON sync reports
- HTML rendering
- plain-text song listing

The web app is now the primary path, but the CLI is still useful for direct inspection and one-off local debugging.
