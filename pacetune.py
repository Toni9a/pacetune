#!/usr/bin/env python3
import argparse
import datetime as dt
import base64
import glob
import html
import json
import os
import sys
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

UTC = dt.timezone.utc


class APIError(RuntimeError):
    pass


@dataclass
class TrackPlay:
    track_name: str
    artists: str
    played_at: dt.datetime
    duration_ms: int
    track_id: str

    @property
    def started_at(self) -> dt.datetime:
        # Spotify returns track end time in `played_at`.
        return self.played_at - dt.timedelta(milliseconds=self.duration_ms)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.track_id,
            "track_name": self.track_name,
            "artists": self.artists,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.played_at.isoformat(),
            "duration_ms": self.duration_ms,
        }


@dataclass
class RunSplit:
    split_index: int
    distance_km: float
    elapsed_time_s: int
    start_time: dt.datetime
    end_time: dt.datetime
    songs: List[TrackPlay]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "split_index": self.split_index,
            "distance_km": self.distance_km,
            "elapsed_time_s": self.elapsed_time_s,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "songs": [song.to_dict() for song in self.songs],
        }


def parse_iso_utc(value: str) -> dt.datetime:
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def load_dotenv_simple(dotenv_path: str = ".env") -> None:
    if not os.path.exists(dotenv_path):
        return
    with open(dotenv_path, "r", encoding="utf-8") as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = value


