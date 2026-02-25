import { NextResponse } from "next/server";
import { appUrl, commonCookieOptions, COOKIE_NAMES, makeState } from "@/lib/oauth";

export async function GET() {
  if (!process.env.SPOTIFY_CLIENT_ID) {
    return NextResponse.json({ error: "Missing SPOTIFY_CLIENT_ID." }, { status: 500 });
  }

  const redirectUri = `${appUrl()}/api/auth/spotify/callback`;
  const state = makeState();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: "user-read-recently-played",
    redirect_uri: redirectUri,
    state
  });

  const response = NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
  response.cookies.set(COOKIE_NAMES.spotifyState, state, {
    ...commonCookieOptions(),
    maxAge: 10 * 60
  });
  return response;
}
