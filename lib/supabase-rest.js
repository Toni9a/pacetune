import crypto from "node:crypto";

const OWNER_COOKIE = "pt_owner_id";
const USER_COOKIE = "pt_user_id";

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function baseUrl() {
  return requiredEnv("SUPABASE_URL").replace(/\/$/, "");
}

function serviceRole() {
  return requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
}

function headers(prefer) {
  return {
    apikey: serviceRole(),
    Authorization: `Bearer ${serviceRole()}`,
    "Content-Type": "application/json",
    Prefer: prefer || "return=representation"
  };
}

async function rest(path, { method = "GET", body, prefer } = {}) {
  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: headers(prefer),
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`Supabase ${method} ${path} failed (${response.status}): ${text}`);
  }
  return payload;
}

export function getOrCreateOwnerId(cookieStore) {
  const existing = cookieStore.get(USER_COOKIE)?.value || cookieStore.get(OWNER_COOKIE)?.value;
  return existing || crypto.randomUUID();
}

export function ownerCookieName() {
  return USER_COOKIE;
}

export function legacyOwnerCookieName() {
  return OWNER_COOKIE;
}

export function getSessionUserId(cookieStore) {
  return cookieStore.get(USER_COOKIE)?.value || cookieStore.get(OWNER_COOKIE)?.value || null;
}

function encryptionKey() {
  const raw = process.env.APP_TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    return null;
  }
  return crypto.createHash("sha256").update(raw).digest();
}