def http_json(
    method: str,
    url: str,
    *,
    headers: Optional[Dict[str, str]] = None,
    params: Optional[Dict[str, Any]] = None,
    form: Optional[Dict[str, Any]] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    if params:
        query = urlencode({k: v for k, v in params.items() if v is not None})
        url = f"{url}?{query}"

    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    body = None
    if form is not None:
        body = urlencode(form).encode("utf-8")
        req_headers["Content-Type"] = "application/x-www-form-urlencoded"

    request = Request(url=url, method=method.upper(), headers=req_headers, data=body)
    try:
        with urlopen(request, timeout=timeout) as response:
            status = response.getcode()
            raw = response.read().decode("utf-8")
    except HTTPError as exc:
        body = ""
        try:
            body = exc.read().decode("utf-8")
        except Exception:
            body = str(exc)
        raise APIError(f"HTTP {exc.code} for {method} {url}: {body}") from exc
    except Exception as exc:
        raise APIError(f"HTTP request failed ({method} {url}): {exc}") from exc

    if status < 200 or status >= 300:
        raise APIError(f"HTTP {status} for {method} {url}: {raw}")

    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError as exc:
        raise APIError(f"Invalid JSON response from {url}: {raw[:300]}") from exc


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise APIError(f"Missing required environment variable: {name}")
    return value


def refresh_strava_access_token() -> str:
    client_id = require_env("STRAVA_CLIENT_ID")
    client_secret = require_env("STRAVA_CLIENT_SECRET")
    refresh_token = require_env("STRAVA_REFRESH_TOKEN")

    payload = http_json(
        "POST",
        "https://www.strava.com/oauth/token",
        form={
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
    )
    token = payload.get("access_token")
    if not token:
        raise APIError(f"Strava token refresh failed: {payload}")
    return token


def refresh_spotify_access_token() -> str:
    client_id = require_env("SPOTIFY_CLIENT_ID")
    client_secret = require_env("SPOTIFY_CLIENT_SECRET")
    refresh_token = require_env("SPOTIFY_REFRESH_TOKEN")

    payload = http_json(
        "POST",
        "https://accounts.spotify.com/api/token",
        form={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": client_id,
            "client_secret": client_secret,
        },
    )
    if "access_token" not in payload:
        raise APIError(f"Spotify response missing access token: {payload}")
    return payload["access_token"]


def spotify_authorize_url(redirect_uri: str) -> str:
    client_id = require_env("SPOTIFY_CLIENT_ID")
    scopes = "user-read-recently-played"
    query = urlencode({
        "response_type": "code",
        "client_id": client_id,
        "scope": scopes,
        "redirect_uri": redirect_uri,
    })
    return f"https://accounts.spotify.com/authorize?{query}"


def spotify_exchange_code_for_refresh_token(code: str, redirect_uri: str) -> Dict[str, Any]:
    client_id = require_env("SPOTIFY_CLIENT_ID")
    client_secret = require_env("SPOTIFY_CLIENT_SECRET")
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
    payload = http_json(
        "POST",
        "https://accounts.spotify.com/api/token",
        headers={"Authorization": f"Basic {basic}"},
        form={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
        },
    )
    return payload


def list_strava_runs(access_token: str, start: dt.datetime, end: dt.datetime) -> List[Dict[str, Any]]:
    start_epoch = int(start.timestamp())
    end_epoch = int(end.timestamp())
    page = 1
    runs: List[Dict[str, Any]] = []

    while True:
        activities = http_json(
            "GET",
            "https://www.strava.com/api/v3/athlete/activities",
            headers={"Authorization": f"Bearer {access_token}"},
            params={"after": start_epoch, "before": end_epoch, "per_page": 200, "page": page},
        )
        if not isinstance(activities, list):
            raise APIError(f"Unexpected Strava activities payload: {activities}")
        if not activities:
            break
        runs.extend([activity for activity in activities if activity.get("type") == "Run"])
        page += 1

    return runs


def get_strava_activity_details(access_token: str, activity_id: int) -> Dict[str, Any]:
    return http_json(
        "GET",
        f"https://www.strava.com/api/v3/activities/{activity_id}",
        headers={"Authorization": f"Bearer {access_token}"},
        params={"include_all_efforts": "false"},
    )


def fetch_spotify_plays_in_window(
    access_token: str,
    start: dt.datetime,
    end: dt.datetime,
) -> List[TrackPlay]:
    # recently-played endpoint uses `before` as a cursor in ms.
    before_ms: Optional[int] = int(end.timestamp() * 1000)
    seen: set[Tuple[str, str]] = set()
    collected: List[TrackPlay] = []

    while True:
        params: Dict[str, Any] = {"limit": 50}
        if before_ms is not None:
            params["before"] = before_ms
        payload = http_json(
            "GET",
            "https://api.spotify.com/v1/me/player/recently-played",
            headers={"Authorization": f"Bearer {access_token}"},
            params=params,
        )
        items = payload.get("items", [])
        if not items:
            break

        oldest_played_at: Optional[dt.datetime] = None
        for item in items:
            track = item.get("track")
            if not track:
                continue
            played_at = parse_iso_utc(item["played_at"])
            duration_ms = int(track.get("duration_ms") or 0)
            started_at = played_at - dt.timedelta(milliseconds=duration_ms)

            key = (track.get("id") or "unknown", item["played_at"])
            if key in seen:
                continue
            seen.add(key)

            if played_at < start and started_at < start:
                oldest_played_at = played_at if oldest_played_at is None else min(oldest_played_at, played_at)
                continue
            if started_at > end:
                oldest_played_at = played_at if oldest_played_at is None else min(oldest_played_at, played_at)
                continue

            artists = ", ".join(artist.get("name", "") for artist in track.get("artists", []))
            collected.append(
                TrackPlay(
                    track_name=track.get("name", "Unknown"),
                    artists=artists,
                    played_at=played_at,
                    duration_ms=duration_ms,
                    track_id=track.get("id") or "unknown",
                )
            )
            oldest_played_at = played_at if oldest_played_at is None else min(oldest_played_at, played_at)

        if oldest_played_at is None:
            break
        if oldest_played_at <= start:
            break
        before_ms = int(oldest_played_at.timestamp() * 1000) - 1

    collected.sort(key=lambda x: x.started_at)
    return collected


def build_splits(run_detail: Dict[str, Any], run_start: dt.datetime, run_end: dt.datetime) -> List[RunSplit]:
    splits_metric = run_detail.get("splits_metric") or []
    if splits_metric:
        splits: List[RunSplit] = []
        # Strava payloads can represent `elapsed_time` either cumulatively or per split.
        # Detect mode to avoid negative/near-zero split durations.
        elapsed_values = [int(split.get("elapsed_time") or 0) for split in splits_metric]
        is_cumulative = all(
            elapsed_values[i] >= elapsed_values[i - 1] for i in range(1, len(elapsed_values))
        )

        total_elapsed = int((run_end - run_start).total_seconds())
        cumulative_elapsed = 0
        previous_end = run_start
        for i, split in enumerate(splits_metric, start=1):
            raw_elapsed = int(split.get("elapsed_time") or 0)
            if is_cumulative:
                target_elapsed = raw_elapsed
                split_elapsed = max(1, target_elapsed - cumulative_elapsed)
                cumulative_elapsed = target_elapsed
            else:
                split_elapsed = max(1, raw_elapsed)
                cumulative_elapsed += split_elapsed

            split_end = run_start + dt.timedelta(seconds=cumulative_elapsed)
            if total_elapsed > 0 and split_end > run_end:
                split_end = run_end
                split_elapsed = max(1, int((split_end - previous_end).total_seconds()))

            splits.append(
                RunSplit(
                    split_index=i,
                    distance_km=float(split.get("distance", 0.0)) / 1000.0,
                    elapsed_time_s=split_elapsed,
                    start_time=previous_end,
                    end_time=split_end,
                    songs=[],
                )
            )
            previous_end = split_end

        # If the final partial distance/time is missing from splits_metric, append a tail split.
        if previous_end < run_end:
            splits.append(
                RunSplit(
                    split_index=len(splits) + 1,
                    distance_km=max(0.0, (float(run_detail.get("distance") or 0.0) / 1000.0) - sum(s.distance_km for s in splits)),
                    elapsed_time_s=max(1, int((run_end - previous_end).total_seconds())),
                    start_time=previous_end,
                    end_time=run_end,
                    songs=[],
                )
            )
        return splits

    # Fallback when Strava does not provide split details.
    distance_m = float(run_detail.get("distance") or 0.0)
    elapsed_s = int(run_detail.get("elapsed_time") or int((run_end - run_start).total_seconds()))
    if elapsed_s <= 0:
        elapsed_s = 1
    split_count = max(1, int(distance_m // 1000))
    splits = []
    for i in range(split_count):
        start_ratio = i / split_count
        end_ratio = (i + 1) / split_count
        split_start = run_start + dt.timedelta(seconds=int(elapsed_s * start_ratio))
        split_end = run_start + dt.timedelta(seconds=int(elapsed_s * end_ratio))
        splits.append(
            RunSplit(
                split_index=i + 1,
                distance_km=distance_m / 1000.0 / split_count,
                elapsed_time_s=max(1, int((split_end - split_start).total_seconds())),
                start_time=split_start,
                end_time=split_end,
                songs=[],
            )
        )
    return splits


def overlap_seconds(a_start: dt.datetime, a_end: dt.datetime, b_start: dt.datetime, b_end: dt.datetime) -> float:
    start = max(a_start, b_start)
    end = min(a_end, b_end)
    overlap = (end - start).total_seconds()
    return max(0.0, overlap)


def assign_tracks_to_splits(splits: List[RunSplit], tracks: List[TrackPlay]) -> None:
    for track in tracks:
        t_start = track.started_at
        t_end = track.played_at
        for split in splits:
            if overlap_seconds(t_start, t_end, split.start_time, split.end_time) > 0:
                split.songs.append(track)


def run_window(
    start: dt.datetime,
    end: dt.datetime,
    output_dir: str,
) -> Dict[str, Any]:
    strava_access_token = refresh_strava_access_token()
    spotify_access_token = refresh_spotify_access_token()

    runs = list_strava_runs(strava_access_token, start, end)
    report_runs: List[Dict[str, Any]] = []

    for run in runs:
        run_start = parse_iso_utc(run["start_date"])
        run_end = run_start + dt.timedelta(seconds=int(run.get("elapsed_time") or 0))
        if run_end < start or run_start > end:
            continue

        run_detail = get_strava_activity_details(strava_access_token, int(run["id"]))
        tracks = fetch_spotify_plays_in_window(spotify_access_token, run_start, run_end)
        splits = build_splits(run_detail, run_start, run_end)
        assign_tracks_to_splits(splits, tracks)

        report_runs.append(
            {
                "run_id": run["id"],
                "name": run.get("name"),
                "start_time": run_start.isoformat(),
                "end_time": run_end.isoformat(),
                "distance_km": float(run.get("distance") or 0.0) / 1000.0,
                "elapsed_time_s": int(run.get("elapsed_time") or 0),
                "tracks_during_run": [track.to_dict() for track in tracks],
                "splits": [split.to_dict() for split in splits],
            }
        )

    report = {
        "generated_at": dt.datetime.now(tz=UTC).isoformat(),
        "window_start": start.isoformat(),
        "window_end": end.isoformat(),
        "run_count": len(report_runs),
        "runs": report_runs,
    }

    os.makedirs(output_dir, exist_ok=True)
    outfile = os.path.join(output_dir, f"pacetune-report-{dt.datetime.now().strftime('%Y%m%d-%H%M%S')}.json")
    with open(outfile, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    report["output_file"] = outfile
    return report


def latest_report_path(output_dir: str) -> str:
    paths = sorted(glob.glob(os.path.join(output_dir, "pacetune-report-*.json")))
    if not paths:
        raise APIError(f"No report files found in {output_dir}")
    return paths[-1]


def render_report_html(report: Dict[str, Any]) -> str:
    def mmss(total_seconds: int) -> str:
        if total_seconds < 0:
            total_seconds = 0
        minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{minutes}:{seconds:02d}"

    runs = report.get("runs", [])
    run_cards: List[str] = []
    for run in runs:
        run_name = html.escape(str(run.get("name") or "Run"))
        run_start = html.escape(str(run.get("start_time", "")))
        run_end = html.escape(str(run.get("end_time", "")))
        distance = float(run.get("distance_km") or 0.0)
        elapsed_min = int((run.get("elapsed_time_s") or 0) / 60)
        tracks = run.get("tracks_during_run", [])
        track_list_rows: List[str] = []
        if tracks:
            for t in tracks:
                track_list_rows.append(
                    "<li>"
                    f"<strong>{html.escape(str(t.get('track_name', 'Unknown')))}</strong>"
                    f" <span>{html.escape(str(t.get('artists', '')))}</span>"
                    f" <em>{html.escape(str(t.get('started_at', '')))} -> {html.escape(str(t.get('ended_at', '')))}</em>"
                    "</li>"
                )
        else:
            track_list_rows.append("<li><span>No songs matched during this run.</span></li>")
        split_blocks: List[str] = []

        for split in run.get("splits", []):
            songs = split.get("songs", [])
            song_rows = []
            if songs:
                for song in songs:
                    song_rows.append(
                        "<li>"
                        f"<strong>{html.escape(str(song.get('track_name', 'Unknown')))}</strong>"
                        f" <span>{html.escape(str(song.get('artists', '')))}</span>"
                        "</li>"
                    )
            else:
                song_rows.append("<li><span>No song overlap in this split.</span></li>")

            split_start = html.escape(str(split.get("start_time", "")))
            split_end = html.escape(str(split.get("end_time", "")))
            split_elapsed = int(split.get("elapsed_time_s") or 0)
            split_distance = float(split.get("distance_km") or 0.0)
            split_duration_label = mmss(split_elapsed)
            if split_distance > 0:
                pace_s_per_km = int(round(split_elapsed / split_distance))
                pace_label = f"{mmss(pace_s_per_km)} /km"
            else:
                pace_label = "n/a"
            split_blocks.append(
                "<section class='split'>"
                f"<h4>Split {int(split.get('split_index') or 0)} "
                f"({split_distance:.2f} km)</h4>"
                f"<p><strong>Split Start:</strong> {split_start}</p>"
                f"<p><strong>Split End:</strong> {split_end}</p>"
                f"<p><strong>Split Time:</strong> {split_duration_label}</p>"
                f"<p><strong>Split Pace:</strong> {pace_label}</p>"
                f"<ul>{''.join(song_rows)}</ul>"
                "</section>"
            )

        run_cards.append(
            "<article class='run-card'>"
            f"<h3>{run_name}</h3>"
            f"<p><strong>{distance:.2f} km</strong> in {elapsed_min} min</p>"
            f"<p><strong>Run Start:</strong> {run_start}</p>"
            f"<p><strong>Run End:</strong> {run_end}</p>"
            f"<p>{len(tracks)} songs matched</p>"
            "<details open><summary>All songs during run</summary>"
            f"<ul>{''.join(track_list_rows)}</ul></details>"
            f"<details><summary>View splits + songs</summary>{''.join(split_blocks)}</details>"
            "</article>"
        )

    generated_at = html.escape(str(report.get("generated_at", "")))
    window_start = html.escape(str(report.get("window_start", "")))
    window_end = html.escape(str(report.get("window_end", "")))

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PaceTune Report</title>
  <style>
    :root {{
      --bg-a: #f6efe7;
      --bg-b: #d7efe9;
      --ink: #1e2b2f;
      --accent: #ea6f34;
      --card: rgba(255,255,255,0.7);
      --line: rgba(30,43,47,0.16);
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      color: var(--ink);
      background: radial-gradient(circle at 20% 0%, var(--bg-b), var(--bg-a) 65%);
      font-family: "Avenir Next", "Trebuchet MS", "Segoe UI", sans-serif;
    }}
    .wrap {{ max-width: 980px; margin: 0 auto; padding: 24px 16px 40px; }}
    h1 {{ margin: 0 0 8px; font-size: 2rem; letter-spacing: 0.02em; }}
    .meta {{ margin: 0 0 18px; padding: 12px; border: 1px solid var(--line); background: var(--card); border-radius: 12px; }}
    .grid {{ display: grid; grid-template-columns: 1fr; gap: 14px; }}
    .run-card {{
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 14px;
      background: var(--card);
      backdrop-filter: blur(2px);
    }}
    .run-card h3 {{ margin: 0 0 6px; }}
    .run-card p {{ margin: 4px 0; }}
    details {{ margin-top: 10px; border-top: 1px dashed var(--line); padding-top: 10px; }}
    summary {{ cursor: pointer; color: var(--accent); font-weight: 700; }}
    .split {{ margin: 12px 0; padding: 10px; background: rgba(255,255,255,0.45); border-radius: 10px; }}
    .split h4 {{ margin: 0 0 4px; }}
    .split p {{ margin: 0 0 8px; font-size: 0.9rem; }}
    ul {{ margin: 0; padding-left: 18px; }}
    li {{ margin: 3px 0; }}
    li span {{ opacity: 0.85; }}
    li em {{ opacity: 0.7; font-size: 0.85rem; font-style: normal; }}
    @media (min-width: 860px) {{
      .grid {{ grid-template-columns: 1fr 1fr; }}
    }}
  </style>
</head>
<body>
  <main class="wrap">
    <h1>PaceTune Run + Song View</h1>
    <div class="meta">
      <p><strong>Generated At (UTC):</strong> {generated_at}</p>
      <p><strong>Sync Window Start (UTC):</strong> {window_start}</p>
      <p><strong>Sync Window End (UTC):</strong> {window_end}</p>
      <p><strong>Runs:</strong> {len(runs)}</p>
      <p><strong>Song Time Note:</strong> Spotify <code>played_at</code> is treated as song end time; start time is estimated via duration.</p>
    </div>
    <section class="grid">
      {''.join(run_cards)}
    </section>
  </main>
</body>
</html>
"""


def render_html_file(report_file: str, html_file: str) -> str:
    with open(report_file, "r", encoding="utf-8") as f:
        report = json.load(f)
    page = render_report_html(report)
    with open(html_file, "w", encoding="utf-8") as f:
        f.write(page)
    return html_file


def list_report_songs(report_file: str) -> str:
    with open(report_file, "r", encoding="utf-8") as f:
        report = json.load(f)

    lines: List[str] = []
    lines.append(f"Report: {report_file}")
    lines.append(f"Generated: {report.get('generated_at', '')}")
    lines.append(f"Runs: {report.get('run_count', 0)}")
    lines.append("")

    for i, run in enumerate(report.get("runs", []), start=1):
        name = run.get("name") or f"Run {i}"
        run_id = run.get("run_id")
        start = run.get("start_time", "")
        end = run.get("end_time", "")
        tracks = run.get("tracks_during_run", [])
        lines.append(f"[{i}] {name} (id={run_id})")
        lines.append(f"    {start} -> {end}")
        lines.append(f"    Matched songs: {len(tracks)}")
        if not tracks:
            lines.append("    - none")
            lines.append("")
            continue
        for t_idx, t in enumerate(tracks, start=1):
            lines.append(
                "    "
                + f"{t_idx:02d}. {t.get('track_name', 'Unknown')} - {t.get('artists', '')} "
                + f"[{t.get('started_at', '')} -> {t.get('ended_at', '')}]"
            )
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync Strava runs with Spotify track history.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    auth_url = subparsers.add_parser("spotify-auth-url", help="Print Spotify OAuth URL to get user consent.")
    auth_url.add_argument("--redirect-uri", required=True, help="Must match Spotify app redirect URI exactly.")

    exchange = subparsers.add_parser("spotify-exchange-code", help="Exchange Spotify auth code for tokens.")
    exchange.add_argument("--code", required=True)
    exchange.add_argument("--redirect-uri", required=True, help="Must match Spotify app redirect URI exactly.")

    sync = subparsers.add_parser("sync", help="Generate run/song mapping report.")
    sync.add_argument("--start", required=True, help="ISO datetime for query window start (UTC preferred).")
    sync.add_argument("--end", required=True, help="ISO datetime for query window end (UTC preferred).")
    sync.add_argument("--output-dir", default=os.getenv("PACETUNE_OUTPUT_DIR", "output"))

    render = subparsers.add_parser("render-html", help="Render an HTML view from a JSON report.")
    render.add_argument("--report-file", default=None, help="Path to report JSON. Defaults to latest in output dir.")
    render.add_argument("--output-file", default=None, help="HTML output file path. Defaults next to report.")
    render.add_argument("--output-dir", default=os.getenv("PACETUNE_OUTPUT_DIR", "output"))

    list_songs = subparsers.add_parser("list-songs", help="Print matched songs from a report in plain text.")
    list_songs.add_argument("--report-file", default=None, help="Path to report JSON. Defaults to latest in output dir.")
    list_songs.add_argument("--output-dir", default=os.getenv("PACETUNE_OUTPUT_DIR", "output"))
    return parser.parse_args()


def main() -> int:
    load_dotenv_simple()
    args = parse_args()

    try:
        if args.command == "spotify-auth-url":
            print(spotify_authorize_url(args.redirect_uri))
            return 0

        if args.command == "spotify-exchange-code":
            tokens = spotify_exchange_code_for_refresh_token(args.code, args.redirect_uri)
            print(json.dumps(tokens, indent=2))
            return 0

        if args.command == "sync":
            start = parse_iso_utc(args.start)
            end = parse_iso_utc(args.end)
            if end <= start:
                raise APIError("End time must be after start time.")
            report = run_window(start, end, args.output_dir)
            print(json.dumps({"output_file": report["output_file"], "run_count": report["run_count"]}, indent=2))
            return 0

        if args.command == "render-html":
            report_file = args.report_file or latest_report_path(args.output_dir)
            output_file = args.output_file or report_file.replace(".json", ".html")
            html_path = render_html_file(report_file, output_file)
            print(json.dumps({"report_file": report_file, "html_file": html_path}, indent=2))
            return 0

        if args.command == "list-songs":
            report_file = args.report_file or latest_report_path(args.output_dir)
            print(list_report_songs(report_file), end="")
            return 0

        raise APIError(f"Unknown command: {args.command}")
    except APIError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
