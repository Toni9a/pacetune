import crypto from "node:crypto";

export const COOKIE_NAMES = {
  spotifyState: "pt_spotify_state",
  stravaState: "pt_strava_state",
  spotifyRefresh: "pt_spotify_refresh",
  stravaRefresh: "pt_strava_refresh"
};

export function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function makeState() {
  return crypto.randomBytes(24).toString("hex");
}

export function commonCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/"
  };
}

export function formBody(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      params.set(key, String(value));
    }
  }
  return params;
}

export async function parseJson(response, label) {
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