function encryptText(value) {
  const key = encryptionKey();
  if (!key) {
    return `plain:${value}`;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptText(value) {
  if (!value) {
    return null;
  }
  if (value.startsWith("plain:")) {
    return value.slice("plain:".length);
  }
  if (!value.startsWith("enc:")) {
    return value;
  }
  const key = encryptionKey();
  if (!key) {
    throw new Error("Missing APP_TOKEN_ENCRYPTION_KEY required to decrypt provider token.");
  }
  const [, ivB64, tagB64, dataB64] = value.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export async function ensureOwner(ownerId) {
  await rest(`/rest/v1/pacetune_users?on_conflict=id`, {
    method: "POST",
    body: [{ id: ownerId }],
    prefer: "resolution=merge-duplicates,return=minimal"
  });
}

export async function findUserByProvider(provider, providerUserId) {
  const rows = await rest(
    `/rest/v1/pacetune_provider_accounts?provider=eq.${encodeURIComponent(provider)}&provider_user_id=eq.${encodeURIComponent(String(providerUserId))}&select=user_id&limit=1`
  );
  return rows?.[0]?.user_id || null;
}

export async function upsertProviderAccount({ userId, provider, providerUserId, refreshToken }) {
  await ensureOwner(userId);
  const existing = await rest(
    `/rest/v1/pacetune_provider_accounts?provider=eq.${encodeURIComponent(provider)}&provider_user_id=eq.${encodeURIComponent(String(providerUserId))}&select=provider_refresh_token&limit=1`
  );
  const previousToken = existing?.[0]?.provider_refresh_token || null;
  const effectiveToken = refreshToken ? encryptText(refreshToken) : previousToken;

  await rest(`/rest/v1/pacetune_provider_accounts?on_conflict=provider,provider_user_id`, {
    method: "POST",
    body: [
      {
        user_id: userId,
        provider,
        provider_user_id: String(providerUserId),
        provider_refresh_token: effectiveToken
      }
    ],
    prefer: "resolution=merge-duplicates,return=minimal"
  });
}

export async function getProviderRefreshToken(userId, provider) {
  const rows = await rest(
    `/rest/v1/pacetune_provider_accounts?user_id=eq.${encodeURIComponent(userId)}&provider=eq.${encodeURIComponent(provider)}&select=provider_refresh_token&limit=1`
  );
  return decryptText(rows?.[0]?.provider_refresh_token || null);
}

export async function listProvidersForUser(userId) {
  const rows = await rest(
    `/rest/v1/pacetune_provider_accounts?user_id=eq.${encodeURIComponent(userId)}&select=provider`
  );
  return new Set((rows || []).map((r) => r.provider));
}

export async function persistReport(ownerId, report, source = "live") {
  await ensureOwner(ownerId);

  const runs = report.runs || [];
  for (const run of runs) {
    await rest(`/rest/v1/pacetune_runs?on_conflict=owner_id,run_id`, {
      method: "POST",
      body: [
        {
          owner_id: ownerId,
          run_id: String(run.run_id),
          name: run.name || "Run",
          start_time: run.start_time,
          end_time: run.end_time,
          distance_km: run.distance_km || 0,
          elapsed_time_s: run.elapsed_time_s || 0,
          source,
          last_synced_at: new Date().toISOString()
        }
      ],
      prefer: "resolution=merge-duplicates,return=minimal"
    });

    await rest(
      `/rest/v1/pacetune_tracks?owner_id=eq.${encodeURIComponent(ownerId)}&run_id=eq.${encodeURIComponent(String(run.run_id))}`,
      { method: "DELETE", prefer: "return=minimal" }
    );
    await rest(
      `/rest/v1/pacetune_splits?owner_id=eq.${encodeURIComponent(ownerId)}&run_id=eq.${encodeURIComponent(String(run.run_id))}`,
      { method: "DELETE", prefer: "return=minimal" }
    );
    await rest(
      `/rest/v1/pacetune_split_tracks?owner_id=eq.${encodeURIComponent(ownerId)}&run_id=eq.${encodeURIComponent(String(run.run_id))}`,
      { method: "DELETE", prefer: "return=minimal" }
    );

    const trackRows = (run.tracks_during_run || []).map((track) => ({
      owner_id: ownerId,
      run_id: String(run.run_id),
      track_id: track.track_id || "unknown",
      track_name: track.track_name || "Unknown",
      artists: track.artists || "",
      started_at: track.started_at,
      ended_at: track.ended_at,
      duration_ms: track.duration_ms || 0
    }));
    if (trackRows.length) {
      await rest("/rest/v1/pacetune_tracks", {
        method: "POST",
        body: trackRows,
        prefer: "return=minimal"
      });
    }

    const splitRows = (run.splits || []).map((split) => ({
      owner_id: ownerId,
      run_id: String(run.run_id),
      split_index: split.split_index,
      distance_km: split.distance_km || 0,
      elapsed_time_s: split.elapsed_time_s || 0,
      moving_time_s: split.moving_time_s || 0,
      start_time: split.start_time,
      end_time: split.end_time
    }));
    if (splitRows.length) {
      await rest("/rest/v1/pacetune_splits", {
        method: "POST",
        body: splitRows,
        prefer: "return=minimal"
      });
    }

    const splitTrackRows = [];
    for (const split of run.splits || []) {
      for (const song of split.songs || []) {
        splitTrackRows.push({
          owner_id: ownerId,
          run_id: String(run.run_id),
          split_index: split.split_index,
          track_id: song.track_id || "unknown",
          ended_at: song.ended_at
        });
      }
    }
    if (splitTrackRows.length) {
      await rest("/rest/v1/pacetune_split_tracks", {
        method: "POST",
        body: splitTrackRows,
        prefer: "return=minimal"
      });
    }
  }
}

export async function loadOwnerHistory(ownerId, limit = 30) {
  const runs = await rest(
    `/rest/v1/pacetune_runs?owner_id=eq.${encodeURIComponent(ownerId)}&order=start_time.desc&limit=${limit}`
  );

  const mappedRuns = [];
  for (const run of runs || []) {
    const runId = String(run.run_id);
    const tracks = await rest(
      `/rest/v1/pacetune_tracks?owner_id=eq.${encodeURIComponent(ownerId)}&run_id=eq.${encodeURIComponent(runId)}&order=started_at.asc`
    );
    const splits = await rest(
      `/rest/v1/pacetune_splits?owner_id=eq.${encodeURIComponent(ownerId)}&run_id=eq.${encodeURIComponent(runId)}&order=split_index.asc`
    );
    const splitTracks = await rest(
      `/rest/v1/pacetune_split_tracks?owner_id=eq.${encodeURIComponent(ownerId)}&run_id=eq.${encodeURIComponent(runId)}`
    );

    const trackMap = new Map((tracks || []).map((t) => [`${t.track_id}::${t.ended_at}`, t]));
    const groupedSplitTracks = new Map();
    for (const row of splitTracks || []) {
      const key = `${row.split_index}`;
      if (!groupedSplitTracks.has(key)) {
        groupedSplitTracks.set(key, []);
      }
      const track = trackMap.get(`${row.track_id}::${row.ended_at}`);
      if (track) {
        groupedSplitTracks.get(key).push(track);
      }
    }

    mappedRuns.push({
      run_id: runId,
      name: run.name,
      start_time: run.start_time,
      end_time: run.end_time,
      distance_km: Number(run.distance_km || 0),
      elapsed_time_s: Number(run.elapsed_time_s || 0),
      tracks_during_run: (tracks || []).map((t) => ({
        track_id: t.track_id,
        track_name: t.track_name,
        artists: t.artists,
        started_at: t.started_at,
        ended_at: t.ended_at,
        duration_ms: t.duration_ms
      })),
      splits: (splits || []).map((s) => ({
        split_index: s.split_index,
        distance_km: Number(s.distance_km || 0),
        elapsed_time_s: Number(s.elapsed_time_s || 0),
        moving_time_s: Number(s.moving_time_s || 0),
        start_time: s.start_time,
        end_time: s.end_time,
        songs: (groupedSplitTracks.get(String(s.split_index)) || []).map((t) => ({
          track_id: t.track_id,
          track_name: t.track_name,
          artists: t.artists,
          started_at: t.started_at,
          ended_at: t.ended_at,
          duration_ms: t.duration_ms
        }))
      }))
    });
  }

  return {
    generated_at: new Date().toISOString(),
    window_start: mappedRuns.at(-1)?.start_time || new Date().toISOString(),
    window_end: mappedRuns[0]?.end_time || new Date().toISOString(),
    run_count: mappedRuns.length,
    runs: mappedRuns,
    source: "saved"
  };
}
