function parseDate(value) {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return dt;
}

function asIso(date) {
  return date.toISOString();
}

function overlapSeconds(aStart, aEnd, bStart, bEnd) {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  return Math.max(0, (end - start) / 1000);
}

async function postForm(url, values, headers = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...headers
    },
    body: new URLSearchParams(values)
  });
}

async function parseJson(response, label) {
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

export async function refreshStravaAccessToken(refreshToken) {
  const payload = await parseJson(
    await postForm("https://www.strava.com/oauth/token", {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken
    }),
    "Strava token refresh"
  );
  if (!payload.access_token) {
    throw new Error(`Strava token refresh missing access token: ${JSON.stringify(payload)}`);
  }
  return payload.access_token;
}

export async function refreshSpotifyAccessToken(refreshToken) {
  const payload = await parseJson(
    await postForm("https://accounts.spotify.com/api/token", {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    }),
    "Spotify token refresh"
  );
  if (!payload.access_token) {
    throw new Error(`Spotify token refresh missing access token: ${JSON.stringify(payload)}`);
  }
  return payload.access_token;
}

async function listStravaRuns(accessToken, start, end) {
  const startEpoch = Math.floor(start.getTime() / 1000);
  const endEpoch = Math.floor(end.getTime() / 1000);
  const runs = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      after: String(startEpoch),
      before: String(endEpoch),
      per_page: "200",
      page: String(page)
    });
    const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const activities = await parseJson(response, "Strava activities");
    if (!Array.isArray(activities) || activities.length === 0) {
      break;
    }
    runs.push(...activities.filter((item) => item?.type === "Run"));
    page += 1;
  }

  return runs;
}

