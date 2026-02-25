import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appUrl, commonCookieOptions, COOKIE_NAMES, formBody, parseJson } from "@/lib/oauth";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(`${appUrl()}?spotify_error=${encodeURIComponent(err)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl()}?spotify_error=missing_code_or_state`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(COOKIE_NAMES.spotifyState)?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${appUrl()}?spotify_error=invalid_state`);
  }

  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${appUrl()}/api/auth/spotify/callback`,
      client_id: process.env.SPOTIFY_CLIENT_ID,
      client_secret: process.env.SPOTIFY_CLIENT_SECRET
    })
  });
  const payload = await parseJson(tokenResponse, "Spotify code exchange");

  if (!payload.refresh_token && !cookieStore.get(COOKIE_NAMES.spotifyRefresh)?.value) {
    return NextResponse.redirect(`${appUrl()}?spotify_error=missing_refresh_token`);
  }

  const response = NextResponse.redirect(`${appUrl()}?spotify_connected=1`);
  response.cookies.set(COOKIE_NAMES.spotifyState, "", { ...commonCookieOptions(), maxAge: 0 });
  if (payload.refresh_token) {
    response.cookies.set(COOKIE_NAMES.spotifyRefresh, payload.refresh_token, {
      ...commonCookieOptions(),
      maxAge: 365 * 24 * 60 * 60
    });
  }
  return response;
}
