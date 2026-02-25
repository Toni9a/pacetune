# PaceTune MVP

First local MVP for mapping your run timeline to Spotify listening history.

## What this does

- Pulls runs from Strava in a time window.
- Pulls Spotify recently played tracks in each run window.
- Matches tracks to run time and run splits (from Strava split data when available).
- Writes a JSON report you can later feed into a web frontend.

## Current scope

- Supports **Strava + Spotify** only.
- Built for your own account first (no multi-user auth yet).
- Uses Spotify `recently-played` API (best for recent sessions, not full historical export).

## Prerequisites

- Python 3.10+
- Strava API app:
  - `client_id`, `client_secret`
  - long-lived `refresh_token`
- Spotify API app:
  - `client_id`, `client_secret`
  - `refresh_token` with `user-read-recently-played`

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
cp .env.example .env
```

Fill `.env` with your credentials/tokens.

## Get Spotify refresh token (one-time)

1. Configure a redirect URI in Spotify Dashboard (example: `http://127.0.0.1:8888/callback`).
2. Generate consent URL:

```bash
python pacetune.py spotify-auth-url --redirect-uri http://127.0.0.1:8888/callback
```

3. Open the URL, approve, and copy `code` from callback URL.
4. Exchange `code` for tokens:

```bash
python pacetune.py spotify-exchange-code --code "<CODE>" --redirect-uri http://127.0.0.1:8888/callback
```

Use the returned `refresh_token` in `.env`.

## Run sync

```bash
python pacetune.py sync \
  --start 2026-02-20T00:00:00Z \
  --end 2026-02-26T00:00:00Z
```

Output file will be created in `output/`:

- `run_id`, `distance_km`, `start/end`
- `tracks_during_run`
- `splits` with songs per split

## Render HTML view

Convert your latest JSON report into a readable browser page:

```bash
python pacetune.py render-html
```

Or specify files:

```bash
python pacetune.py render-html \
  --report-file output/pacetune-report-20260225-162053.json \
  --output-file output/pacetune-report-20260225-162053.html
```

## Print fetched songs (plain text)

Show exactly what songs were matched for each run:

```bash
python pacetune.py list-songs
```

You can also target a specific report:

```bash
python pacetune.py list-songs --report-file output/pacetune-report-20260225-162053.json
```

## Notes

- Spotify `played_at` is treated as track **end** time; start time is estimated by subtracting track duration.
- If Strava split metrics are unavailable, splits are approximated evenly by elapsed time.
- Spotify `recently-played` requests up to 50 items per page, and this tool paginates backward with the `before` cursor.

## Next steps

- Add Apple HealthKit import path.
- Persist data in SQLite.
- Build API + frontend charts for split/song timeline.
- Add user auth + OAuth callback server for multi-user support.