async function getStravaActivityDetail(accessToken, runId) {
  const params = new URLSearchParams({ include_all_efforts: "false" });
  const response = await fetch(`https://www.strava.com/api/v3/activities/${runId}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return parseJson(response, "Strava activity detail");
}

async function fetchSpotifyPlaysInWindow(accessToken, start, end) {
  let beforeMs = end.getTime();
  const seen = new Set();
  const collected = [];

  while (true) {
    const params = new URLSearchParams({ limit: "50", before: String(beforeMs) });
    const response = await fetch(`https://api.spotify.com/v1/me/player/recently-played?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const payload = await parseJson(response, "Spotify recently played");
    const items = payload.items || [];
    if (items.length === 0) {
      break;
    }

    let oldestPlayedAt = null;

    for (const item of items) {
      const track = item.track;
      if (!track) {
        continue;
      }
      const playedAt = parseDate(item.played_at);
      const durationMs = Number(track.duration_ms || 0);
      const startedAt = new Date(playedAt.getTime() - durationMs);
      const key = `${track.id || "unknown"}:${item.played_at}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      if (playedAt < start && startedAt < start) {
        oldestPlayedAt = oldestPlayedAt ? new Date(Math.min(oldestPlayedAt.getTime(), playedAt.getTime())) : playedAt;
        continue;
      }
      if (startedAt > end) {
        oldestPlayedAt = oldestPlayedAt ? new Date(Math.min(oldestPlayedAt.getTime(), playedAt.getTime())) : playedAt;
        continue;
      }

      const artists = (track.artists || []).map((a) => a.name).filter(Boolean).join(", ");
      collected.push({
        track_id: track.id || "unknown",
        track_name: track.name || "Unknown",
        artists,
        started_at: startedAt,
        ended_at: playedAt,
        duration_ms: durationMs
      });
      oldestPlayedAt = oldestPlayedAt ? new Date(Math.min(oldestPlayedAt.getTime(), playedAt.getTime())) : playedAt;
    }

    if (!oldestPlayedAt || oldestPlayedAt <= start) {
      break;
    }
    beforeMs = oldestPlayedAt.getTime() - 1;
  }

  collected.sort((a, b) => a.started_at - b.started_at);
  return collected;
}

function buildSplits(detail, runStart, runEnd) {
  const metric = detail.splits_metric || [];
  if (metric.length > 0) {
    const elapsedValues = metric.map((s) => Number(s.elapsed_time || 0));
    const isCumulative = elapsedValues.every((v, i) => i === 0 || v >= elapsedValues[i - 1]);
    const splits = [];
    let cumulativeElapsed = 0;
    let previousEnd = new Date(runStart);

    for (let i = 0; i < metric.length; i += 1) {
      const split = metric[i];
      const rawElapsed = Number(split.elapsed_time || 0);
      let splitElapsed = 0;
      if (isCumulative) {
        const targetElapsed = rawElapsed;
        splitElapsed = Math.max(1, targetElapsed - cumulativeElapsed);
        cumulativeElapsed = targetElapsed;
      } else {
        splitElapsed = Math.max(1, rawElapsed);
        cumulativeElapsed += splitElapsed;
      }

      let splitEnd = new Date(runStart.getTime() + cumulativeElapsed * 1000);
      if (splitEnd > runEnd) {
        splitEnd = new Date(runEnd);
        splitElapsed = Math.max(1, Math.round((splitEnd - previousEnd) / 1000));
      }

      splits.push({
        split_index: i + 1,
        distance_km: Number(split.distance || 0) / 1000,
        elapsed_time_s: splitElapsed,
        moving_time_s: Number(split.moving_time || 0),
        start_time: new Date(previousEnd),
        end_time: new Date(splitEnd),
        songs: []
      });
      previousEnd = splitEnd;
    }

    if (previousEnd < runEnd) {
      const existingDistance = splits.reduce((sum, s) => sum + s.distance_km, 0);
      splits.push({
        split_index: splits.length + 1,
        distance_km: Math.max(0, Number(detail.distance || 0) / 1000 - existingDistance),
        elapsed_time_s: Math.max(1, Math.round((runEnd - previousEnd) / 1000)),
        moving_time_s: Math.max(1, Math.round((runEnd - previousEnd) / 1000)),
        start_time: new Date(previousEnd),
        end_time: new Date(runEnd),
        songs: []
      });
    }
    return splits;
  }

  const elapsed = Math.max(1, Number(detail.elapsed_time || Math.round((runEnd - runStart) / 1000)));
  const distanceM = Number(detail.distance || 0);
  const count = Math.max(1, Math.floor(distanceM / 1000));
  const splits = [];
  for (let i = 0; i < count; i += 1) {
    const startRatio = i / count;
    const endRatio = (i + 1) / count;
    const splitStart = new Date(runStart.getTime() + Math.round(elapsed * startRatio) * 1000);
    const splitEnd = new Date(runStart.getTime() + Math.round(elapsed * endRatio) * 1000);
    splits.push({
      split_index: i + 1,
      distance_km: (distanceM / 1000) / count,
      elapsed_time_s: Math.max(1, Math.round((splitEnd - splitStart) / 1000)),
      moving_time_s: Math.max(1, Math.round((splitEnd - splitStart) / 1000)),
      start_time: splitStart,
      end_time: splitEnd,
      songs: []
    });
  }
  return splits;
}

function assignTracksToSplits(splits, tracks) {
  for (const track of tracks) {
    for (const split of splits) {
      if (overlapSeconds(track.started_at, track.ended_at, split.start_time, split.end_time) > 0) {
        split.songs.push(track);
      }
    }
  }
}

export async function syncRunWindow({ stravaRefreshToken, spotifyRefreshToken, start, end }) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (endDate <= startDate) {
    throw new Error("End must be after start.");
  }

  const stravaAccess = await refreshStravaAccessToken(stravaRefreshToken);
  const spotifyAccess = await refreshSpotifyAccessToken(spotifyRefreshToken);
  const runs = await listStravaRuns(stravaAccess, startDate, endDate);
  const reportRuns = [];

  for (const run of runs) {
    const runStart = parseDate(run.start_date);
    const runEnd = new Date(runStart.getTime() + Number(run.elapsed_time || 0) * 1000);
    if (runEnd < startDate || runStart > endDate) {
      continue;
    }
    const detail = await getStravaActivityDetail(stravaAccess, run.id);
    const tracks = await fetchSpotifyPlaysInWindow(spotifyAccess, runStart, runEnd);
    const splits = buildSplits(detail, runStart, runEnd);
    assignTracksToSplits(splits, tracks);

    reportRuns.push({
      run_id: run.id,
      name: run.name || "Run",
      start_time: asIso(runStart),
      end_time: asIso(runEnd),
      distance_km: Number(run.distance || 0) / 1000,
      elapsed_time_s: Number(run.elapsed_time || 0),
      tracks_during_run: tracks.map((t) => ({
        track_id: t.track_id,
        track_name: t.track_name,
        artists: t.artists,
        started_at: asIso(t.started_at),
        ended_at: asIso(t.ended_at),
        duration_ms: t.duration_ms
      })),
      splits: splits.map((s) => ({
        split_index: s.split_index,
        distance_km: s.distance_km,
        elapsed_time_s: s.elapsed_time_s,
        moving_time_s: s.moving_time_s,
        start_time: asIso(s.start_time),
        end_time: asIso(s.end_time),
        songs: s.songs.map((t) => ({
          track_id: t.track_id,
          track_name: t.track_name,
          artists: t.artists,
          started_at: asIso(t.started_at),
          ended_at: asIso(t.ended_at),
          duration_ms: t.duration_ms
        }))
      }))
    });
  }

  return {
    generated_at: new Date().toISOString(),
    window_start: asIso(startDate),
    window_end: asIso(endDate),
    run_count: reportRuns.length,
    runs: reportRuns
  };
}
